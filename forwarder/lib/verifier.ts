import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import debug from 'debug';
import Handlebars from 'handlebars';
import { Resolver } from 'did-resolver';
import { getResolver } from 'web-did-resolver';
import {
  verifyPresentation,
  verifyCredential as verifyVCCredential,
} from 'did-jwt-vc';
import type { Verifiable, W3CCredential } from 'did-jwt-vc';
import type { Request, Response, NextFunction } from 'express';
import * as Emitter from './emitter';

const log = debug('broker:verifier');
const tenant = process.env.TENANT || 'farmer';
const trustedIssuerList = process.env.TRUSTED_ISSUER_LIST;

const template = Handlebars.compile(
  `{
    "type": "{{type}}",
    "title": "{{title}}",
    "detail": "{{message}}"
  }`,
);

const resolver = new Resolver(getResolver());

interface CredentialItem {
  type: string;
  trustedIssuersLists: string[];
}

interface CredentialsConfig {
  credentials: CredentialItem[];
}

interface LocalVC {
  type: string[];
  data: Record<string, unknown>;
  sub: string | undefined;
  iss: string | undefined;
  nbf: number | undefined;
  trusted?: boolean;
  claims?: unknown[];
}

export class Verifier {
  private config: unknown;

  constructor(config: unknown) {
    this.config = config;
    this.verify = this.verify.bind(this);
  }

  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.token) {
      deny(
        res,
        'message',
        'urn:dx:as:MissingAuthenticationToken',
        `Bearer realm="${tenant}"`,
      );
      return;
    }

    try {
      const presentation = await verifyPresentation(req.token, resolver);
      log('Presentation');
      log(`issued by: ${presentation.issuer}`);

      const credentialResults = await Promise.all(
        (presentation.verifiablePresentation.verifiableCredential ?? []).map(
          (credential) => {
            const credentialObj = credential as Verifiable<W3CCredential>;
            return verifyLocalCredential(
              credentialObj.proof['jwt'] as string,
              credentialObj.type as string[],
              credentialObj.credentialSubject as Record<string, unknown>,
            ).catch((err: Error) => err);
          },
        ),
      );

      const invalidResults = credentialResults.filter(
        (result): result is Error => result instanceof Error,
      );
      log(String(invalidResults.length));

      if (invalidResults.length > 0) {
        deny(
          res,
          invalidResults[0].message,
          'urn:dx:as:InvalidAuthenticationToken',
          `Bearer realm="${tenant}"`,
        );
        return;
      }

      const validResults = credentialResults.filter(
        (result): result is LocalVC => !(result instanceof Error),
      );
      const values = await Promise.all(
        validResults.map((credential) =>
          verifyTrustedIssuer(
            credential,
            getTrustedIssuerHost(credential.type, this.config),
          ),
        ),
      );

      Emitter.emit('trust', values);
      next();
    } catch (error) {
      deny(
        res,
        (error as Error).message,
        'urn:dx:as:InvalidAuthenticationToken',
        `Bearer realm="${tenant}"`,
      );
    }
  }
}

// Fix 4: removed Promise constructor anti-pattern
async function verifyLocalCredential(
  jwt: string,
  type: string[],
  data: Record<string, unknown>,
): Promise<LocalVC> {
  const verifiedVC = await verifyVCCredential(jwt, resolver);
  return {
    type,
    data,
    sub: verifiedVC.payload.sub,
    iss: verifiedVC.payload.iss,
    nbf: verifiedVC.payload.nbf,
  };
}

function getTrustedIssuerHost(type: string[], config: unknown): string | null {
  if (trustedIssuerList) {
    return trustedIssuerList;
  }
  const cfg = config as CredentialsConfig;
  let host: string | null = null;
  for (const item of cfg.credentials) {
    if (type.includes(item.type)) {
      host = item.trustedIssuersLists[0];
      break;
    }
  }
  return host;
}

// Fix 2: early return after NOT_FOUND; Fix 3: console.log → log(); Fix 4: no Promise constructor
async function verifyTrustedIssuer(
  vc: LocalVC,
  trustedList: string | null,
): Promise<LocalVC> {
  const response = await fetch(`${trustedList}/v4/issuers/${vc.iss}`);
  if (response.status === StatusCodes.NOT_FOUND) {
    vc.trusted = false;
    vc.claims = [];
    return vc;
  }
  const payload = (await response.json()) as {
    attributes: Array<{ body: string }>;
  };
  for (const attribute of payload.attributes) {
    const trustedClaim = JSON.parse(atob(attribute.body)) as {
      credentialsType: string;
      claims: unknown[];
    };
    if (vc.type.includes(trustedClaim.credentialsType)) {
      vc.trusted = vc.type.includes(trustedClaim.credentialsType);
      vc.claims = vc.trusted ? trustedClaim.claims : [];
    }
  }
  log(JSON.stringify(vc));
  return vc;
}

function deny(
  res: Response,
  message: string,
  type: string,
  realm: string,
): void {
  log('Denied. ' + type);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('WWW-Authenticate', realm);
  res.status(StatusCodes.UNAUTHORIZED).send(
    template({
      type,
      title: getReasonPhrase(StatusCodes.UNAUTHORIZED),
      message,
    }),
  );
}
