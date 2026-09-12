// Fetch wrappers around the NGSI-LD Context Broker. Paths, params, headers and
// status codes follow the NGSI-LD API.

import debug from 'debug';
import {
    CONTEXT_BROKER,
    TEMPORAL_BROKER,
    LinkHeader,
    READ_TENANT,
    WRITE_TENANT,
    WRITE_LOCAL_ONLY,
    TEMPORAL_TENANT,
    SEND_PICK_AS_ATTRS,
    ENTITY_LIMIT
} from './constants';

const log = debug('mcp:ngsi');

const JSON_LD_HEADER = 'application/ld+json';

interface CauseError extends Error {
    cause?: unknown;
}

// The ProblemDetails body plus the HTTP status, so downstream `fail()` can classify
// the error. Orion-LD rarely puts `status` in the body; the response carries it.
function causeFrom(body: unknown, httpStatus: number): Record<string, unknown> {
    const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    return { ...b, status: typeof b.status === 'number' ? b.status : httpStatus };
}

async function parse(response: Response): Promise<unknown> {
    let text = '';
    try {
        text = await response.text();
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

// The agent never picks a tenant. Reads use READ_TENANT, writes WRITE_TENANT,
// temporal TEMPORAL_TENANT; undefined means the broker default.
function setHeaders(tenant: string | undefined): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: JSON_LD_HEADER,
        Link: LinkHeader
    };
    if (tenant) {
        headers['NGSILD-Tenant'] = tenant;
        headers['NGSILD-Path'] = '/';
    }
    return headers;
}

// NGSI-LD `q` has no null literal (`calvedBy==null` errors). Drop bare-null clauses and an
// adjacent separator; a quoted "null" is a real string match and stays.
function stripNullClauses(q: string): string {
    if (!/[=<>~!]\s*null\b/.test(q)) {
        return q;
    }
    const parts = q.split('"'); // even indices are outside quoted string values
    const NULL_CLAUSE =
        /[A-Za-z_@][\w.:@-]*(?:\[[^\]]*\])?(?:\.[A-Za-z0-9_]+)*\s*(?:==|!=|>=|<=|>|<|~=)\s*null\b\s*([;|]?)/g;
    for (let i = 0; i < parts.length; i += 2) {
        let p = parts[i].replace(NULL_CLAUSE, '$1').replace(/([;|])\s*(?=[;|])/g, '');
        if (i === 0) {
            p = p.replace(/^\s*[;|]+/, '');
        }
        if (i === parts.length - 1) {
            p = p.replace(/[;|]+\s*$/, '');
        }
        parts[i] = p;
    }
    return parts.join('"');
}

// Build the query string by hand: URLSearchParams encodes spaces as '+', which
// Orion-LD's `q` parser leaves undecoded and then matches nothing.
function toQueryString(opts: Record<string, unknown>): string {
    const params: Record<string, unknown> = { ...opts };

    const q = stripNullClauses(String(params.q ?? ''));
    if (q) {
        params.q = q;
    } else {
        delete params.q;
    }

    if (params.format) {
        params.options = params.format === 'simplified' ? 'keyValues' : params.format;
        delete params.format;
    }
    if (params.pick) {
        // Keep id/type so a projected entity stays identifiable and validatable.
        const attrs = [
            ...new Set([
                'id',
                'type',
                ...String(params.pick)
                    .split(',')
                    .map((s) => s.trim())
            ])
        ].filter(Boolean);
        params.pick = attrs.join(',');
        if (SEND_PICK_AS_ATTRS) {
            params.attrs = params.pick;
            delete params.pick;
        }
    }

    return Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
}

// Any 2xx is success. Brokers use 206 for a truncated result (temporal lastN, a
// page cap), not just 200.
function requestFull(
    url: string,
    tenant: string | undefined = READ_TENANT
): Promise<{ body: unknown; headers: Headers }> {
    log('GET %s', url);
    return fetch(url, { method: 'GET', headers: setHeaders(tenant) })
        .then((r) => parse(r).then((body) => ({ status: r.status, body, headers: r.headers })))
        .then((data) => {
            if (data.status < 200 || data.status >= 300) {
                const body = (data.body || {}) as Record<string, unknown>;
                const error: CauseError = new Error(
                    (body.title as string) ||
                        (body.message as string) ||
                        (typeof data.body === 'string' && data.body
                            ? (data.body as string)
                            : `NGSI-LD error ${data.status}`)
                );
                error.cause = causeFrom(data.body, data.status);
                throw error;
            }
            return { body: data.body, headers: data.headers };
        });
}

function request(url: string, tenant: string | undefined = READ_TENANT): Promise<unknown> {
    return requestFull(url, tenant).then((d) => d.body);
}

// POST / PATCH / DELETE; non-2xx throws with ProblemDetails on `.cause`. WRITE_LOCAL_ONLY
// adds `local=true` on entity-level ops only — Orion-LD 404s it on `/attrs/{attr}`.
function mutate(
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
    tenant: string | undefined = WRITE_TENANT,
    contentType = 'application/json'
): Promise<unknown> {
    const localOk = WRITE_LOCAL_ONLY && !/\/attrs(\/|$)/.test(url);
    const target = localOk ? `${url}${url.includes('?') ? '&' : '?'}local=true` : url;
    log('%s %s', method, target);
    const headers = setHeaders(tenant);
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
        // @context rides in the Link header, so the body is plain json / merge-patch+json.
        // Orion-LD rejects a Link header next to an application/ld+json body.
        headers['Content-Type'] = contentType;
        init.body = JSON.stringify(body);
    }
    return fetch(target, init)
        .then((r) => parse(r).then((b) => ({ status: r.status, body: b })))
        .then((data) => {
            if (data.status < 200 || data.status >= 300) {
                const b = (data.body || {}) as Record<string, unknown>;
                const error: CauseError = new Error(
                    (b.title as string) ||
                        (b.detail as string) ||
                        (typeof data.body === 'string' && data.body
                            ? (data.body as string)
                            : `NGSI-LD error ${data.status}`)
                );
                error.cause = causeFrom(data.body, data.status);
                throw error;
            }
            return data.body || {};
        });
}

