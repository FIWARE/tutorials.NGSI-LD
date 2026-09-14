import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Session } from '../lib/session';

const TOKEN_URL = 'http://keycloak:8080/realms/farm-management/protocol/openid-connect/token';

const bob: Session = {
    token: 'bobs-token',
    sub: 'user-1',
    username: 'bob',
    roles: ['farm-manager'],
    scopes: ['openid']
};

function authHeader(call: number): string | undefined {
    const init = vi.mocked(fetch).mock.calls[call]?.[1] as { headers?: Record<string, string> };
    return init?.headers?.Authorization;
}

async function loadWithAuth() {
    vi.resetModules();
    vi.stubEnv('AUTH_ENABLED', 'true');
    vi.stubEnv('OIDC_ISSUER', 'http://keycloak:8080/realms/farm-management');
    vi.stubEnv('OIDC_CLIENT_ID', 'ngsi-ld-mcp-server');
    vi.stubEnv('OIDC_CLIENT_SECRET', '1234');
    return { ngsi: await import('../lib/ngsi-ld'), session: await import('../lib/session') };
}

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL) => {
            if (String(input) === TOKEN_URL) {
                return new Response(JSON.stringify({ access_token: 'service-token', expires_in: 300 }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                });
            }
            return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
        })
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('token propagation', () => {
    it("forwards the caller's own token to the broker", async () => {
        const { ngsi, session } = await loadWithAuth();

        await session.withSession(async () => ngsi.listTypes(true))({}, { session: bob });

        expect(authHeader(0)).toBe('Bearer bobs-token');
    });

    it('falls back to the service account when there is no caller', async () => {
        const { ngsi } = await loadWithAuth();

        await ngsi.listTypes(true);

        // The client_credentials grant first, then the broker call carrying it.
        expect(vi.mocked(fetch).mock.calls[0][0]).toBe(TOKEN_URL);
        expect(authHeader(1)).toBe('Bearer service-token');
    });

    it('keeps one caller out of another call', async () => {
        const { ngsi, session } = await loadWithAuth();
        const alice: Session = { ...bob, token: 'alices-token', username: 'alice' };

        await Promise.all([
            session.withSession(async () => ngsi.listTypes(true))({}, { session: bob }),
            session.withSession(async () => ngsi.listTypes(true))({}, { session: alice })
        ]);

        expect([authHeader(0), authHeader(1)].sort()).toEqual(['Bearer alices-token', 'Bearer bobs-token']);
    });

    it('sends no Authorization header when auth is off', async () => {
        vi.resetModules();
        vi.stubEnv('AUTH_ENABLED', 'false');
        const ngsi = await import('../lib/ngsi-ld');

        await ngsi.listTypes(true);

        expect(authHeader(0)).toBeUndefined();
    });
});
