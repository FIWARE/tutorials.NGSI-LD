"use strict";
//
// This controller demonstrates how to generate and validate
// Verifiable credentials using the DID-web protocol
//
// For more information see: https://www.w3.org/TR/vc-data-model/
//                           https://w3c-ccg.github.io/did-method-web/
//
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
exports.generateCredential = generateCredential;
exports.generatePresentation = generatePresentation;
exports.verifyCredential = verifyCredential;
exports.verifyPresentation = verifyPresentation;
exports.catchErrors = catchErrors;
const VerifiableCredentials = __importStar(require("did-jwt-vc"));
const DIDJWTSigner = __importStar(require("did-jwt"));
const did_resolver_1 = require("did-resolver");
const web_did_resolver_1 = require("web-did-resolver");
const debug_1 = __importDefault(require("debug"));
const debugLog = (0, debug_1.default)('tutorial:credentials');
// The resolver is stateless configuration — create it once at module scope
// rather than constructing a new instance on every verify request.
const resolver = new did_resolver_1.Resolver((0, web_did_resolver_1.getResolver)());
function catchErrors(fn) {
    return (req, res, next) => {
        return fn(req, res, next).catch((e) => {
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
async function verifyPresentation(req, res) {
    const body = req.body;
    const payload = body ? (typeof body === 'string' ? JSON.parse(body) : body) : {};
    const verifiedVP = await VerifiableCredentials.verifyPresentation(payload.jwt, resolver);
    res.status(200).send(verifiedVP);
}
/**
 *  Takes a credential as a JWT and checks the validity of the credential
 *  through resolving the public key.
 *
 *  For example - this Driver's License is valid
 */
async function verifyCredential(req, res) {
    const body = req.body;
    const payload = body ? (typeof body === 'string' ? JSON.parse(body) : body) : {};
    const verifiedVC = await VerifiableCredentials.verifyCredential(payload.jwt, resolver);
    res.status(200).send(verifiedVC);
}
/**
 *  Takes one or more JWTs as part of a presentation and signs them
 */
async function generatePresentation(req, res) {
    const body = req.body;
    const iss = body.iss;
    const payloadRaw = body.payload;
    const payload = payloadRaw
        ? typeof payloadRaw === 'string'
            ? JSON.parse(payloadRaw)
            : payloadRaw
        : {};
    // Create a signer by using a private key (hex).
    // All the participants are using the same private key in the demo
    // Usually this key should be key secret.
    const key = body.key || '0b6366519a40eb4f384f7f84cf8bb716683ad1af8adbe60e59fe24ba042e396a';
    const signer = DIDJWTSigner.ES256KSigner(DIDJWTSigner.hexToBytes(key));
    // Prepare an issuer
    const issuer = {
        did: iss,
        signer
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vpJwt = await VerifiableCredentials.createVerifiablePresentationJwt(payload, issuer);
    res.status(200).send({ jwt: vpJwt });
}
/**
 * Takes a JSON-LD payload and generates as DID-web JWT.
 */
async function generateCredential(req, res) {
    const body = req.body;
    const vcRaw = body.vc;
    const vc = vcRaw ? (typeof vcRaw === 'string' ? JSON.parse(vcRaw) : vcRaw) : {};
    const iss = body.iss;
    const sub = body.sub;
    const type = body.claimType;
    const nbf = Number.parseInt(body.nbf, 10);
    // Create a signer by using a private key (hex).
    // All the participants are using the same private key in the demo
    // Usually this key should be key secret.
    const key = body.key || '0b6366519a40eb4f384f7f84cf8bb716683ad1af8adbe60e59fe24ba042e396a';
    const signer = DIDJWTSigner.ES256KSigner(DIDJWTSigner.hexToBytes(key));
    // Prepare an issuer
    const issuer = {
        did: iss,
        signer
    };
    // Prepare the Verifiable Credential Payload
    const vcPayload = {
        sub,
        nbf,
        vc: vc
    };
    // Create the Verifiable Credential (JWT)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vcJwt = await VerifiableCredentials.createVerifiableCredentialJwt(vcPayload, issuer);
    res.status(200).send({ jwt: vcJwt, type });
}
/**
 *  A series of credentials to be used within the tutorial.
 */
function init(req, res) {
    const CLAIMS_WEBSITE = 'https://fiware.github.io/tutorials.Step-by-Step';
    const DID_WEB_DOMAIN_NAME = 'did:web:fiware.github.io:tutorials.Step-by-Step';
    const now = new Date();
    const unixtime = Math.floor(now.getTime() / 1000);
    const claims = [
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
    const issuers = [
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
