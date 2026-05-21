"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAsHTTP = sendAsHTTP;
const ngsi_ld_1 = require("./ngsi-ld");
const debug_1 = __importDefault(require("debug"));
const debugLog = (0, debug_1.default)('tutorial:batchUpdate');
function is2xxSuccessful(status) {
    return Math.floor(status / 100) === 2;
}
// measures sent over HTTP are POST requests with params
function sendAsHTTP(state, tenant, authHeader) {
    const url = ngsi_ld_1.BASE_PATH + '/entityOperations/upsert';
    const headers = {
        'Content-Type': 'application/json',
        Link: ngsi_ld_1.LinkHeader
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
        .then((r) => (0, ngsi_ld_1.parse)(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
        if (!is2xxSuccessful(data.status)) {
            throw new Error(String(data.body));
        }
        return data.body;
    })
        .catch((e) => {
        debugLog(e);
        return null;
    });
}
