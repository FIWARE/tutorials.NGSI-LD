import { BASE_PATH, LinkHeader, parse } from './ngsi-ld';
import debug from 'debug';

const debugLog = debug('tutorial:batchUpdate');

function is2xxSuccessful(status: number): boolean {
    return Math.floor(status / 100) === 2;
}

// measures sent over HTTP are POST requests with params
function sendAsHTTP(state: unknown, tenant: string | undefined, authHeader: string | undefined): Promise<unknown> {
    const url = BASE_PATH + '/entityOperations/upsert';
    const headers: Record<string, string> = {
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
                throw new Error(String(data.body));
            }
            return data.body;
        })
        .catch((e: Error) => {
            debugLog(e);
            return null;
        });
}

export { sendAsHTTP };
