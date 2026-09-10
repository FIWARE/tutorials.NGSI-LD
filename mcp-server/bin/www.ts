#!/usr/bin/env node

import debug from 'debug';
import { buildServer } from '../app';
import { TRANSPORT, PORT, HOST } from '../lib/constants';

const log = debug('mcp:server');

buildServer()
    .then((server) =>
        TRANSPORT === 'http'
            ? server.start({ transportType: 'httpStream', httpStream: { host: HOST, port: PORT, endpoint: '/mcp' } })
            : server.start({ transportType: 'stdio' })
    )
    .then(() => log('NGSI-LD MCP server up (%s)', TRANSPORT))
    .catch((err: Error) => {
        console.error('failed to start NGSI-LD MCP server:', err.message);
        process.exit(1);
    });
