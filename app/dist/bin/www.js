#!/usr/bin/env node
"use strict";
/**
 * Module dependencies.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("../app"));
const debug_1 = __importDefault(require("debug"));
const http_1 = __importDefault(require("http"));
const log = (0, debug_1.default)('tutorial:server');
/**
 * Get ports from environment and store in Express.
 */
const port = normalizePort(process.env.WEB_APP_PORT || '3000');
app_1.default.set('port', port);
/**
 * Create HTTP server for app
 */
const server = http_1.default.createServer(app_1.default);
// eslint-disable-next-line @typescript-eslint/no-require-imports
global.SOCKET_IO = require('socket.io')(server);
/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);
server.on('error', onError);
server.on('listening', onListeningServer);
/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
    const portNum = parseInt(val, 10);
    if (isNaN(portNum)) {
        // named pipe
        return val;
    }
    if (portNum >= 0) {
        // port number
        return portNum;
    }
    return false;
}
/**
 * Event listener for HTTP server "error" event.
 */
function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }
    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}
/**
 * Event listener for HTTP server "listening" event.
 */
function onListeningServer() {
    const addr = server.address();
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + (addr ? addr.port : '');
    log('Listening on ' + bind);
}
