#!/usr/bin/env node

import debug from 'debug';
import { buildServer } from '../app';
import { TRANSPORT, PORT } from '../lib/constants';

const log = debug('mcp:server');

buildServer()
    .then((server) => {
        if (TRANSPORT === 'http') {
            server.start({ transportType: 'httpStream', httpStream: { port: PORT, endpoint: '/mcp' } });
        } else {
            server.start({ transportType: 'stdio' });
        }
        log('NGSI-LD MCP server up (%s)', TRANSPORT);
    })
    .catch((err: Error) => {
        console.error('failed to start NGSI-LD MCP server:', err.message);
        process.exit(1);
    });
