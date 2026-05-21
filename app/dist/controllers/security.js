"use strict";
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
exports.authCodeGrant = authCodeGrant;
exports.authCodeGrantCallback = authCodeGrantCallback;
exports.implicitGrant = implicitGrant;
exports.clientCredentialGrant = clientCredentialGrant;
exports.userCredentialGrant = userCredentialGrant;
exports.refreshTokenGrant = refreshTokenGrant;
exports.authenticate = authenticate;
exports.authorizeBasicPDP = authorizeBasicPDP;
exports.authorizeKeycloakAuthz = authorizeKeycloakAuthz;
exports.logOut = logOut;
const debug_1 = __importDefault(require("debug"));
const crypto_1 = __importDefault(require("crypto"));
const keycloak = __importStar(require("../lib/keycloak"));
const debugLog = (0, debug_1.default)('tutorial:security');
const port = process.env.WEB_APP_PORT || '3000';
const SECURE_ENDPOINTS = process.env.SECURE_ENDPOINTS || false;
function storeTokens(req, tokens) {
    req.session.access_token = tokens.access_token;
    req.session.refresh_token = tokens.refresh_token || undefined;
    req.session.id_token = tokens.id_token || undefined;
    if (tokens.access_token) {
        req.session.claims = decodeJwtPayload(tokens.access_token);
    }
}
function clearSession(req) {
    req.session.access_token = undefined;
    req.session.refresh_token = undefined;
    req.session.id_token = undefined;
    req.session.claims = undefined;
    req.session.pkce_verifier = undefined;
    req.session.oauth_state = undefined;
    req.session.username = undefined;
}
// Decode a JWT payload without verifying the signature (verification is done
// either via JWKS or via introspection; this is only used to read claims that
// are already trusted because they came from a valid token exchange).
function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    }
    catch (_) {
        return null;
    }
}
function getRoles(req) {
    const claims = req.session.claims || decodeJwtPayload(req.session.access_token || '');
    const realmAccess = claims && claims.realm_access;
    return (realmAccess && realmAccess.roles) || [];
}
// ─── Grant flows ──────────────────────────────────────────────────────────────
// Initiate PKCE Authorization Code flow — redirect to Keycloak login page
function authCodeGrant(req, res) {
    debugLog('authCodeGrant');
    const verifier = keycloak.generateCodeVerifier();
    const challenge = keycloak.generateCodeChallenge(verifier);
    const state = crypto_1.default.randomBytes(16).toString('hex');
    req.session.pkce_verifier = verifier;
    req.session.oauth_state = state;
    const url = keycloak.getAuthorizeUrl(state, challenge);
    debugLog('Redirecting to Keycloak: ' + url);
    res.redirect(url);
}
// Initiate Implicit flow — redirect to Keycloak login page
function implicitGrant(req, res) {
    debugLog('implicitGrant');
    const state = crypto_1.default.randomBytes(16).toString('hex');
    req.session.oauth_state = state;
    const url = keycloak.getImplicitAuthorizeUrl(state);
    debugLog('Redirecting to Keycloak (Implicit): ' + url);
    res.redirect(url);
}
// Handle the callback from Keycloak after user authentication
function authCodeGrantCallback(req, res) {
    debugLog('authCodeGrantCallback');
    const params = req.method === 'POST' ? req.body : req.query;
    if (params.error) {
        debugLog('Auth error: ' + params.error_description);
        req.flash('error', 'Access Denied: ' + (params.error_description || params.error));
        res.redirect('/');
        return;
    }
    if (params.state !== req.session.oauth_state) {
        debugLog('Invalid OAuth state: expected ' + req.session.oauth_state + ' but got ' + params.state);
        req.flash('error', 'Invalid OAuth state — possible CSRF');
        res.redirect('/');
        return;
    }
    const code = params.code;
    const accessToken = params.access_token;
    const verifier = req.session.pkce_verifier;
    let tokenPromise;
    if (accessToken) {
        // If we have an access_token directly, this is an Implicit or Hybrid Grant
        tokenPromise = Promise.resolve({ status: 200, body: params });
    }
    else if (code && verifier) {
        // If we have a code and a verifier, this is an Authorization Code + PKCE Grant
        tokenPromise = keycloak.exchangeCode(code, verifier);
    }
    else {
        req.flash('error', 'Missing authorization code or tokens');
        res.redirect('/');
        return;
    }
    tokenPromise
        .then(({ status, body }) => {
        const tokenBody = body;
        if (status !== 200 || !tokenBody.access_token) {
            throw new Error(tokenBody.error_description || 'Token exchange failed');
        }
        storeTokens(req, tokenBody);
        return keycloak.getUserInfo(tokenBody.access_token);
    })
        .then(({ body: user }) => {
        const userObj = user;
        const username = userObj.preferred_username || userObj.sub;
        debugLog('User logged in: ' + username);
        req.session.username = username;
        req.flash('success', username + ' logged in');
        res.redirect('/');
    })
        .catch((error) => {
        debugLog(error);
        req.flash('error', 'Access Denied');
        res.redirect('/');
    });
}
// Client Credentials grant — application logs in without a user
function clientCredentialGrant(req, res) {
    debugLog('clientCredentialGrant');
    keycloak
        .getClientCredentials()
        .then(({ status, body }) => {
        const tokenBody = body;
        if (status !== 200 || !tokenBody.access_token) {
            throw new Error(tokenBody.error_description || 'Client credentials failed');
        }
        storeTokens(req, tokenBody);
        req.session.username = 'Application';
        req.flash('info', 'access_token: <code>' + tokenBody.access_token + '</code>');
        req.flash('success', 'Application logged in with <strong>Client Credentials</strong>');
        res.redirect('/');
    })
        .catch((error) => {
        debugLog(error);
        req.flash('error', 'Access Denied');
        res.redirect('/');
    });
}
// User Credentials grant — user logs in with username and password
function userCredentialGrant(req, res) {
    debugLog('userCredentialGrant');
    const body = req.body;
    const email = body.email;
    const password = body.password;
    keycloak
        .getUserCredentials(email, password)
        .then(({ status, body: responseBody }) => {
        const tokenBody = responseBody;
        if (status !== 200 || !tokenBody.access_token) {
            throw new Error(tokenBody.error_description || 'Password grant failed');
        }
        storeTokens(req, tokenBody);
        return keycloak.getUserInfo(tokenBody.access_token);
    })
        .then(({ body: user }) => {
        const userObj = user;
        const username = userObj.preferred_username || userObj.sub;
        debugLog('User logged in: ' + username);
        req.session.username = username;
        req.flash('success', username + ' logged in with <strong>Password</strong>');
        res.redirect('/');
    })
        .catch((error) => {
        debugLog(error);
        req.flash('error', 'Access Denied');
        res.redirect('/');
    });
}
// Refresh Token grant — obtain new tokens without re-authentication
function refreshTokenGrant(req, res) {
    debugLog('refreshTokenGrant');
    if (!req.session.refresh_token) {
        req.flash('error', 'No Refresh Token');
        res.redirect('/');
        return;
    }
    keycloak
        .refreshAccessToken(req.session.refresh_token)
        .then(({ status, body }) => {
        const tokenBody = body;
        if (status !== 200 || !tokenBody.access_token) {
            throw new Error(tokenBody.error_description || 'Token refresh failed');
        }
        storeTokens(req, tokenBody);
        const username = req.session.username || 'User';
        req.flash('success', username + ' <strong>refreshed token</strong>');
        req.flash('info', 'access_token: <code>' + tokenBody.access_token + '</code>');
        res.redirect('/');
    })
        .catch((error) => {
        debugLog(error);
        req.flash('error', 'Token refresh failed');
        res.redirect('/');
    });
}
// Log out — redirect to Keycloak end-session endpoint
function logOut(req, res) {
    debugLog('logOut');
    const idToken = req.session.id_token;
    const username = req.session.username;
    clearSession(req);
    if (username) {
        req.flash('success', username + ' logged out');
    }
    const postLogout = 'http://localhost:' + port + '/';
    res.redirect(keycloak.getLogoutUrl(idToken, postLogout));
}
// ─── PDP middleware ───────────────────────────────────────────────────────────
// LEVEL 1: Authentication only — any valid (non-expired) token passes.
// The JWT is decoded to populate req.session.claims; no network call needed
// because the token was issued by our Keycloak and stored server-side.
function authenticate(req, res, next) {
    debugLog('authenticate');
    if (!SECURE_ENDPOINTS) {
        res.locals.authorized = true;
        next();
        return;
    }
    if (!req.session.access_token) {
        res.locals.authorized = false;
        next();
        return;
    }
    const claims = req.session.claims || decodeJwtPayload(req.session.access_token);
    if (!claims) {
        res.locals.authorized = false;
        next();
        return;
    }
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) {
        debugLog('Token expired');
        res.locals.authorized = false;
        next();
        return;
    }
    res.locals.authorized = true;
    next();
}
// LEVEL 2: Role-based authorization — inspect realm_access.roles in the JWT.
// No network call required; roles were encoded into the token by Keycloak.
function authorizeBasicPDP(req, res, next) {
    debugLog('authorizeBasicPDP');
    if (!SECURE_ENDPOINTS) {
        res.locals.authorized = true;
        next();
        return;
    }
    if (!req.session.access_token) {
        res.locals.authorized = false;
        next();
        return;
    }
    const roles = getRoles(req);
    const method = req.method.toUpperCase();
    // farm-manager can do everything; read-only-consultant can only GET
    if (roles.includes('farm-manager')) {
        res.locals.authorized = true;
    }
    else if (method === 'GET' || method === 'HEAD') {
        res.locals.authorized = roles.length > 0;
    }
    else {
        // POST / PATCH / DELETE require a write-capable role
        res.locals.authorized =
            roles.includes('livestock-supervisor') ||
                roles.includes('crop-supervisor') ||
                roles.includes('equipment-supervisor');
    }
    next();
}
// LEVEL 3: Keycloak Authorization Services (UMA 2.0 ticket exchange).
// Calls Keycloak to evaluate a specific resource#scope permission.
function authorizeKeycloakAuthz(permission) {
    return function (req, res, next) {
        debugLog('authorizeKeycloakAuthz: ' + permission);
        if (!SECURE_ENDPOINTS) {
            res.locals.authorized = true;
            next();
            return;
        }
        if (!req.session.access_token) {
            res.locals.authorized = false;
            next();
            return;
        }
        keycloak
            .requestUmaTicket(req.session.access_token, permission)
            .then(({ status }) => {
            res.locals.authorized = status === 200;
            next();
        })
            .catch((error) => {
            debugLog(error);
            res.locals.authorized = false;
            next();
        });
    };
}
