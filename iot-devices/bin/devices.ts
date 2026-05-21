import debug from 'debug';
import os from 'os';
import cluster from 'cluster';
import type { Application } from 'express';

const log = debug('devices:server');
const PORT = process.env.DUMMY_DEVICES_PORT || 3001;
const clusterWorkerSize = os.cpus().length;

function startApp(): void {
    void import('../app').then(({ default: app }) => {
        (app as Application).listen(PORT, () => {
            log(`Server listening on port ${PORT} and worker ${process.pid}`);
            console.log(`Server listening on port ${PORT} and worker ${process.pid}`);
        });
    });
}

if (clusterWorkerSize > 1) {
    if (cluster.isPrimary) {
        for (let i = 0; i < clusterWorkerSize; i++) {
            cluster.fork();
        }
        cluster.on('exit', (worker) => {
            log('Worker', worker.id, ' has exited.');
            cluster.fork();
        });
    } else {
        startApp();
    }
} else {
    void import('../app').then(({ default: app }) => {
        (app as Application).listen(PORT, () => {
            log(`Server listening on port ${PORT} with the single worker ${process.pid}`);
        });
    });
}
