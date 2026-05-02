const debug = require('debug')('tutorial:security');
const keycloak = require('../lib/keycloak');

const port = process.env.WEB_APP_PORT || '3000';
const SECURE_ENDPOINTS = process.env.SECURE_ENDPOINTS || false;

// ─── Session helpers ──────────────────────────────────────────────────────────

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
    } catch (_) {
        return null;
    }
}

function getRoles(req) {
    const claims = req.session.claims || decodeJwtPayload(req.session.access_token);
    return (claims && claims.realm_access && claims.realm_access.roles) || [];
}

// ─── Grant flows ──────────────────────────────────────────────────────────────

// Initiate PKCE Authorization Code flow — redirect to Keycloak login page
function authCodeGrant(req, res) {
    debug('authCodeGrant');
    const verifier = keycloak.generateCodeVerifier();
    const challenge = keycloak.generateCodeChallenge(verifier);
    const state = require('crypto').randomBytes(16).toString('hex');

    req.session.pkce_verifier = verifier;
    req.session.oauth_state = state;

    const url = keycloak.getAuthorizeUrl(state, challenge);
    debug('Redirecting to Keycloak: ' + url);
    return res.redirect(url);
}

// Initiate Implicit flow — redirect to Keycloak login page
function implicitGrant(req, res) {
    debug('implicitGrant');
    const state = require('crypto').randomBytes(16).toString('hex');
    req.session.oauth_state = state;

    const url = keycloak.getImplicitAuthorizeUrl(state);
    debug('Redirecting to Keycloak (Implicit): ' + url);
    return res.redirect(url);
}

// Handle the callback from Keycloak after user authentication
function authCodeGrantCallback(req, res) {
    debug('authCodeGrantCallback');
    const params = req.method === 'POST' ? req.body : req.query;

    if (params.error) {
        debug('Auth error: ' + params.error_description);
        req.flash('error', 'Access Denied: ' + (params.error_description || params.error));
        return res.redirect('/');
    }

    if (params.state !== req.session.oauth_state) {
        debug('Invalid OAuth state: expected ' + req.session.oauth_state + ' but got ' + params.state);
        req.flash('error', 'Invalid OAuth state — possible CSRF');
        return res.redirect('/');
    }

    const code = params.code;
    const accessToken = params.access_token;
    const verifier = req.session.pkce_verifier;

    let tokenPromise;

    if (accessToken) {
        // If we have an access_token directly, this is an Implicit or Hybrid Grant
        tokenPromise = Promise.resolve({ status: 200, body: params });
    } else if (code && verifier) {
        // If we have a code and a verifier, this is an Authorization Code + PKCE Grant
        tokenPromise = keycloak.exchangeCode(code, verifier);
    } else {
        req.flash('error', 'Missing authorization code or tokens');
        return res.redirect('/');
    }

    return tokenPromise
        .then(({ status, body }) => {
            if (status !== 200 || !body.access_token) {
                throw new Error(body.error_description || 'Token exchange failed');
            }
            storeTokens(req, body);
            return keycloak.getUserInfo(body.access_token);
        })
        .then(({ body: user }) => {
            const username = user.preferred_username || user.sub;
            debug('User logged in: ' + username);
            req.session.username = username;
            req.flash('success', username + ' logged in');
            return res.redirect('/');
        })
        .catch((error) => {
            debug(error);
            req.flash('error', 'Access Denied');
            return res.redirect('/');
        });
}

// Client Credentials grant — application logs in without a user
function clientCredentialGrant(req, res) {
    debug('clientCredentialGrant');

    keycloak
        .getClientCredentials()
        .then(({ status, body }) => {
            if (status !== 200 || !body.access_token) {
                throw new Error(body.error_description || 'Client credentials failed');
            }
            storeTokens(req, body);
            req.session.username = 'Application';
            req.flash('info', 'access_token: <code>' + body.access_token + '</code>');
            req.flash('success', 'Application logged in with <strong>Client Credentials</strong>');
            return res.redirect('/');
        })
        .catch((error) => {
            debug(error);
            req.flash('error', 'Access Denied');
            return res.redirect('/');
        });
}

// User Credentials grant — user logs in with username and password
function userCredentialGrant(req, res) {
    debug('userCredentialGrant');
    const email = req.body.email;
    const password = req.body.password;

    keycloak
        .getUserCredentials(email, password)
        .then(({ status, body }) => {
            if (status !== 200 || !body.access_token) {
                throw new Error(body.error_description || 'Password grant failed');
            }
            storeTokens(req, body);
            return keycloak.getUserInfo(body.access_token);
        })
        .then(({ body: user }) => {
            const username = user.preferred_username || user.sub;
            debug('User logged in: ' + username);
            req.session.username = username;
            req.flash('success', username + ' logged in with <strong>Password</strong>');
            return res.redirect('/');
        })
        .catch((error) => {
            debug(error);
            req.flash('error', 'Access Denied');
            return res.redirect('/');
        });
}

