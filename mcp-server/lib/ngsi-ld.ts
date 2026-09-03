// Promise-chain fetch wrappers around the NGSI-LD Context Broker.
//
// Structure (promise chains, `parse()` helper, `Error` + `.cause`) mirrors
// ../Step-by-Step/NGSI-LD/app/lib/ngsi-ld.ts — a STYLE reference only. Every path,
// query parameter, header and status code below is taken from the ETSI NGSI-LD
// OpenAPI v1.8.1 spec, not from that file.

import debug from 'debug';
import { BASE_PATH, LinkHeader, TENANT, SEND_PICK_AS_ATTRS } from './constants';

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

// Tenant selection is not the agent's concern: NGSI_LD_TENANT (if set) is applied
// to every request; default is the broker's default tenant.
function setHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: JSON_LD_HEADER,
        Link: LinkHeader
    };
    if (TENANT) {
        headers['NGSILD-Tenant'] = TENANT;
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
        const attrs = [...new Set(['id', 'type', ...String(params.pick).split(',').map((s) => s.trim())])].filter(
            Boolean
        );
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

function request(url: string, expected: number): Promise<unknown> {
    log('GET %s', url);
    return fetch(url, { method: 'GET', headers: setHeaders() })
        .then((r) => parse(r).then((body) => ({ status: r.status, body })))
        .then((data) => {
            if (data.status !== expected) {
                const body = (data.body || {}) as Record<string, unknown>;
                const error: CauseError = new Error(
                    (body.title as string) ||
                        (body.message as string) ||
                        (typeof data.body === 'string' && data.body ? (data.body as string) : `NGSI-LD error ${data.status}`)
                );
                error.cause = data.body;
                throw error;
            }
            return data.body;
        });
}

// GET /entities
function listEntities(opts: Record<string, unknown>): Promise<unknown> {
    return request(`${BASE_PATH}/entities?${toQueryString(opts)}`, 200);
}

// GET /entities/{entityId}
function readEntity(entityId: string, opts: Record<string, unknown>): Promise<unknown> {
    return request(`${BASE_PATH}/entities/${encodeURIComponent(entityId)}?${toQueryString(opts)}`, 200);
}

// GET /temporal/entities/{entityId}
function readTemporalEntity(entityId: string, opts: Record<string, unknown>): Promise<unknown> {
    return request(`${BASE_PATH}/temporal/entities/${encodeURIComponent(entityId)}?${toQueryString(opts)}`, 200);
}

// GET /types  (details=false → EntityTypeList, details=true → EntityType[])
function listTypes(details = true): Promise<unknown> {
    return request(`${BASE_PATH}/types?${toQueryString({ details })}`, 200);
}

// GET /types/{type} → EntityTypeInfo
function readType(type: string): Promise<unknown> {
    return request(`${BASE_PATH}/types/${encodeURIComponent(type)}`, 200);
}

// GET /attributes  (details=false → AttributeList, details=true → Attribute[])
function listAttributes(details = true): Promise<unknown> {
    return request(`${BASE_PATH}/attributes?${toQueryString({ details })}`, 200);
}

// GET /attributes/{attrId} → Attribute
function readAttribute(attrId: string): Promise<unknown> {
    return request(`${BASE_PATH}/attributes/${encodeURIComponent(attrId)}`, 200);
}

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
    readAttribute
};
