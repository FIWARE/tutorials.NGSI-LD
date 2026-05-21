"use strict";
//
// This controller demonstrates how to override NGSI-LD contexts
// through compaction and expansion
//
// For more information see: https://json-ld.org/
//
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateRequest = translateRequest;
const debug_1 = __importDefault(require("debug"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsonld = require('jsonld');
const ngsi_ld_1 = require("../../lib/ngsi-ld");
const ngsi_ld_json_1 = __importDefault(require("./jsonld-context/ngsi-ld.json"));
const japanese_json_1 = __importDefault(require("./jsonld-context/japanese.json"));
const log = (0, debug_1.default)('tutorial:ngsi-ld');
// This function is a simple forward to the context broker
//
// When the response is received the payload is treated so that
// the JSON uses attribute names based in Japanese.
//
function translateRequest(req, res) {
    log('translateRequest');
    const headers = req.headers;
    headers.Accept = 'application/json';
    return fetch(`${ngsi_ld_1.BASE_PATH}${req.path}/?${new URLSearchParams(req.query)}`, {
        headers,
        method: req.method
    })
        .then((r) => r.json().then((data) => ({ status: r.status, body: data })))
        .then(async function (cbResponse) {
        // Having received a response, the payload is expanded using
        // the core context - this forces all attribute ids to be
        // URIs
        cbResponse.body['@context'] = ngsi_ld_json_1.default;
        const expanded = await jsonld.expand(cbResponse.body);
        // The payload is then compacted using the "japanese" context
        // This maps the URIs to short attribute names.
        const compacted = await jsonld.compact(expanded, japanese_json_1.default);
        delete compacted['@context'];
        return res.send(compacted);
    })
        .catch(function (err) {
        return res.send(err);
    });
}
