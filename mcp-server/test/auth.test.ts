import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair, type KeyLike } from 'jose';
import type { IncomingMessage } from 'node:http';

const ISSUER = 'http://keycloak:8080/realms/farm-management';
const TOKEN_URL = `${ISSUER}/protocol/openid-connect/token`;

// jose fetches a remote JWKS over its own HTTP client, not the global fetch, so the
// key set is served locally instead. Everything else about verification is real.
const signing = vi.hoisted(() => ({ jwks: { keys: [] as Record<string, unknown>[] } }));

vi.mock('jose', async (importOriginal) => {
    const actual = await importOriginal<typeof import('jose')>();
    return { ...actual, createRemoteJWKSet: () => actual.createLocalJWKSet(signing.jwks) };
});

let keys: { publicKey: KeyLike; privateKey: KeyLike };

async function sign(claims: Record<string, unknown>, issuer = ISSUER): Promise<string> {
    return new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(keys.privateKey);
}

function request(token?: string): IncomingMessage {
    return { headers: token ? { authorization: `Bearer ${token}` } : {} } as IncomingMessage;
}

// The module reads its configuration at import time, so each test imports a fresh
// copy under the environment it needs.
async function loadAuth() {
    vi.resetModules();
    vi.stubEnv('AUTH_ENABLED', 'true');
    vi.stubEnv('OIDC_ISSUER', ISSUER);
    vi.stubEnv('OIDC_CLIENT_ID', 'ngsi-ld-mcp-server');
    vi.stubEnv('OIDC_CLIENT_SECRET', '1234');
    return import('../lib/auth');
}

beforeEach(async () => {
    keys = await generateKeyPair('RS256');
    signing.jwks = {
        keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }]
    };
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL) => {
            if (String(input) === TOKEN_URL) {
                return new Response(JSON.stringify({ access_token: 'service-token', expires_in: 300 }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                });
            }
            return new Response('not found', { status: 404 });
        })
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('verifyBearer', () => {
    it('returns a session carrying the realm roles', async () => {
        const { verifyBearer } = await loadAuth();
        const token = await sign({
            sub: 'user-1',
            preferred_username: 'bob',
            scope: 'openid profile',
            realm_access: { roles: ['farm-manager', 'offline_access'] }
        });

        const session = await verifyBearer(request(token));

        expect(session).toMatchObject({
            token,
            sub: 'user-1',
            username: 'bob',
            roles: ['farm-manager', 'offline_access'],
            scopes: ['openid', 'profile']
        });
    });

    it('rejects a token from another issuer', async () => {
        const { verifyBearer } = await loadAuth();
        const token = await sign({ sub: 'user-1' }, 'http://evil.example/realms/other');

        expect(await verifyBearer(request(token))).toBeUndefined();
    });

    it('rejects a token signed by an unknown key', async () => {
        const { verifyBearer } = await loadAuth();
        const other = await generateKeyPair('RS256');
        const token = await new SignJWT({ sub: 'user-1' })
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setIssuer(ISSUER)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(other.privateKey);

        expect(await verifyBearer(request(token))).toBeUndefined();
    });

    it('rejects a request with no Authorization header', async () => {
        const { verifyBearer } = await loadAuth();
        expect(await verifyBearer(request())).toBeUndefined();
    });

    it('falls back to no roles when the token carries none', async () => {
        const { verifyBearer } = await loadAuth();
        const token = await sign({ sub: 'user-2' });

        const session = await verifyBearer(request(token));

        expect(session?.roles).toEqual([]);
        expect(session?.username).toBe('user-2');
    });
});

describe('serviceToken', () => {
    it('fetches once and reuses the cached token', async () => {
        const { serviceToken } = await loadAuth();

        expect(await serviceToken()).toBe('service-token');
        expect(await serviceToken()).toBe('service-token');
        expect(vi.mocked(fetch).mock.calls.filter(([u]) => String(u) === TOKEN_URL)).toHaveLength(1);
    });

    it('returns undefined when the grant is refused', async () => {
        const { serviceToken } = await loadAuth();
        vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 401 }));

        expect(await serviceToken()).toBeUndefined();
    });

    it('returns undefined when auth is off', async () => {
        vi.resetModules();
        vi.stubEnv('AUTH_ENABLED', 'false');
        const { serviceToken } = await import('../lib/auth');

        expect(await serviceToken()).toBeUndefined();
        expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });
});
