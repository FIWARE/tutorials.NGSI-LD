//
// This controller demonstrates how to override NGSI-LD contexts
// through compaction and expansion
//
// For more information see: https://json-ld.org/
//

import debug from 'debug';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsonld = require('jsonld') as {
    expand(input: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    compact(input: Record<string, unknown>[], ctx: Record<string, unknown>): Promise<Record<string, unknown>>;
};
import { BASE_PATH } from '../../lib/ngsi-ld';
import type { Request, Response } from 'express';

import coreContext from './jsonld-context/ngsi-ld.json';
import japaneseContext from './jsonld-context/japanese.json';

const log = debug('tutorial:ngsi-ld');

// This function is a simple forward to the context broker
//
// When the response is received the payload is treated so that
// the JSON uses attribute names based in Japanese.
//
function translateRequest(req: Request, res: Response): Promise<Response> {
    log('translateRequest');

    const headers = req.headers as Record<string, string>;
    headers.Accept = 'application/json';
    return fetch(`${BASE_PATH}${req.path}/?${new URLSearchParams(req.query as Record<string, string>)}`, {
        headers,
        method: req.method
    })
        .then((r) => r.json().then((data) => ({ status: r.status, body: data as Record<string, unknown> })))
        .then(async function (cbResponse) {
            // Having received a response, the payload is expanded using
            // the core context - this forces all attribute ids to be
            // URIs
            cbResponse.body['@context'] = coreContext;
            const expanded = await jsonld.expand(cbResponse.body);
            // The payload is then compacted using the "japanese" context
            // This maps the URIs to short attribute names.
            const compacted = await jsonld.compact(expanded, japaneseContext as Record<string, unknown>);
            delete compacted['@context'];
            return res.send(compacted);
        })
        .catch(function (err: Error) {
            return res.send(err);
        });
}

export { translateRequest };
