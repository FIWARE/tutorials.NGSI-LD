#!/usr/bin/env node

// Probes this server, not the broker — once the broker requires a token, 401 reads as healthy.

import { HOST, PORT } from '../lib/constants';

const host = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;

fetch(`http://${host}:${PORT}/health`)
    .then((r) => {
        console.info(`mcp-server responded ${r.status}`);
        process.exit(r.ok ? 0 : 1);
    })
    .catch((err: Error) => {
        console.error(`mcp-server unreachable: ${err.message}`);
        process.exit(1);
    });
