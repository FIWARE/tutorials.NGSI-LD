#!/usr/bin/env node

import { BASE_PATH } from '../lib/constants';

fetch(`${BASE_PATH}/types`, { headers: { Accept: 'application/json' } })
    .then((r) => {
        console.info(`broker responded ${r.status}`);
        process.exit(r.status < 500 ? 0 : 1);
    })
    .catch((err: Error) => {
        console.error(`broker unreachable: ${err.message}`);
        process.exit(1);
    });
