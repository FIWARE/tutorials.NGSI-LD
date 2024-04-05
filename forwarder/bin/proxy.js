// include dependencies
const express = require('express');
const debug = require('debug')('broker:proxy');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

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

// mount `exampleProxy` in web server
app.use('/', exampleProxy);
app.listen(80);
