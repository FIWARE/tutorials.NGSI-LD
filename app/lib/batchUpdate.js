const { BASE_PATH, LinkHeader, parse } = require('./ngsi-ld');
const debug = require('debug')('tutorial:batchUpdate');

function is2xxSuccessful(status) {
    return Math.floor(status / 100) === 2;
}

// measures sent over HTTP are POST requests with params
function sendAsHTTP(state, tenant, authHeader) {
    const url = BASE_PATH + '/entityOperations/upsert';
    const headers = {
        'Content-Type': 'application/json',
        Link: LinkHeader
    };

    if (tenant) {
        headers['NGSILD-Tenant'] = tenant;
    }
    if (authHeader) {
        headers.Authorization = authHeader;
    }

    const body = Array.isArray(state) ? state : [state];
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
        })
        .catch((e) => {
            debug(e);
            return null;
        });
}

module.exports = {
    sendAsHTTP
};
