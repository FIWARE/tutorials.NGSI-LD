//
// This controller demonstrates how to generate and validate
// Verifiable credentials using the DID-web protocol
//
// For more information see: https://www.w3.org/TR/vc-data-model/
//                           https://w3c-ccg.github.io/did-method-web/
//

import * as VerifiableCredentials from 'did-jwt-vc';
import * as DIDJWTSigner from 'did-jwt';
import { Resolver } from 'did-resolver';
import { getResolver } from 'web-did-resolver';
import debug from 'debug';
import { Request, Response, NextFunction } from 'express';

const debugLog = debug('tutorial:credentials');

// The resolver is stateless configuration — create it once at module scope
// rather than constructing a new instance on every verify request.
const resolver = new Resolver(getResolver());

// Parse a request body field — handles both pre-parsed JSON objects and raw JSON strings.
function parseBody(value: unknown): Record<string, unknown> {
    if (!value) return {};
    return typeof value === 'string' ? JSON.parse(value) as Record<string, unknown> : value as Record<string, unknown>;
}

function catchErrors(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
        return fn(req, res, next).catch((e: Error) => {
            debugLog(e.message);
            return res.status(400).send({
                type: 'https://uri.etsi.org/ngsi-ld/errors/BadRequestData',
                title: e.name,
                detail: e.message
            });
        });
    };
}

/**
 *  Takes a presentation as a JWT and checks the validity of the presentation
 *  through resolving the public key
 *
 *  For example - these documents (an ID card and a Drivers License)
 *  were presented by Alice
 */
async function verifyPresentation(req: Request, res: Response): Promise<void> {
    const payload = parseBody(req.body);
    const verifiedVP = await VerifiableCredentials.verifyPresentation(payload.jwt as string, resolver);
    res.status(200).send(verifiedVP);
}

/**
 *  Takes a credential as a JWT and checks the validity of the credential
 *  through resolving the public key.
 *
 *  For example - this Driver's License is valid
 */
async function verifyCredential(req: Request, res: Response): Promise<void> {
    const payload = parseBody(req.body);
    const verifiedVC = await VerifiableCredentials.verifyCredential(payload.jwt as string, resolver);
    res.status(200).send(verifiedVC);
}

/**
 *  Takes one or more JWTs as part of a presentation and signs them
 */
