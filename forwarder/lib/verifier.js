const StatusCodes = require('http-status-codes').StatusCodes;
const getReasonPhrase = require('http-status-codes').getReasonPhrase;
const debug = require('debug')('broker:verifier');
const tenant = process.env.TENANT || 'farmer';
const template = require('handlebars').compile(
  `{
    "type": "{{type}}",
    "title": "{{title}}",
    "detail": "{{message}}"
  }`
);
const DIDResolver = require('did-resolver');
const WebDIDResolver = require('web-did-resolver');
const VerifiableCredentials = require('did-jwt-vc');

const resolver = new DIDResolver.Resolver(WebDIDResolver.getResolver());

class Verifier {
  constructor(config) {
    this.config = config;
    this.verify = this.verify.bind(this);
  }

  verify(req, res, next) {
    if (!req.token) {
      deny(res, 'message', 'type', `Bearer realm="${tenant}"`);
    }

    VerifiableCredentials.verifyPresentation(req.token, resolver)
      .then(presentation => {
        debug('Presentation');
        debug(`issued by: ${presentation.issuer}`);
        const credentialsPromises = [];

        for (const credential of presentation.verifiablePresentation
          .verifiableCredential) {
          credentialsPromises.push(
            verifyCredential(
              credential.proof.jwt,
              credential.type,
              credential.credentialSubject
            )
          );
        }

        Promise.all(credentialsPromises).then(credentials => {
          const trustedIssuersPromises = [];
          for (const credential of credentials) {
            const trustedList = getTrustedIssuerHost(
              credential.type,
              this.config
            );
            trustedIssuersPromises.push(
              verifyTrustedIssuer(credential, trustedList)
            );
          }

          Promise.all(trustedIssuersPromises).then(values => {
            console.log(values);
            next();
          });
        });

        // debug(`${vc.type}`);
        // debug(`     nbf: ${vc.nbf}`);
        // debug(`     iss: ${vc.iss}`);
        // debug(`     sub: ${vc.sub}`);
        // debug(`     data: ${JSON.stringify(vc.data)}\r\n`);
      })
      .catch(error => {
        deny(res, error.message, 'type', `Bearer realm="${tenant}"`);
      });
  }
}

function verifyCredential(jwt, type, data) {
  return new Promise(function(resolve, reject) {
    let vc = null;
    VerifiableCredentials.verifyCredential(jwt, resolver)
      .then(verifiedVC => {
        const vc = {
          type: type,
          data: data,
          sub: verifiedVC.payload.sub,
          iss: verifiedVC.payload.iss,
          nbf: verifiedVC.payload.nbf
        };
        return resolve(vc);
      })
      .catch(error => {
        return reject(error);
      });
  });
}

function getTrustedIssuerHost(type, config) {
  let host = null;
  for (const item of config) {
    if (type.includes(item.type)) {
      host = item.trustedIssuersLists[0];
      break;
    }
  }
  return host;
}

// trusted-issuers-list
function verifyTrustedIssuer(vc, trustedList) {
  return new Promise(function(resolve, reject) {
    //console.log(`${trustedList}/v4/issuers/${vc.iss}`);
    const fetchPromise = fetch(`${trustedList}/v4/issuers/${vc.iss}`);
    fetchPromise
      .then(response => {
        if (response.status === StatusCodes.NOT_FOUND) {
          vc.trusted = false;
          vc.claims = [];
          resolve(vc);
        }
        return response.json();
      })
      .then(payload => {
        const claims = JSON.parse(atob(payload.attributes[0].body));
        vc.trusted = vc.type.includes(claims.credentialsType);
        vc.claims = vc.trusted ? claims.claims : [];
        resolve(vc);
      })
      .catch(error => {
        return reject(error);
      });
  });
}

/**
 * Return an "Access Denied" response
 *
 * @param res - the response to return
 * @param message - the error message to display
 * @param type - the error type
 */
function deny(res, message, type, realm) {
  debug('Denied. ' + type);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('WWW-Authenticate', realm);
  res.status(StatusCodes.UNAUTHORIZED).send(
    template({
      type,
      title: getReasonPhrase(StatusCodes.UNAUTHORIZED),
      message
    })
  );
}

module.exports = {
  Verifier
};
