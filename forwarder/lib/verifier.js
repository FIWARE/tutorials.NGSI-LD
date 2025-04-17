const StatusCodes = require('http-status-codes').StatusCodes;
const getReasonPhrase = require('http-status-codes').getReasonPhrase;
const debug = require('debug')('broker:verifier');
const tenant = process.env.TENANT || 'farmer';
const trustedIssuerList = process.env.TRUSTED_ISSUER_LIST;
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
const Emitter = require('./emitter');

const resolver = new DIDResolver.Resolver(WebDIDResolver.getResolver());

class Verifier {
    constructor(config) {
        this.config = config;
        this.verify = this.verify.bind(this);
    }

    verify(req, res, next) {
        if (!req.token) {
            deny(res, 'message', 'urn:dx:as:MissingAuthenticationToken', `Bearer realm="${tenant}"`);
        }

        VerifiableCredentials.verifyPresentation(req.token, resolver)
            .then((presentation) => {
                debug('Presentation');
                debug(`issued by: ${presentation.issuer}`);
                const credentialsPromises = [];

                for (const credential of presentation.verifiablePresentation.verifiableCredential) {
                    credentialsPromises.push(
                        verifyCredential(credential.proof.jwt, credential.type, credential.credentialSubject).catch(
                            (err) => {
                                return err;
                            }
                        )
                    );
                }

                Promise.all(credentialsPromises).then((credentials) => {
                    const trustedIssuersPromises = [];
                    const invalidResults = credentials.filter((result) => result instanceof Error);
                    console.log(invalidResults.length);

                    if (invalidResults.length > 0) {
                        //return  res.status(StatusCodes.UNAUTHORIZED).send();
                        return deny(
                            res,
                            invalidResults[0].message,
                            'urn:dx:as:InvalidAuthenticationToken',
                            `Bearer realm="${tenant}"`
                        );
                    }

                    const validResults = credentials.filter((result) => !(result instanceof Error));
                    for (const credential of validResults) {
                        const trustedList = getTrustedIssuerHost(credential.type, this.config);
                        trustedIssuersPromises.push(verifyTrustedIssuer(credential, trustedList));
                    }

                    Promise.all(trustedIssuersPromises).then((values) => {
                        Emitter.emit('trust', values);
                        next();
                    });
                });
            })
            .catch((error) => {
                return deny(res, error.message, 'urn:dx:as:InvalidAuthenticationToken', `Bearer realm="${tenant}"`);
            });
    }
}

function verifyCredential(jwt, type, data) {
    return new Promise(function (resolve, reject) {
        let vc = null;
        VerifiableCredentials.verifyCredential(jwt, resolver)
            .then((verifiedVC) => {
                const vc = {
                    type: type,
                    data: data,
                    sub: verifiedVC.payload.sub,
                    iss: verifiedVC.payload.iss,
                    nbf: verifiedVC.payload.nbf
                };
                return resolve(vc);
            })
            .catch((error) => {
                return reject(error);
            });
    });
}

function getTrustedIssuerHost(type, config) {
    if (trustedIssuerList) {
        return trustedIssuerList;
    }

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
    return new Promise(function (resolve, reject) {
        const fetchPromise = fetch(`${trustedList}/v4/issuers/${vc.iss}`);
        fetchPromise
            .then((response) => {
                if (response.status === StatusCodes.NOT_FOUND) {
                    vc.trusted = false;
                    vc.claims = [];
                    resolve(vc);
                }
                return response.json();
            })
            .then((payload) => {
                for (const attribute of payload.attributes) {
                    const trustedClaim = JSON.parse(atob(attribute.body));
                    if (vc.type.includes(trustedClaim.credentialsType)) {
                        vc.trusted = vc.type.includes(trustedClaim.credentialsType);
                        vc.claims = vc.trusted ? trustedClaim.claims : [];
                    }
                }

                /*
        const claims = JSON.parse(atob(payload.attributes[0].body));
        */
                console.log(vc);
                resolve(vc);
            })
            .catch((error) => {
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
