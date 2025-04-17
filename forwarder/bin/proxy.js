// include dependencies
const express = require('express');
const debug = require('debug')('broker:proxy');
const os = require('os');
const cluster = require('cluster');
const bearerToken = require('express-bearer-token');
const Verifier = require('../lib/verifier');
const ConfigService = require('../lib/configService');
const { createProxyMiddleware } = require('http-proxy-middleware');
const PORT = process.env.PORT || 80;
const clusterWorkerSize = os.cpus().length;
const target = process.env.CONTEXT_BROKER || 'http://orion:1026';
const tenant = process.env.TENANT;
const walletType = process.env.WALLET_TYPE;
const walletToken = process.env.WALLET_TOKEN;
const walletAddress = process.env.WALLET_ADDRESS;

const verify = process.env.VERIFY_CREDENTIALS || false;

// create the proxy
/** @type {import('http-proxy-middleware/dist/types').RequestHandler<express.Request, express.Response>} */
const proxy = createProxyMiddleware({
    target, // target host with the same base path
    changeOrigin: true, // needed for virtual hosted sites
    on: {
        proxyReq: (proxyReq, req, res) => {
            debug(req.originalUrl);
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
        }
    }
});

function initForwarder(config, text) {
    const app = express();
    app.get('/status', (req, res) => {
        res.status(200).send();
    });

    if (verify) {
        app.use(bearerToken());
        verifier = new Verifier.Verifier(config);
        app.use('/', verifier.verify);
    }

    app.use('/', proxy);
    app.listen(PORT, function () {
        debug(text);
    });
}

/**
 * Check that the IDM is responding and the PEP is recognized within the IDM
 * @return an auth token representing the PEP itself to be used in subsequent requests
 */
function connect() {
    let retry = 20;
    return new Promise((resolve, reject) => {
        const connect_with_retry = async () => {
            try {
                await ConfigService.checkConnectivity();
                debug(`Credentials Config Service is now available  - requesting config for ${tenant}`);

                ConfigService.getConfig(tenant)
                    .then((response) => {
                        return resolve(response);
                    })
                    .catch((error) => {
                        return reject('Credentials Config Service rejected config: ' + error.message);
                    });
            } catch (e) {
                debug(e.message);
                retry--;
                if (retry === 0) {
                    return reject('Credentials Config Service is not available. Giving up after 20 attempts');
                }
                debug('retry after 5 seconds.');
                //eslint-disable-next-line snakecase/snakecase
                setTimeout(connect_with_retry, 5000);
            }
        };
        connect_with_retry();
    });
}

function startServer(config) {
    if (clusterWorkerSize > 1) {
        if (cluster.isMaster) {
            for (let i = 0; i < clusterWorkerSize; i++) {
                cluster.fork();
            }
            cluster.on('exit', function (worker) {
                debug('Worker', worker.id, ' has exited.');
            });
        } else {
            initForwarder(config, `Server listening on port ${PORT} and worker ${process.pid}`);
        }
    } else {
        initForwarder(config, `Server listening on port ${PORT} with the single worker ${process.pid}`);
    }
}

if (verify) {
    connect().then(
        (config) => {
            startServer(config);
        },
        (err) => {
            debug(err);
            process.exit(1);
        }
    );
} else {
    startServer(null);
}
