#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const port = process.env.WEB_APP_PORT || '3000';
const path = process.env.HEALTHCHECK_PATH || '/health';
const httpCode = parseInt(String(process.env.HEALTHCHECK_CODE || '200'), 10);
const options = {
    host: 'localhost',
    port,
    timeout: 2000,
    method: 'GET',
    path
};
const request = http_1.default.request(options, (result) => {
    // eslint-disable-next-line no-console
    console.info(`Performed health check, result ${result.statusCode}`);
    if (result.statusCode === httpCode) {
        process.exit(0);
    }
    else {
        process.exit(1);
    }
});
request.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error(`An error occurred while performing health check, error: ${err}`);
    process.exit(1);
});
request.end();
