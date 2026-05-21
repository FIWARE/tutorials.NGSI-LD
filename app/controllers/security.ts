import debug from 'debug';
import crypto from 'crypto';
import * as keycloak from '../lib/keycloak';
import { Request, Response, NextFunction } from 'express';

const debugLog = debug('tutorial:security');

const port = process.env.WEB_APP_PORT || '3000';
const SECURE_ENDPOINTS = process.env.SECURE_ENDPOINTS || false;

// ─── Session helpers ──────────────────────────────────────────────────────────

interface TokenSet {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    [key: string]: unknown;
}

function storeTokens(req: Request, tokens: TokenSet): void {
    req.session.access_token = tokens.access_token;
    req.session.refresh_token = tokens.refresh_token || undefined;
    req.session.id_token = tokens.id_token || undefined;
    if (tokens.access_token) {
        req.session.claims = decodeJwtPayload(tokens.access_token);
    }
}

function clearSession(req: Request): void {
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
function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    } catch (_) {
        return null;
    }
}

function getRoles(req: Request): string[] {
    const claims = req.session.claims || decodeJwtPayload(req.session.access_token || '');
    const realmAccess = claims && (claims.realm_access as { roles?: string[] } | undefined);
    return (realmAccess && realmAccess.roles) || [];
}

// ─── Grant flows ──────────────────────────────────────────────────────────────

// Initiate PKCE Authorization Code flow — redirect to Keycloak login page
function authCodeGrant(req: Request, res: Response): void {
    debugLog('authCodeGrant');
    const verifier = keycloak.generateCodeVerifier();
    const challenge = keycloak.generateCodeChallenge(verifier);
    const state = crypto.randomBytes(16).toString('hex');

    req.session.pkce_verifier = verifier;
    req.session.oauth_state = state;

    const url = keycloak.getAuthorizeUrl(state, challenge);
    debugLog('Redirecting to Keycloak: ' + url);
    res.redirect(url);
}

// Initiate Implicit flow — redirect to Keycloak login page
function implicitGrant(req: Request, res: Response): void {
    debugLog('implicitGrant');
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauth_state = state;

    const url = keycloak.getImplicitAuthorizeUrl(state);
    debugLog('Redirecting to Keycloak (Implicit): ' + url);
    res.redirect(url);
}

// Handle the callback from Keycloak after user authentication
function authCodeGrantCallback(req: Request, res: Response): void {
    debugLog('authCodeGrantCallback');
    const params = req.method === 'POST' ? (req.body as Record<string, string>) : (req.query as Record<string, string>);

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

    let tokenPromise: Promise<{ status: number | undefined; body: unknown }>;

    if (accessToken) {
        // If we have an access_token directly, this is an Implicit or Hybrid Grant
        tokenPromise = Promise.resolve({ status: 200, body: params });
    } else if (code && verifier) {
        // If we have a code and a verifier, this is an Authorization Code + PKCE Grant
        tokenPromise = keycloak.exchangeCode(code, verifier);
    } else {
        req.flash('error', 'Missing authorization code or tokens');
        res.redirect('/');
        return;
    }

    tokenPromise
        .then(({ status, body }) => {
            const tokenBody = body as TokenSet;
            if (status !== 200 || !tokenBody.access_token) {
                throw new Error((tokenBody.error_description as string) || 'Token exchange failed');
            }
            storeTokens(req, tokenBody);
            return keycloak.getUserInfo(tokenBody.access_token as string);
        })
        .then(({ body: user }) => {
            const userObj = user as Record<string, unknown>;
            const username = (userObj.preferred_username as string) || (userObj.sub as string);
            debugLog('User logged in: ' + username);
            req.session.username = username;
            req.flash('success', username + ' logged in');
            res.redirect('/');
        })
        .catch((error: Error) => {
            debugLog(error);
            req.flash('error', 'Access Denied');
            res.redirect('/');
        });
}

// Client Credentials grant — application logs in without a user
function clientCredentialGrant(req: Request, res: Response): void {
    debugLog('clientCredentialGrant');

    keycloak
        .getClientCredentials()
        .then(({ status, body }) => {
            const tokenBody = body as TokenSet;
            if (status !== 200 || !tokenBody.access_token) {
                throw new Error((tokenBody.error_description as string) || 'Client credentials failed');
            }
            storeTokens(req, tokenBody);
            req.session.username = 'Application';
            req.flash('info', 'access_token: <code>' + tokenBody.access_token + '</code>');
            req.flash('success', 'Application logged in with <strong>Client Credentials</strong>');
            res.redirect('/');
        })
        .catch((error: Error) => {
            debugLog(error);
            req.flash('error', 'Access Denied');
            res.redirect('/');
        });
}

// User Credentials grant — user logs in with username and password
function userCredentialGrant(req: Request, res: Response): void {
    debugLog('userCredentialGrant');
    const body = req.body as { email: string; password: string };
    const email = body.email;
    const password = body.password;

    keycloak
        .getUserCredentials(email, password)
        .then(({ status, body: responseBody }) => {
            const tokenBody = responseBody as TokenSet;
            if (status !== 200 || !tokenBody.access_token) {
                throw new Error((tokenBody.error_description as string) || 'Password grant failed');
            }
            storeTokens(req, tokenBody);
            return keycloak.getUserInfo(tokenBody.access_token as string);
        })
        .then(({ body: user }) => {
            const userObj = user as Record<string, unknown>;
            const username = (userObj.preferred_username as string) || (userObj.sub as string);
            debugLog('User logged in: ' + username);
            req.session.username = username;
            req.flash('success', username + ' logged in with <strong>Password</strong>');
            res.redirect('/');
        })
        .catch((error: Error) => {
            debugLog(error);
            req.flash('error', 'Access Denied');
            res.redirect('/');
        });
}

// Refresh Token grant — obtain new tokens without re-authentication
function refreshTokenGrant(req: Request, res: Response): void {
    debugLog('refreshTokenGrant');

    if (!req.session.refresh_token) {
        req.flash('error', 'No Refresh Token');
        res.redirect('/');
        return;
    }

    keycloak
        .refreshAccessToken(req.session.refresh_token)
        .then(({ status, body }) => {
            const tokenBody = body as TokenSet;
            if (status !== 200 || !tokenBody.access_token) {
                throw new Error((tokenBody.error_description as string) || 'Token refresh failed');
            }
            storeTokens(req, tokenBody);
            const username = req.session.username || 'User';
            req.flash('success', username + ' <strong>refreshed token</strong>');
            req.flash('info', 'access_token: <code>' + tokenBody.access_token + '</code>');
            res.redirect('/');
        })
        .catch((error: Error) => {
            debugLog(error);
            req.flash('error', 'Token refresh failed');
            res.redirect('/');
        });
}

// Log out — redirect to Keycloak end-session endpoint
function logOut(req: Request, res: Response): void {
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
function authenticate(req: Request, res: Response, next: NextFunction): void {
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
    if ((claims.exp as number) && (claims.exp as number) < now) {
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
function authorizeBasicPDP(req: Request, res: Response, next: NextFunction): void {
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
    } else if (method === 'GET' || method === 'HEAD') {
        res.locals.authorized = roles.length > 0;
    } else {
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
function authorizeKeycloakAuthz(permission: string) {
    return function (req: Request, res: Response, next: NextFunction): void {
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
            .catch((error: Error) => {
                debugLog(error);
                res.locals.authorized = false;
                next();
            });
    };
}

export {
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
