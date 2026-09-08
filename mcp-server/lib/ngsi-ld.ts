// Promise-chain fetch wrappers around the NGSI-LD Context Broker.
//
// Structure (promise chains, `parse()` helper, `Error` + `.cause`) mirrors
// ../Step-by-Step/NGSI-LD/app/lib/ngsi-ld.ts — a STYLE reference only. Every path,
// query parameter, header and status code below is taken from the ETSI NGSI-LD
// OpenAPI v1.8.1 spec, not from that file.

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

async function parse(response: Response): Promise<unknown> {
    let text = '';
    try {
        text = await response.text();
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

// Tenant selection is not the agent's concern: the resolved tenant (READ_TENANT
// for reads, WRITE_TENANT for writes, TEMPORAL_TENANT for the temporal broker) is
// applied to every request; undefined is the broker's default tenant.
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

// key=="value" clauses joined by ';' (logical AND). A value that already starts
// with an operator (heartRate + ">60") is emitted verbatim so the agent can pass
// ranges. Numeric-looking values stay unquoted.
function buildQuery(filters: Record<string, unknown> = {}): string {
    const clauses: string[] = [];
    for (const [key, raw] of Object.entries(filters)) {
        if (raw === undefined || raw === null || raw === '') {
            continue;
        }
        const value = String(raw);
        const op = value.match(/^\s*(>=|<=|!=|==|>|<|~=)(.*)$/);
        if (op) {
            const rhs = op[2].trim();
            const num = rhs !== '' && !isNaN(Number(rhs));
            clauses.push(`${key}${op[1]}${num ? rhs : `"${rhs}"`}`);
        } else if (value.trim() !== '' && !isNaN(Number(value))) {
            clauses.push(`${key}==${value}`);
        } else {
            clauses.push(`${key}=="${value}"`);
        }
    }
    return clauses.join(';');
}

// Build the query string by hand with encodeURIComponent: URLSearchParams encodes
// spaces as '+', which Orion-LD's `q` parser does not decode ( q=species=="dairy
// cattle" would silently match nothing ). encodeURIComponent uses %20.
function toQueryString(opts: Record<string, unknown>): string {
    const params: Record<string, unknown> = { ...opts };

    const filters = (params.filters as Record<string, unknown>) || undefined;
    delete params.filters;

    const q = [buildQuery(filters), params.q].filter(Boolean).join(';');
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
        // Always keep id/type so a projected entity is still identifiable and validatable.
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

// Any 2xx is success — NGSI-LD brokers use 206 (not just 200) for a truncated
// result, e.g. temporal `lastN` or a broker-side page cap. Only 3xx/4xx/5xx are errors.
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
                error.cause = data.body;
                throw error;
            }
            return { body: data.body, headers: data.headers };
        });
}

function request(url: string, tenant: string | undefined = READ_TENANT): Promise<unknown> {
    return requestFull(url, tenant).then((d) => d.body);
}

// POST / PATCH / DELETE against the context broker. NGSI-LD write endpoints answer
// 201/204 with an empty body on success; anything outside 2xx becomes an Error
// carrying the ProblemDetails payload on `.cause`. Under WRITE_LOCAL_ONLY (default)
// `local=true` is appended so the write is not cascaded to Context Source
// Registrations (NGSI-LD §6.3.18).
function mutate(
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
    tenant: string | undefined = WRITE_TENANT,
    contentType = 'application/json'
): Promise<unknown> {
    const target = WRITE_LOCAL_ONLY ? `${url}${url.includes('?') ? '&' : '?'}local=true` : url;
    log('%s %s', method, target);
    const headers = setHeaders(tenant);
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
        // The @context travels in the Link header (set by setHeaders), so the body
        // is plain application/json (or application/merge-patch+json) — Orion-LD
        // rejects a Link header alongside an application/ld+json body.
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
                error.cause = data.body;
                throw error;
            }
            return data.body || {};
        });
}

// POST /entities — create one entity (normalised NGSI-LD; @context via the Link header).
function createEntity(entity: Record<string, unknown>): Promise<unknown> {
    return mutate(`${CONTEXT_BROKER}/entities`, 'POST', entity);
}

// PATCH /entities/{entityId} with application/merge-patch+json (RFC 7386) — deep-
// merges the partial entity, so nested objects (e.g. a JsonProperty's `json`) are
// merged rather than replaced. 404 when the entity does not exist.
function mergeEntity(entityId: string, patch: Record<string, unknown>): Promise<unknown> {
    return mutate(
        `${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}`,
        'PATCH',
        patch,
        WRITE_TENANT,
        'application/merge-patch+json'
    );
}

