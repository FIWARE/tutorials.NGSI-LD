/*import { JwtCredentialPayload, createVerifiableCredentialJwt } from 'did-jwt-vc';
import { ES256KSigner, hexToBytes } from 'did-jwt';
import {
    createVerifiableCredentialJwt,
    createVerifiablePresentationJwt,
    verifyCredential,
    verifyPresentation
} from 'did-jwt-vc';
import { Resolver } from 'did-resolver';
import { getResolver } from 'web-did-resolver';*/

const VerifiableCredentials = require('did-jwt-vc');
const DIDJWTSigner = require('did-jwt');
const DIDResolver = require('did-resolver');
const WebDIDResolver = require('web-did-resolver');
const debug = require('debug')('tutorial:credentials');

function catchErrors(fn) {
    return (req, res, next) => {
        return fn(req, res, next).catch((e) => {
            debug(e.message);
            return res.status(400).send({
                type: 'https://uri.etsi.org/ngsi-ld/errors/BadRequestData',
                title: e.name,
                detail: e.message
            });
        });
    };
}

async function verifyPresentation(req, res) {
    const payload = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body.payload) : req.body) : {};
    const resolver = new DIDResolver.Resolver(WebDIDResolver.getResolver());
    const verifiedVP = await VerifiableCredentials.verifyPresentation(payload.jwt, resolver);
    res.status(200).send(verifiedVP);
}

async function generatePresentation(req, res) {
    const iss = req.body.iss;
    const payload = req.body.payload
        ? typeof req.body.payload === 'string'
            ? JSON.parse(req.body.payload)
            : req.body.payload
        : {};
    // Create a signer by using a private key (hex).
    // All the participants are using the same private key in the demo
    // Usually this key should be key secret.
    const key = '0b6366519a40eb4f384f7f84cf8bb716683ad1af8adbe60e59fe24ba042e396a';
    const signer = DIDJWTSigner.ES256KSigner(DIDJWTSigner.hexToBytes(key));

    // Prepare an issuer
    const issuer = {
        did: iss,
        signer
    };

    const vpJwt = await VerifiableCredentials.createVerifiablePresentationJwt(payload, issuer);
    res.status(200).send({ jwt: vpJwt });
}

async function generateCredential(req, res) {
    const vc = req.body.vc ? (typeof req.body.vc === 'string' ? JSON.parse(req.body.vc) : req.body.vc) : {};
    const iss = req.body.iss;
    const sub = req.body.sub;
    const type = req.body.claimType;
    const nbf = Number.parseInt(req.body.nbf, 10);
    // Create a signer by using a private key (hex).
    // All the participants are using the same private key in the demo
    // Usually this key should be key secret.
    const key = '0b6366519a40eb4f384f7f84cf8bb716683ad1af8adbe60e59fe24ba042e396a';
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
        vc
    };

    // Create the Verifiable Credential (JWT)
    const vcJwt = await VerifiableCredentials.createVerifiableCredentialJwt(vcPayload, issuer);

    res.status(200).send({ jwt: vcJwt, type });
}

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

module.exports = {
    init,
    generateCredential,
    generatePresentation,
    verifyPresentation,
    catchErrors
};