// Refresh Token grant — obtain new tokens without re-authentication
function refreshTokenGrant(req, res) {
    debug('refreshTokenGrant');

    if (!req.session.refresh_token) {
        req.flash('error', 'No Refresh Token');
        return res.redirect('/');
    }

    return keycloak
        .refreshAccessToken(req.session.refresh_token)
        .then(({ status, body }) => {
            if (status !== 200 || !body.access_token) {
                throw new Error(body.error_description || 'Token refresh failed');
            }
            storeTokens(req, body);
            const username = req.session.username || 'User';
            req.flash('success', username + ' <strong>refreshed token</strong>');
            req.flash('info', 'access_token: <code>' + body.access_token + '</code>');
            return res.redirect('/');
        })
        .catch((error) => {
            debug(error);
            req.flash('error', 'Token refresh failed');
            return res.redirect('/');
        });
}

// Log out — redirect to Keycloak end-session endpoint
function logOut(req, res) {
    debug('logOut');
    const idToken = req.session.id_token;
    const username = req.session.username;
    clearSession(req);
    if (username) {
        req.flash('success', username + ' logged out');
    }
    const postLogout = 'http://localhost:' + port + '/';
    return res.redirect(keycloak.getLogoutUrl(idToken, postLogout));
}

// ─── PDP middleware ───────────────────────────────────────────────────────────

// LEVEL 1: Authentication only — any valid (non-expired) token passes.
// The JWT is decoded to populate req.session.claims; no network call needed
// because the token was issued by our Keycloak and stored server-side.
function authenticate(req, res, next) {
    debug('authenticate');

    if (!SECURE_ENDPOINTS) {
        res.locals.authorized = true;
        return next();
    }

    if (!req.session.access_token) {
        res.locals.authorized = false;
        return next();
    }

    const claims = req.session.claims || decodeJwtPayload(req.session.access_token);

    if (!claims) {
        res.locals.authorized = false;
        return next();
    }

    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) {
        debug('Token expired');
        res.locals.authorized = false;
        return next();
    }

    res.locals.authorized = true;
    return next();
}

// LEVEL 2: Role-based authorization — inspect realm_access.roles in the JWT.
// No network call required; roles were encoded into the token by Keycloak.
function authorizeBasicPDP(req, res, next) {
    debug('authorizeBasicPDP');

    if (!SECURE_ENDPOINTS) {
        res.locals.authorized = true;
        return next();
    }

    if (!req.session.access_token) {
        res.locals.authorized = false;
        return next();
    }

    const roles = getRoles(req);
    const method = req.method.toUpperCase();

    // farm-manager can do everything; read-only-consultant can only GET
    if (roles.includes('farm-manager')) {
        res.locals.authorized = true;
    } else if (method === 'GET' || method === 'HEAD') {
        res.locals.authorized = roles.length > 0;
    } else {
        // POST / PATCH / DELETE require a write-capable role
        res.locals.authorized =
            roles.includes('livestock-supervisor') ||
            roles.includes('crop-supervisor') ||
            roles.includes('equipment-supervisor');
    }

    return next();
}

// LEVEL 3: Keycloak Authorization Services (UMA 2.0 ticket exchange).
// Calls Keycloak to evaluate a specific resource#scope permission.
function authorizeKeycloakAuthz(permission) {
    return function (req, res, next) {
        debug('authorizeKeycloakAuthz: ' + permission);

        if (!SECURE_ENDPOINTS) {
            res.locals.authorized = true;
            return next();
        }

        if (!req.session.access_token) {
            res.locals.authorized = false;
            return next();
        }

        return keycloak
            .requestUmaTicket(req.session.access_token, permission)
            .then(({ status }) => {
                res.locals.authorized = status === 200;
                return next();
            })
            .catch((error) => {
                debug(error);
                res.locals.authorized = false;
                return next();
            });
    };
}

module.exports = {
    authCodeGrant,
    authCodeGrantCallback,
    implicitGrant,
    clientCredentialGrant,
    userCredentialGrant,
    refreshTokenGrant,
    authenticate,
    authorizeBasicPDP,
    authorizeKeycloakAuthz,
    logOut
};
