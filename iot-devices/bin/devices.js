// include dependencies
const debug = require('debug')('iot_devices:server');
const os = require("os")
const cluster = require("cluster")
const PORT = process.env.DUMMY_DEVICES_PORT || 3001
const clusterWorkerSize = os.cpus().length

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
    const app = require('../app')
    app.listen(PORT, function () {
      debug(`Server listening on port ${PORT} and worker ${process.pid}`)
    })
  }
} else {
  const app = require('../app')
  app.listen(PORT, function () {
    debug(`Server listening on port ${PORT} with the single worker ${process.pid}`)
  })
}


