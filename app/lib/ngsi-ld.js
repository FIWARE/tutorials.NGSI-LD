////

/* eslint-disable no-unused-vars */

// The basePath must be set - this is the location of the Orion
// context broker. It is best to do this with an environment
// variable (with a fallback if necessary)
const BASE_PATH = process.env.CONTEXT_BROKER || 'http://localhost:1026/ngsi-ld/v1';

const JSON_LD_HEADER = 'application/ld+json';

async function parse(response) {
    let text = '';
    try {
        text = await response.text();
        const data = JSON.parse(text);
        return data;
    } catch (err) {
        return text;
    }
}

function setHeaders(accessToken, link, contentType) {
    const headers = {};
    if (accessToken) {
        // If the system has been secured and we have logged in,
        // add the access token to the request to the PEP Proxy
        headers['X-Auth-Token'] = accessToken;
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
function createAttribute(entityId, body, headers = {}) {
    return fetch(`${BASE_PATH}/entities/${entityId}/attrs`, {
        method: 'POST',
        headers,
        body
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 201) {
                throw new Error('', { cause: data.body });
            }
            return data.body;
        });
}

// This is a promise to make an HTTP POST request to the
// /ngsi-ld/v1/entities/<entity-id>/attrs end point
function readAttribute(entityId, headers = {}) {
    return fetch(`${BASE_PATH}/entities/${entityId}/attrs`, {
        method: 'GET',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 200) {
                throw new Error('', { cause: data.body });
            }
            return data.body;
        });
}

// This is a promise to make an HTTP PATCH request to the
// /ngsi-ld/v1/entities/<entity-id>/attr end point
function updateAttribute(entityId, body, headers = {}) {
    return fetch(`${BASE_PATH}/entities/${entityId}/attrs`, {
        method: 'PATCH',
        headers,
        body
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 204) {
                throw new Error('', { cause: data.body });
            }
            return data.body;
        });
}

// This is a promise to make an HTTP DELETE request to the
// /ngsi-ld/v1/entities/<entity-id>/attrs end point
function deleteAttribute(entityId, headers = {}) {
    return fetch(`${BASE_PATH}/entities/${entityId}/attrs`, {
        method: 'DELETE',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 204) {
                throw new Error('', { cause: data.body });
            }
            return data.body;
        });
}

// This is a promise to make an HTTP POST request to the
// /ngsi-ld/v1/entities end point
function createEntity(entityId, type, body, headers = {}) {
    return fetch(`${BASE_PATH}/entities/${entityId}`, {
        method: 'POST',
        headers,
        body
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 201) {
                throw new Error('', { cause: data.body });
            }
            return data.body;
        });
}

// This is a promise to make an HTTP PATCH request to the
// /ngsi-ld/v1/entities/<entity-id>/attr end point
function updateEntity(entityId, body, headers = {}) {
    return fetch(`${BASE_PATH}/entities/${entityId}/attrs`, {
        method: 'PATCH',
        headers,
        body
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 204) {
                throw new Error('', { cause: data.body });
            }
            return data.body;
        });
}

// This is a promise to make an HTTP DELETE request to the
// /ngsi-ld/v1/entities/<entity-id> end point
function deleteEntity(entityId, headers = {}) {
    return fetch(`${BASE_PATH}/entities/${entityId}`, {
        method: 'DELETE',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 204) {
                throw new Error('', { cause: data.body });
            }
            return data.body;
        });
}

// This is a promise to make an HTTP GET request to the
// /ngsi-ld/v1/entities/<entity-id> end point
function readEntity(entityId, opts, headers = {}) {
    return fetch(`${BASE_PATH}/entities/${entityId}/?${new URLSearchParams(opts)}`, {
        method: 'GET',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 200) {
                throw new Error('', { cause: data.body });
            }
            return data.body;
        });
}

// This is a promise to make an HTTP GET request to the
// /ngsi-ld/v1/entities/ end point
function listEntities(opts, headers = {}) {
    return fetch(`${BASE_PATH}/entities/?${new URLSearchParams(opts)}`, {
        method: 'GET',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 200) {
                throw new Error(data.body);
            }
            return data.body;
        });
}

function readTemporalEntity(entityId, opts, headers = {}) {
    return fetch(`${BASE_PATH}/temporal/entities/${entityId}/?${new URLSearchParams(opts)}`, {
        method: 'GET',
        headers
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            if (data.status !== 200) {
                throw new Error('', { cause: data.body });
            }
            return data.body;
        });
}

module.exports = {
    createAttribute,
    readAttribute,
    updateAttribute,
    deleteAttribute,
    createEntity,
    readEntity,
    readTemporalEntity,
    updateEntity,
    deleteEntity,
    listEntities,
    setHeaders
};
