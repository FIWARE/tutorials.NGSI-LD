#!/usr/bin/env node

import { CONTEXT_BROKER } from '../lib/constants';

fetch(`${CONTEXT_BROKER}/types`, { headers: { Accept: 'application/json' } })
    .then((r) => {
        console.info(`broker responded ${r.status}`);
        process.exit(r.status < 500 ? 0 : 1);
    })
    .catch((err: Error) => {
        console.error(`broker unreachable: ${err.message}`);
        process.exit(1);
    });
