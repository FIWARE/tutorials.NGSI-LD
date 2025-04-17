const debug = require('debug')('devices:server');
const PORT = process.env.DUMMY_DEVICES_PORT || 3001;
const app = require('../app');

app.listen(PORT, function () {
    debug(`Server listening on port ${PORT} with the single worker ${process.pid}`);
});

/*
// include dependencies
const debug = require('debug')('devices:server');
const os = require("os")
const cluster = require("cluster")
const PORT = process.env.DUMMY_DEVICES_PORT || 3001
const clusterWorkerSize = os.cpus().length
const IoTDevices = require('../models/devices');

if (clusterWorkerSize > 1) {
  if (cluster.isMaster) {
    for (let i=0; i < clusterWorkerSize; i++) {
      worker = cluster.fork();
      worker.on('message', function (msg){
      if(msg.device === 'barn'){
        IoTDevices.barnDoor(msg.status);
        debug(`${msg.status} received`);
      }
    });
    }
    cluster.on("exit", function(worker) {
      debug("Worker", worker.id, " has exited.")
    })
    cluster.on('message', function (x, msg){
       if(msg.device === 'barn'){
         Object.keys(cluster.workers).forEach(function(id) {

          debug("Worker", id, `sent ${msg.status}`)
            cluster.workers[id].send(msg);
        });
       }      
     });
  } else {
    // mount `exampleProxy` in web server
    const app = require('../app')
    app.listen(PORT, function () {
      debug(`Server listening on port ${PORT} and worker ${process.pid}`)
       console.log(`Server listening on port ${PORT} and worker ${process.pid}`)
    })
  }
} else {
  const app = require('../app')
  app.listen(PORT, function () {
    debug(`Server listening on port ${PORT} with the single worker ${process.pid}`)
  })
}*/