// DELETE /entities/{entityId} — remove an entity and all of its attributes.
function deleteEntity(entityId: string): Promise<unknown> {
    return mutate(`${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}`, 'DELETE');
}

// POST /entities/{entityId}/attrs — append attributes (payload keyed by name).
// On Orion-LD this merges into an existing attribute rather than replacing it, so
// it is only used here to create an attribute that does not yet exist.
function appendAttribute(entityId: string, attr: string, node: unknown): Promise<unknown> {
    return mutate(`${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}/attrs`, 'POST', { [attr]: node });
}

// PATCH /entities/{entityId}/attrs/{attrId} — partial update of one attribute
// (payload is the attribute fragment without the name wrapper). Merges: the value
// and any sub-attributes in the payload are updated, sub-attributes absent from it
// are kept. 404 when the attribute does not exist. Chosen over PUT (attribute
// replacement) which is newer and unevenly supported across brokers.
function patchAttribute(entityId: string, attr: string, node: unknown): Promise<unknown> {
    return mutate(
        `${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}/attrs/${encodeURIComponent(attr)}`,
        'PATCH',
        node
    );
}

// DELETE /entities/{entityId}/attrs/{attrId} — remove one attribute.
function deleteAttribute(entityId: string, attr: string): Promise<unknown> {
    return mutate(
        `${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}/attrs/${encodeURIComponent(attr)}`,
        'DELETE'
    );
}

// A page of GET /entities results plus the metadata a caller needs to decide
// whether it has seen the whole result set. `total` is the broker's
// NGSILD-Results-Count, or null when the broker withheld the header.
interface EntityPage {
    entities: unknown[];
    total: number | null;
    limit: number;
    offset: number;
    returned: number;
}

// GET /entities — always requests `count=true` so the response carries the total
// match count; controllers/tools/util.okPage turns that into an explicit
// "more data available" notice for the agent. `metadataOnly` is the HEAD-style
// "how many match" query: the single returned row is discarded, leaving just the
// count and an empty array, while the EntityPage still reports the caller's own
// limit so the pagination block stays meaningful.
function listEntities(opts: Record<string, unknown>): Promise<EntityPage> {
    const { metadataOnly, ...rest } = opts;
    const limit = Number(opts.limit) || ENTITY_LIMIT;
    const offset = Math.max(0, Math.floor(Number(opts.offset) || 0));
    // limit=0 is the natural count-only form, but Orion-LD returns an unreliable
    // NGSILD-Results-Count for it (0 on some tenants); limit=1 always reports the
    // true count, and the row it returns is dropped below.
    const query = toQueryString({
        ...rest,
        limit: metadataOnly === true ? 1 : limit,
        offset: offset || undefined,
        count: true
    });
    return requestFull(`${CONTEXT_BROKER}/entities?${query}`).then(({ body, headers }) => {
        const raw = headers.get('NGSILD-Results-Count');
        const total = raw !== null && raw.trim() !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : null;
        const entities = metadataOnly === true ? [] : Array.isArray(body) ? body : [];
        return { entities, total, limit, offset, returned: entities.length };
    });
}

// GET /entities/{entityId}
function readEntity(entityId: string, opts: Record<string, unknown>): Promise<unknown> {
    return request(`${CONTEXT_BROKER}/entities/${encodeURIComponent(entityId)}?${toQueryString(opts)}`);
}

// GET /temporal/entities/{entityId} — against the (optionally distinct) temporal
// broker, under TEMPORAL_TENANT (independent of READ_TENANT). Only reached when
// TEMPORAL_BROKER is set: the history tools are gated on it. Projection goes out
// as `attrs`, which the temporal endpoints support far more widely than the newer
// `pick` parameter.
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

// GET /types  (details=false → EntityTypeList, details=true → EntityType[])
function listTypes(details = true): Promise<unknown> {
    return request(`${CONTEXT_BROKER}/types?${toQueryString({ details })}`);
}

// GET /types/{type} → EntityTypeInfo
function readType(type: string): Promise<unknown> {
    return request(`${CONTEXT_BROKER}/types/${encodeURIComponent(type)}`);
}

// GET /attributes  (details=false → AttributeList, details=true → Attribute[])
function listAttributes(details = true): Promise<unknown> {
    return request(`${CONTEXT_BROKER}/attributes?${toQueryString({ details })}`);
}

// GET /attributes/{attrId} → Attribute
function readAttribute(attrId: string): Promise<unknown> {
    return request(`${CONTEXT_BROKER}/attributes/${encodeURIComponent(attrId)}`);
}

export type { EntityPage };
export {
    parse,
    setHeaders,
    buildQuery,
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