// POST /entities: create one entity (normalised NGSI-LD; @context in the Link header).
function createEntity(entity: Record<string, unknown>): Promise<unknown> {
    return mutate(`${CONTEXT_BROKER}/entities`, 'POST', entity);
}

// PATCH with merge-patch+json (RFC 7386): deep-merges the partial entity, so a
// JsonProperty's `json` is merged not replaced. 404 when the entity is absent.
function mergeEntity(entityId: string, patch: Record<string, unknown>): Promise<unknown> {
    return mutate(
        `${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}`,
        'PATCH',
        patch,
        WRITE_TENANT,
        'application/merge-patch+json'
    );
}

// DELETE /entities/{entityId}: remove an entity and all of its attributes.
function deleteEntity(entityId: string): Promise<unknown> {
    return mutate(`${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}`, 'DELETE');
}

// POST /entities/{id}/attrs: append attributes. Orion-LD merges into an existing
// attribute, so this is only used to create one that does not exist yet.
function appendAttribute(entityId: string, attr: string, node: unknown): Promise<unknown> {
    return mutate(`${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}/attrs`, 'POST', { [attr]: node });
}

// PATCH one attribute (fragment without the name wrapper): merges the value and
// named sub-attributes, keeps the rest. 404 when absent. PUT is unevenly supported.
function patchAttribute(entityId: string, attr: string, node: unknown): Promise<unknown> {
    return mutate(
        `${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}/attrs/${encodeURIComponent(attr)}`,
        'PATCH',
        node
    );
}

// DELETE /entities/{entityId}/attrs/{attrId}: remove one attribute.
function deleteAttribute(entityId: string, attr: string): Promise<unknown> {
    return mutate(
        `${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}/attrs/${encodeURIComponent(attr)}`,
        'DELETE'
    );
}

// A page of GET /entities results plus what the caller needs to tell if it has the
// whole set. `total` is NGSILD-Results-Count, or null when the broker withheld it.
interface EntityPage {
    entities: unknown[];
    total: number | null;
    limit: number;
    offset: number;
    returned: number;
}

// GET /entities with count=true so the response carries the match total (util.okPage
// turns it into a "more data" notice). metadataOnly keeps the count, drops the rows.
function listEntities(opts: Record<string, unknown>): Promise<EntityPage> {
    const { metadataOnly, ...rest } = opts;
    const limit = Number(opts.limit) || ENTITY_LIMIT;
    const offset = Math.max(0, Math.floor(Number(opts.offset) || 0));
    // limit=0 is the natural count-only form but Orion-LD's NGSILD-Results-Count is
    // unreliable for it; limit=1 always reports the true count and the row is dropped.
    const query = toQueryString({
        ...rest,
        limit: metadataOnly === true ? 1 : limit,
        offset: offset || undefined,
        count: true
    });
    return requestFull(`${CONTEXT_BROKER}/entities?${query}`).then(({ body, headers }) => {
        const raw = headers.get('NGSILD-Results-Count');
        const total = raw !== null && raw.trim() !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : null;
        const all = Array.isArray(body) ? body : [];
        const entities = metadataOnly === true ? [] : all.slice(0, limit);
        return { entities, total, limit, offset, returned: entities.length };
    });
}

// GET /entities/{entityId}
function readEntity(entityId: string, opts: Record<string, unknown>): Promise<unknown> {
    return request(`${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}?${toQueryString(opts)}`);
}

// GET /temporal/entities/{id} against the temporal broker under TEMPORAL_TENANT.
// Projection goes as `attrs`, supported far more widely than `pick` on temporal.
function readTemporalEntity(entityId: string, opts: Record<string, unknown>): Promise<unknown> {
    const { pick, ...rest } = opts;
    if (pick) {
        rest.attrs = String(pick)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .join(',');
    }
    return request(
        `${TEMPORAL_BROKER!}/temporal/entities/${encodeURIComponent(entityId)}?${toQueryString(rest)}`,
        TEMPORAL_TENANT
    );
}

// GET /types: details=true asks for the fuller EntityType[], false the lighter
// EntityTypeList. Sent explicitly — some brokers don't default it to false when omitted.
function listTypes(details = true): Promise<unknown> {
    return request(`${CONTEXT_BROKER}/types?${toQueryString({ details })}`);
}

// GET /types/{type}, returns an EntityTypeInfo.
function readType(type: string): Promise<unknown> {
    return request(`${CONTEXT_BROKER}/types/${encodeURIComponent(type)}`);
}

// GET /attributes: details=true asks for the fuller Attribute[], details=false the
// lighter AttributeList. Sent explicitly either way, for the same reason as listTypes.
function listAttributes(details = true): Promise<unknown> {
    return request(`${CONTEXT_BROKER}/attributes?${toQueryString({ details })}`);
}

// GET /attributes/{attrId}, returns an Attribute.
function readAttribute(attrId: string): Promise<unknown> {
    return request(`${CONTEXT_BROKER}/attributes/${encodeURIComponent(attrId)}`);
}

export type { EntityPage };
export {
    parse,
    setHeaders,
    stripNullClauses,
    listEntities,
    readEntity,
    readTemporalEntity,
    listTypes,
    readType,
    listAttributes,
    readAttribute,
    createEntity,
    mergeEntity,
    deleteEntity,
    appendAttribute,
    patchAttribute,
    deleteAttribute
};
