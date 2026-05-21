// The basePath must be set - this is the location of the Orion
// context broker. It is best to do this with an environment
// variable (with a fallback if necessary)
const BASE_PATH = process.env.CONTEXT_BROKER || 'http://localhost:1026/ngsi-ld/v1';

// The context must be set - this is the location of the JSON-LD context file
// which defines the data model used in the tutorials
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

const JSON_LD_HEADER = 'application/ld+json';

async function parse(response: Response): Promise<unknown> {
    let text = '';
    try {
        text = await response.text();
        const data = JSON.parse(text) as unknown;
        return data;
    } catch {
        return text;
    }
}

function setHeaders(accessToken: string | undefined, link?: string, contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (accessToken) {
        // If the system has been secured and we have logged in,
        // add the access token to the request to the PEP Proxy
        headers.Authorization = `Bearer ${accessToken}`;
    }
    if (link) {
        headers.Link = link;
    }
    if (contentType) {
        headers['Content-Type'] = contentType || JSON_LD_HEADER;
    }
    return headers;
}

// This is a promise to make an HTTP POST request to the
// /ngsi-ld/v1/entities/<entity-id>/attrs end point
function createAttribute(entityId: string, body: string, headers: Record<string, string> = {}): Promise<unknown> {
    return fetch(`${BASE_PATH}/entities/${entityId}/attrs`, {
        method: 'POST',
        headers,
        body
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 201) {
                const body = data.body as Record<string, unknown>;
                const error = new Error(
                    (body.title as string) ||
                        (body.message as string) ||
                        (typeof body === 'string' && body ? body : 'Unknown Error')
                );
                (error as Error & { cause?: unknown }).cause = data.body;
                throw error;
            }
            return data.body;
        });
}

// This is a promise to make an HTTP POST request to the
// /ngsi-ld/v1/entities/<entity-id>/attrs end point
function readAttribute(entityId: string, headers: Record<string, string> = {}): Promise<unknown> {
    return fetch(`${BASE_PATH}/entities/${entityId}/attrs`, {
        method: 'GET',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 200) {
                const body = data.body as Record<string, unknown>;
                const error = new Error(
                    (body.title as string) ||
                        (body.message as string) ||
                        (typeof body === 'string' && body ? body : 'Unknown Error')
                );
                (error as Error & { cause?: unknown }).cause = data.body;
                throw error;
            }
            return data.body;
        });
}

// This is a promise to make an HTTP PATCH request to the
// /ngsi-ld/v1/entities/<entity-id>/attr end point
function updateAttribute(entityId: string, body: string, headers: Record<string, string> = {}): Promise<unknown> {
    return fetch(`${BASE_PATH}/entities/${entityId}/attrs`, {
        method: 'PATCH',
        headers,
        body
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 204) {
                const bodyObj = data.body as Record<string, unknown>;
                const error = new Error(
                    (bodyObj.title as string) ||
                        (bodyObj.message as string) ||
                        (typeof bodyObj === 'string' && bodyObj ? bodyObj : 'Unknown Error')
                );
                (error as Error & { cause?: unknown }).cause = data.body;
                throw error;
            }
            return data.body;
        });
}

// This is a promise to make an HTTP DELETE request to the
// /ngsi-ld/v1/entities/<entity-id>/attrs end point
function deleteAttribute(entityId: string, headers: Record<string, string> = {}): Promise<unknown> {
    return fetch(`${BASE_PATH}/entities/${entityId}/attrs`, {
        method: 'DELETE',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 204) {
                const body = data.body as Record<string, unknown>;
                const error = new Error(
                    (body.title as string) ||
                        (body.message as string) ||
                        (typeof body === 'string' && body ? body : 'Unknown Error')
                );
                (error as Error & { cause?: unknown }).cause = data.body;
                throw error;
            }
            return data.body;
        });
}

