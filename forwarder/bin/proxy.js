// include dependencies
const express = require('express');
const debug = require('debug')('broker:proxy');
const os = require('os');
const cluster = require('cluster');
const bearerToken = require('express-bearer-token');
const Verifier = require('../lib/verifier');
const { createProxyMiddleware } = require('http-proxy-middleware');
const PORT = process.env.PORT || 80;
const clusterWorkerSize = os.cpus().length;
const target = process.env.CONTEXT_BROKER || 'http://orion:1026';
const tenant = process.env.TENANT || 'farmer';
const verify = process.env.VERIFY_CREDENTIALS || false;

// create the proxy
/** @type {import('http-proxy-middleware/dist/types').RequestHandler<express.Request, express.Response>} */
const proxy = createProxyMiddleware({
  target, // target host with the same base path
  changeOrigin: true, // needed for virtual hosted sites
  on: {
    proxyReq: (proxyReq, req, res) => {
      debug(req.originalUrl);
      proxyReq.setHeader('NGSILD-Tenant', tenant);
    }
  }
});

function initForwarder(text) {
  const app = express();
  app.get('/status', (req, res) => {
    res.status(200).send();
  });

  if (verify) {
    app.use(bearerToken());
    app.use('/', Verifier.Verifier);
  }

  app.use('/', proxy);
  app.listen(PORT, function() {
    debug(text);
  });
}

if (clusterWorkerSize > 1) {
  if (cluster.isMaster) {
    for (let i = 0; i < clusterWorkerSize; i++) {
      cluster.fork();
    }
    cluster.on('exit', function(worker) {
      debug('Worker', worker.id, ' has exited.');
    });
  } else {
    initForwarder(`Server listening on port ${PORT} and worker ${process.pid}`);
  }
} else {
  initForwarder(
    `Server listening on port ${PORT} with the single worker ${process.pid}`
  );
}
