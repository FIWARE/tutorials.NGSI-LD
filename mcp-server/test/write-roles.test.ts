import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Session } from '../lib/session';

const TOKEN_URL = 'http://keycloak:8080/realms/farm-management/protocol/openid-connect/token';

const as = (username: string, roles: string[]): Session => ({
    token: `${username}-token`,
    sub: username,
    username,
    roles,
    scopes: ['openid']
});

const bob = as('bob', ['farm-manager']);
const carol = as('carol', ['livestock-supervisor']);
const jenny = as('jenny', ['read-only-consultant']);

async function load(writeRoles?: string) {
    vi.resetModules();
    vi.stubEnv('AUTH_ENABLED', 'true');
    vi.stubEnv('OIDC_ISSUER', 'http://keycloak:8080/realms/farm-management');
    if (writeRoles !== undefined) vi.stubEnv('WRITE_ROLES', writeRoles);
    return { util: await import('../controllers/tools/util'), session: await import('../lib/session') };
}

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL) => {
            if (String(input) === TOKEN_URL) {
                return new Response(JSON.stringify({ access_token: 'service-token', expires_in: 300 }), {
                    status: 200
                });
            }
            const id = decodeURIComponent(String(input).split('/entities/')[1]?.split('?')[0] ?? '');
            return new Response(JSON.stringify({ id, type: id.split(':')[2] }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            });
        })
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('WRITE_ROLES', () => {
    it('gives the write tools to full and partial writers only', async () => {
        const { util } = await load();
        expect(util.canWrite(bob)).toBe(true);
        expect(util.canWrite(carol)).toBe(true);
        expect(util.canWrite(jenny)).toBe(false);
    });

    it('leaves an unrestricted role able to write every type', async () => {
        const { util } = await load();
        expect(util.writableTypes(bob)).toBeNull();
        expect(util.writableTypes(as('both', ['livestock-supervisor', 'farm-manager']))).toBeNull();
    });

    it('limits a partial role to its listed types', async () => {
        const { util } = await load('farm-manager,livestock-supervisor:Animal|Water,crop-supervisor:AgriParcel');
        expect([...util.writableTypes(carol)!]).toEqual(['Animal', 'Water']);
        expect([...util.writableTypes(as('dual', ['livestock-supervisor', 'crop-supervisor']))!]).toEqual([
            'Animal',
            'Water',
            'AgriParcel'
        ]);
    });

    it('refuses a partial writer on a type outside its list, reading the type from the broker', async () => {
        const { util, session } = await load();
        const check = (id: string, type?: string) =>
            session.withSession(async () => util.typeDenied(id, type))({}, { session: carol });

        expect(await check('urn:ngsi-ld:Animal:cow001')).toBeNull();
        expect((await check('urn:ngsi-ld:AgriParcel:new', 'AgriParcel'))?.isError).toBe(true);
        const denied = await check('urn:ngsi-ld:AgriParcel:wheatfield');
        expect(denied?.isError).toBe(true);
        expect(denied?.structuredContent).toMatchObject({ status: 403, category: 'auth' });
    });

    it('never looks the type up for an unrestricted writer', async () => {
        const { util, session } = await load();
        const denied = await session.withSession(async () => util.typeDenied('urn:ngsi-ld:AgriParcel:wheatfield'))(
            {},
            { session: bob }
        );
        expect(denied).toBeNull();
        expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });
});
