const CONTEXT_BROKER_URL = process.env.CONTEXT_BROKER || 'http://localhost:1026/ngsi-ld/v1';
const LINKED_DATA = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const debug = require('debug')('tutorial:batchUpdate');

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

function is2xxSuccessful(status) {
    return Math.floor(status / 100) === 2;
}

// measures sent over HTTP are POST requests with params
function sendAsHTTP(state, tenant) {
    const url = CONTEXT_BROKER_URL + '/entityOperations/upsert';
    const headers = {
        'Content-Type': 'application/json',
        Link: '<' + LINKED_DATA + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
    };

    if (tenant) {
        headers['NGSILD-Tenant'] = tenant;
    }

    const body = Array.isArray(state) ? state : [state];
    try {
        return fetch(`${url}?${new URLSearchParams({ options: 'update' })}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        })
            .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
            .then((data) => {
                if (!is2xxSuccessful(data.status)) {
                    throw new Error(data.body);
                }
                return data.body;
            });
    } catch (e) {
        debug(e);
        return null;
    }
}

module.exports = {
    sendAsHTTP
};