async function generatePresentation(req: Request, res: Response): Promise<void> {
    const body = req.body as Record<string, unknown>;
    const iss = body.iss as string;
    const payload = parseBody(body.payload);
    // Create a signer by using a private key (hex).
    // All the participants are using the same private key in the demo
    // Usually this key should be key secret.
    const key = (body.key as string) || '0b6366519a40eb4f384f7f84cf8bb716683ad1af8adbe60e59fe24ba042e396a';
    const signer = DIDJWTSigner.ES256KSigner(DIDJWTSigner.hexToBytes(key));

    // Prepare an issuer
    const issuer = {
        did: iss,
        signer
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vpJwt = await VerifiableCredentials.createVerifiablePresentationJwt(payload as VerifiableCredentials.PresentationPayload, issuer as any);
    res.status(200).send({ jwt: vpJwt });
}

/**
 * Takes a JSON-LD payload and generates as DID-web JWT.
 */
async function generateCredential(req: Request, res: Response): Promise<void> {
    const body = req.body as Record<string, unknown>;
    const vc = parseBody(body.vc);
    const iss = body.iss as string;
    const sub = body.sub as string;
    const type = body.claimType as string;
    const nbf = Number.parseInt(body.nbf as string, 10);
    // Create a signer by using a private key (hex).
    // All the participants are using the same private key in the demo
    // Usually this key should be key secret.
    const key = (body.key as string) || '0b6366519a40eb4f384f7f84cf8bb716683ad1af8adbe60e59fe24ba042e396a';
    const signer = DIDJWTSigner.ES256KSigner(DIDJWTSigner.hexToBytes(key));

    // Prepare an issuer
    const issuer = {
        did: iss,
        signer
    };

    // Prepare the Verifiable Credential Payload
    const vcPayload: VerifiableCredentials.JwtCredentialPayload = {
        sub,
        nbf,
        vc: vc as VerifiableCredentials.Verifiable<VerifiableCredentials.W3CCredential>
    };

    // Create the Verifiable Credential (JWT)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vcJwt = await VerifiableCredentials.createVerifiableCredentialJwt(vcPayload, issuer as any);

    res.status(200).send({ jwt: vcJwt, type });
}

interface ClaimItem {
    type: string;
    name: string;
    issuedBy: string;
    issuedFor: string;
    subject: string;
    issuer: string;
    path: string;
}

interface IssuerItem {
    name: string;
    issuer: string;
}

/**
 *  A series of credentials to be used within the tutorial.
 */
function init(req: Request, res: Response): void {
    const CLAIMS_WEBSITE = 'https://fiware.github.io/tutorials.Step-by-Step';
    const DID_WEB_DOMAIN_NAME = 'did:web:fiware.github.io:tutorials.Step-by-Step';
    const now = new Date();
    const unixtime = Math.floor(now.getTime() / 1000);
    const claims: ClaimItem[] = [
        {
            type: 'Drivers License',
            name: 'Drivers License for Alice',
            issuedBy: 'Government',
            issuedFor: 'Alice',
            subject: DID_WEB_DOMAIN_NAME + ':alice',
            issuer: DID_WEB_DOMAIN_NAME + ':gov',
            path: CLAIMS_WEBSITE + '/gov/claim/driversLicense/alice.json'
        },
        {
            type: 'Drivers License',
            name: 'Drivers License for Bob',
            issuedBy: 'Government',
            issuedFor: 'Bob',
            subject: DID_WEB_DOMAIN_NAME + ':bob',
            issuer: DID_WEB_DOMAIN_NAME + ':gov',
            path: CLAIMS_WEBSITE + '/gov/claim/driversLicense/bob.json'
        },
        {
            type: 'ID Card',
            name: 'ID Card for Alice',
            issuedBy: 'Government',
            issuedFor: 'Alice',
            subject: DID_WEB_DOMAIN_NAME + ':alice',
            issuer: DID_WEB_DOMAIN_NAME + ':gov',
            path: CLAIMS_WEBSITE + '/gov/claim/idCard/alice.json'
        },
        {
            type: 'ID Card',
            name: 'ID Card for Bob',
            issuedBy: 'Government',
            issuedFor: 'Bob',
            subject: DID_WEB_DOMAIN_NAME + ':bob',
            issuer: DID_WEB_DOMAIN_NAME + ':gov',
            path: CLAIMS_WEBSITE + '/gov/claim/idCard/bob.json'
        },
        {
            type: 'Employee Card',
            name: 'Employee Card for Alice',
            issuedBy: 'Animal Welfare Agency',
            issuedFor: 'Alice',
            subject: DID_WEB_DOMAIN_NAME + ':alice',
            issuer: DID_WEB_DOMAIN_NAME + ':animal-welfare',
            path: CLAIMS_WEBSITE + '/animal-welfare/claim/employmentCredential/alice.json'
        },
        {
            type: 'Employee Card',
            name: 'Employee Card for Bob',
            issuedBy: 'Farm',
            issuedFor: 'Alice',
            subject: DID_WEB_DOMAIN_NAME + ':bob',
            issuer: DID_WEB_DOMAIN_NAME + ':farm',
            path: CLAIMS_WEBSITE + '/farmer/claim/employmentCredential/bob.json'
        },
        {
            type: 'Purchase Receipt',
            name: 'Purchase of Data Access for the Farm',
            issuedBy: 'Vet-Mart',
            issuedFor: 'Farm',
            subject: DID_WEB_DOMAIN_NAME + ':farm',
            issuer: DID_WEB_DOMAIN_NAME + ':vet-mart',
            path: CLAIMS_WEBSITE + '/vet-mart/claim/dataAccessOrder/farm.json'
        },
        {
            type: 'Data Access Claim',
            name: 'Data Access Claim for Alice',
            issuedBy: 'Animal Welfare Agency',
            issuedFor: 'Alice',
            subject: DID_WEB_DOMAIN_NAME + ':alice',
            issuer: DID_WEB_DOMAIN_NAME + ':animal-welfare',
            path: CLAIMS_WEBSITE + '/animal-welfare/claim/userCredential/alice.json'
        },
        {
            type: 'Data Access Claim',
            name: 'Data Access Claim for Bob',
            issuedBy: 'Vet-Mart',
            issuedFor: 'Bob',
            subject: DID_WEB_DOMAIN_NAME + ':bob',
            issuer: DID_WEB_DOMAIN_NAME + ':vet-mart',
            path: CLAIMS_WEBSITE + '/vet-mart/claim/userCredential/bob.json'
        }
    ];

    const issuers: IssuerItem[] = [
        {
            name: 'Alice',
            issuer: DID_WEB_DOMAIN_NAME + ':alice'
        },
        {
            name: 'Bob',
            issuer: DID_WEB_DOMAIN_NAME + ':bob'
        }
    ];

    res.render('credentials', {
        title: 'Credentials',
        claims,
        issuers,
        date: now.toISOString().split('T')[0],
        unixtime
    });
}

export { init, generateCredential, generatePresentation, verifyCredential, verifyPresentation, catchErrors };
