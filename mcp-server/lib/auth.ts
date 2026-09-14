// OAuth 2.0 bearer token handling. The gateway already rejects an unsigned token, but this
// server verifies it again — it needs the claims for per-tool authorization the gateway can't see.

import debug from 'debug';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { IncomingMessage } from 'node:http';
import {
    AUTH_ENABLED,
    OIDC_AUDIENCE,
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
    OIDC_ISSUER,
    OIDC_JWKS_URI,
    OIDC_TOKEN_URL
} from './constants';
import type { Session } from './session';

const log = debug('mcp:auth');

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function keys(): ReturnType<typeof createRemoteJWKSet> {
    if (!jwks) {
        jwks = createRemoteJWKSet(new URL(OIDC_JWKS_URI));
    }
    return jwks;
}

function bearer(request: IncomingMessage | undefined): string | undefined {
    const header = request?.headers?.authorization;
    const match = /^Bearer\s+(.+)$/i.exec(Array.isArray(header) ? header[0] : header || '');
    return match ? match[1].trim() : undefined;
}

interface TokenClaims {
    sub?: string;
    preferred_username?: string;
    scope?: string;
    roles?: string[];
    realm_access?: { roles?: string[] };
}

// fastmcp's `authenticate` hook. Returning undefined makes it answer 401, which is
// what sends a client to the protected-resource metadata to find the OIDC provider.
export async function verifyBearer(request: IncomingMessage | undefined): Promise<Session | undefined> {
    const token = bearer(request);
    if (!token) {
        log('no bearer token');
        return undefined;
    }
    try {
        const { payload } = await jwtVerify(token, keys(), {
            issuer: OIDC_ISSUER,
            ...(OIDC_AUDIENCE ? { audience: OIDC_AUDIENCE } : {})
        });
        const claims = payload as TokenClaims;
        const session: Session = {
            token,
            sub: claims.sub || '',
            username: claims.preferred_username || claims.sub || 'unknown',
            roles: claims.roles || claims.realm_access?.roles || [],
            scopes: (claims.scope || '').split(' ').filter(Boolean)
        };
        log('%s authenticated, roles [%s]', session.username, session.roles.join(', '));
        return session;
    } catch (err) {
        log('token rejected: %s', (err as Error).message);
        return undefined;
    }
}

// --- service account ------------------------------------------------------
// Start-up discovery and stdio runs have no caller to borrow a token from.

let cached: { token: string; expires: number } | undefined;

export async function serviceToken(): Promise<string | undefined> {
    if (!AUTH_ENABLED || !OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET) {
        return undefined;
    }
    if (cached && Date.now() < cached.expires) {
        return cached.token;
    }
    try {
        const response = await fetch(OIDC_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: OIDC_CLIENT_ID,
                client_secret: OIDC_CLIENT_SECRET
            }).toString()
        });
        if (!response.ok) {
            log('client_credentials grant failed: %d', response.status);
            return undefined;
        }
        const body = (await response.json()) as { access_token?: string; expires_in?: number };
        if (!body.access_token) {
            return undefined;
        }
        // Renew early so a call never races the expiry.
        cached = { token: body.access_token, expires: Date.now() + ((body.expires_in || 300) - 30) * 1000 };
        log('service account token obtained, valid %ds', body.expires_in || 300);
        return cached.token;
    } catch (err) {
        log('client_credentials grant failed: %s', (err as Error).message);
        return undefined;
    }
}

export function resetServiceToken(): void {
    cached = undefined;
}
