// include dependencies
const express = require('express');
const debug = require('debug')('broker:proxy');
const os = require("os")
const cluster = require("cluster")
const { createProxyMiddleware } = require('http-proxy-middleware');
const PORT = process.env.PORT || 80
const clusterWorkerSize = os.cpus().length
const target = process.env.CONTEXT_BROKER || 'http://orion:1026';
const tenant = process.env.TENANT || 'farmer';

// create the proxy
/** @type {import('http-proxy-middleware/dist/types').RequestHandler<express.Request, express.Response>} */
const exampleProxy = createProxyMiddleware({
  target, // target host with the same base path
  changeOrigin: true, // needed for virtual hosted sites
  on: {
    proxyReq: (proxyReq, req, res) => {
      debug(req.originalUrl);
      proxyReq.setHeader('NGSILD-Tenant', tenant);
    }
  }
});


if (clusterWorkerSize > 1) {
  if (cluster.isMaster) {
    for (let i=0; i < clusterWorkerSize; i++) {
      cluster.fork()
    }
    cluster.on("exit", function(worker) {
      debug("Worker", worker.id, " has exited.")
    })
  } else {
    // mount `exampleProxy` in web server
    const app = express();
    app.get('/status', (req, res) => {
        res.status(200).send();
    });;

    app.use('/', exampleProxy);
    app.listen(PORT, function () {
      debug(`Server listening on port ${PORT} and worker ${process.pid}`)
    })
  }
} else {
  // mount `exampleProxy` in web server
  const app = express()
  app.use('/', exampleProxy);
  app.listen(PORT, function () {
    debug(`Server listening on port ${PORT} with the single worker ${process.pid}`)
  })
}


