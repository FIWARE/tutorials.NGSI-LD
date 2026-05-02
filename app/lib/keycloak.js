const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const querystring = require('querystring');

const issuer = process.env.OIDC_ISSUER || 'http://keycloak:8080/realms/farm-management';
const keycloakUrl = process.env.KEYCLOAK_URL || issuer;
const clientId = process.env.OIDC_CLIENT_ID || 'ngsi-ld-farm';
const clientSecret = process.env.OIDC_CLIENT_SECRET || '1234';
const redirectUri = process.env.OIDC_REDIRECT_URI || 'http://localhost:3000/login/callback';
const scope = process.env.OIDC_SCOPE || 'openid profile email';

const tokenEndpoint = issuer + '/protocol/openid-connect/token';
const authEndpoint = keycloakUrl + '/protocol/openid-connect/auth';
const userInfoEndpoint = issuer + '/protocol/openid-connect/userinfo';
const introspectEndpoint = issuer + '/protocol/openid-connect/token/introspect';
const endSessionEndpoint = keycloakUrl + '/protocol/openid-connect/logout';
const jwksEndpoint = issuer + '/protocol/openid-connect/certs';

function post(url, body, extraHeaders) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : http;
        const headers = Object.assign(
            {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            },
            extraHeaders || {}
        );
        const req = lib.request(
            {
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname + parsed.search,
                method: 'POST',
                headers
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } catch (_) {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function get(url, accessToken) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.request(
            {
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname + parsed.search,
                method: 'GET',
                headers: { Authorization: 'Bearer ' + accessToken }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } catch (_) {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            }
        );
        req.on('error', reject);
        req.end();
    });
}

// PKCE helpers

function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Build the authorization redirect URL (PKCE Authorization Code flow)
function getAuthorizeUrl(state, codeChallenge) {
    return (
        authEndpoint +
        '?response_type=code' +
        '&client_id=' +
        encodeURIComponent(clientId) +
        '&redirect_uri=' +
        encodeURIComponent(redirectUri) +
        '&scope=' +
        encodeURIComponent(scope) +
        '&state=' +
        encodeURIComponent(state) +
        '&code_challenge=' +
        encodeURIComponent(codeChallenge) +
        '&code_challenge_method=S256'
    );
}

// Build the authorization redirect URL (Implicit flow)
function getImplicitAuthorizeUrl(state) {
    return (
        authEndpoint +
        '?response_type=id_token token' +
        '&client_id=' +
        encodeURIComponent(clientId) +
        '&redirect_uri=' +
        encodeURIComponent(redirectUri) +
        '&scope=' +
        encodeURIComponent(scope) +
        '&state=' +
        encodeURIComponent(state) +
        '&response_mode=form_post' +
        '&nonce=' +
        crypto.randomBytes(16).toString('hex')
    );
}

// Exchange authorization code + PKCE verifier for tokens
function exchangeCode(code, codeVerifier) {
    const body = querystring.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier
    });
    return post(tokenEndpoint, body);
}

// Client Credentials grant (machine-to-machine)
function getClientCredentials() {
    const body = querystring.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
    });
    return post(tokenEndpoint, body);
}

// Refresh Token grant
function refreshAccessToken(refreshToken) {
    const body = querystring.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
    });
    return post(tokenEndpoint, body);
}

// User Credentials grant (password flow)
function getUserCredentials(username, password) {
    const body = querystring.stringify({
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password,
        scope
    });
    return post(tokenEndpoint, body);
}

// OIDC UserInfo endpoint
function getUserInfo(accessToken) {
    return get(userInfoEndpoint, accessToken);
}

// Server-side token introspection
function introspectToken(token) {
    const body = querystring.stringify({
        token,
        client_id: clientId,
        client_secret: clientSecret
    });
    return post(introspectEndpoint, body);
}

// UMA 2.0 ticket — Keycloak Authorization Services (Level 3 PDP)
function requestUmaTicket(accessToken, permission) {
    const body = querystring.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
        client_id: clientId,
        client_secret: clientSecret,
        audience: clientId,
        permission
    });
    return post(tokenEndpoint, body, { Authorization: 'Bearer ' + accessToken });
}

// Build Keycloak end-session URL
function getLogoutUrl(idToken, postLogoutRedirectUri) {
    let url = endSessionEndpoint + '?client_id=' + encodeURIComponent(clientId);
    if (idToken) {
        url += '&id_token_hint=' + encodeURIComponent(idToken);
    }
    if (postLogoutRedirectUri) {
        url += '&post_logout_redirect_uri=' + encodeURIComponent(postLogoutRedirectUri);
    }
    return url;
}

module.exports = {
    generateCodeVerifier,
    generateCodeChallenge,
    getAuthorizeUrl,
    getImplicitAuthorizeUrl,
    exchangeCode,
    getClientCredentials,
    getUserCredentials,
    refreshAccessToken,
    getUserInfo,
    introspectToken,
    requestUmaTicket,
    getLogoutUrl,
    jwksEndpoint,
    issuer,
    clientId
};