// This is a promise to make an HTTP POST request to the
// /ngsi-ld/v1/entities end point
function createEntity(entityId: string, _type: string, body: string, headers: Record<string, string> = {}): Promise<unknown> {
    return fetch(`${BASE_PATH}/entities/${entityId}`, {
        method: 'POST',
        headers,
        body
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 201) {
                const bodyObj = data.body as Record<string, unknown>;
                const error = new Error(
                    (bodyObj.title as string) ||
                        (bodyObj.message as string) ||
                        (typeof bodyObj === 'string' && bodyObj ? bodyObj : 'Unknown Error')
                );
                (error as Error & { cause?: unknown }).cause = data.body;
                throw error;
            }
            return data.body;
        });
}

// This is a promise to make an HTTP DELETE request to the
// /ngsi-ld/v1/entities/<entity-id> end point
function deleteEntity(entityId: string, headers: Record<string, string> = {}): Promise<unknown> {
    return fetch(`${BASE_PATH}/entities/${entityId}`, {
        method: 'DELETE',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 204) {
                const body = data.body as Record<string, unknown>;
                const error = new Error(
                    (body.title as string) ||
                        (body.message as string) ||
                        (typeof body === 'string' && body ? body : 'Unknown Error')
                );
                (error as Error & { cause?: unknown }).cause = data.body;
                throw error;
            }
            return data.body;
        });
}

// This is a promise to make an HTTP GET request to the
// /ngsi-ld/v1/entities/<entity-id> end point
function readEntity(entityId: string, opts: Record<string, unknown>, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = { ...opts };
    if (params.format) {
        params.options = params.format === 'simplified' ? 'keyValues' : params.format;
        delete params.format;
    }
    return fetch(`${BASE_PATH}/entities/${entityId}/?${new URLSearchParams(params as Record<string, string>)}`, {
        method: 'GET',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 200) {
                const body = data.body as Record<string, unknown>;
                const error = new Error(
                    (body.title as string) ||
                        (body.message as string) ||
                        (typeof body === 'string' && body ? body : 'Unknown Error')
                );
                (error as Error & { cause?: unknown }).cause = data.body;
                throw error;
            }
            return data.body as Record<string, unknown>;
        });
}

// This is a promise to make an HTTP GET request to the
// /ngsi-ld/v1/entities/ end point
function listEntities(opts: Record<string, unknown>, headers: Record<string, string> = {}): Promise<unknown> {
    const params: Record<string, unknown> = { ...opts };
    if (params.format) {
        params.options = params.format === 'simplified' ? 'keyValues' : params.format;
        delete params.format;
    }
    if (params.pick) {
        params.attrs = params.pick;
        delete params.pick;
    }
    return fetch(`${BASE_PATH}/entities/?${new URLSearchParams(params as Record<string, string>)}`, {
        method: 'GET',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 200) {
                const body = data.body as Record<string, unknown>;
                const error = new Error(
                    (body.title as string) ||
                        (body.message as string) ||
                        (typeof body === 'string' && body ? body : 'Unknown Error')
                );
                (error as Error & { cause?: unknown }).cause = data.body;
                throw error;
            }
            return data.body;
        });
}

function readTemporalEntity(entityId: string, opts: Record<string, unknown>, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
    return fetch(`${BASE_PATH}/temporal/entities/${entityId}/?${new URLSearchParams(opts as Record<string, string>)}`, {
        method: 'GET',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 200) {
                const body = data.body as Record<string, unknown>;
                const error = new Error(
                    (body.title as string) ||
                        (body.message as string) ||
                        (typeof body === 'string' && body ? body : 'Unknown Error')
                );
                (error as Error & { cause?: unknown }).cause = data.body;
                throw error;
            }
            return data.body as Record<string, unknown>;
        });
}

export {
    BASE_PATH,
    LinkHeader,
    parse,
    createAttribute,
    readAttribute,
    updateAttribute,
    deleteAttribute,
    createEntity,
    readEntity,
    readTemporalEntity,
    deleteEntity,
    listEntities,
    setHeaders
};
