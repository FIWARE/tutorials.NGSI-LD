import express from 'express';
import debug from 'debug';
import os from 'os';
import cluster from 'cluster';
import bearerToken from 'express-bearer-token';
import { Verifier } from '../lib/verifier';
import * as ConfigService from '../lib/configService';
import { createProxyMiddleware } from 'http-proxy-middleware';

import healthcheck from 'express-healthcheck';

const log = debug('broker:proxy');
const PORT = process.env.PORT || 80;
const clusterWorkerSize = os.cpus().length;
const target = process.env.CONTEXT_BROKER || 'http://orion:1026';
const tenant = process.env.TENANT;
const walletType = process.env.WALLET_TYPE;
const walletToken = process.env.WALLET_TOKEN;
const walletAddress = process.env.WALLET_ADDRESS;
const acceptEncoding = process.env.ACCEPT_ENCODING;

const verify = process.env.VERIFY_CREDENTIALS || false;

const proxy = createProxyMiddleware<express.Request, express.Response>({
  target,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req) => {
      log(req.originalUrl);
      if (tenant) {
        proxyReq.setHeader('NGSILD-Tenant', tenant);
      }
      if (walletType) {
        proxyReq.setHeader('Wallet-type', walletType);
      }
      if (walletToken) {
        proxyReq.setHeader('Wallet-Token', walletToken);
      }
      if (walletAddress) {
        proxyReq.setHeader('Wallet-address', walletAddress);
      }
      if (acceptEncoding) {
        proxyReq.setHeader('accept-encoding', acceptEncoding);
      }
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
    },
  },
});

function initForwarder(config: unknown, text: string): void {
  const app = express();
  app.use('/health', healthcheck());

  if (verify) {
    app.use(bearerToken());
    const verifier = new Verifier(config);
    app.use('/', verifier.verify);
  }

  app.use('/', proxy);
  app.listen(PORT, function () {
    log(text);
  });
}

async function connect(): Promise<unknown> {
  let retry = 20;
  while (retry > 0) {
    try {
      await ConfigService.checkConnectivity();
      log(
        `Credentials Config Service is now available  - requesting config for ${tenant}`,
      );
      return await ConfigService.getConfig(tenant);
    } catch (e) {
      log((e as Error).message);
      retry--;
      if (retry === 0) {
        throw new Error(
          'Credentials Config Service is not available. Giving up after 20 attempts',
        );
      }
      log('retry after 5 seconds.');
      await new Promise<void>((resolve) => setTimeout(resolve, 5000));
    }
  }
  throw new Error('Credentials Config Service is not available.');
}

function startServer(config: unknown): void {
  if (clusterWorkerSize > 1) {
    if (cluster.isPrimary) {
      for (let i = 0; i < clusterWorkerSize; i++) {
        cluster.fork();
      }
      cluster.on('exit', function (worker) {
        log('Worker', worker.id, ' has exited.');
      });
    } else {
      initForwarder(
        config,
        `Server listening on port ${PORT} and worker ${process.pid}`,
      );
    }
  } else {
    initForwarder(
      config,
      `Server listening on port ${PORT} with the single worker ${process.pid}`,
    );
  }
}

if (verify) {
  connect().then(
    (config) => {
      startServer(config);
    },
    (err) => {
      log(err);
      process.exit(1);
    },
  );
} else {
  startServer(null);
}
