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
const Verifier = function(req, res, next) {
  if (!req.token) {
    deny(res, 'message', 'type', `Bearer realm="${tenant}"`);
  }
  VerifiableCredentials.verifyPresentation(req.token, resolver)
    .then(presentation => {
      debug('Presentation');
      debug(`issued by: ${presentation.issuer}`);
      for (const credential of presentation.verifiablePresentation
        .verifiableCredential) {
        VerifiableCredentials.verifyCredential(
          credential.proof.jwt,
          resolver
        ).then(verifiedVC => {
          const vc = {
            type: credential.type,
            data: credential.credentialSubject,
            sub: verifiedVC.payload.sub,
            iss: verifiedVC.payload.iss,
            nbf: verifiedVC.payload.nbf
          };

          debug(`${vc.type}`);
          debug(`     nbf: ${vc.nbf}`);
          debug(`     iss: ${vc.iss}`);
          debug(`     sub: ${vc.sub}`);
          debug(`     data: ${JSON.stringify(vc.data)}\r\n`);
        });
      }

      next();
    })
    .catch(error => {
      deny(res, error.message, 'type', `Bearer realm="${tenant}"`);
    });
};

/*

async function verifyPresentation(jwt) {
    const verifiedVP = await VerifiableCredentials.verifyPresentation(jwt, resolver);
    return verifiedVP;
}

async function verifyCredential(jwt) {
    const verifiedVC = await VerifiableCredentials.verifyCredential(jwt, resolver);
    return verifiedVC;
}*/

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
