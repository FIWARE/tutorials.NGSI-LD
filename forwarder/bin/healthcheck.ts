#!/usr/bin/env node

import http from 'http';

const port = process.env.PORT || 80;
const path = process.env.HEALTHCHECK_PATH || '/health';
const httpCode = Number(process.env.HEALTHCHECK_CODE) || 200;

const options: http.RequestOptions = {
  host: 'localhost',
  port,
  timeout: 2000,
  method: 'GET',
  path,
};

const request = http.request(options, (result) => {
   
  console.info(`Performed health check, result ${result.statusCode}`);
  if (result.statusCode === httpCode) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', (err: Error) => {
   
  console.error(
    `An error occurred while performing health check, error: ${err}`,
  );
  process.exit(1);
});

request.end();
