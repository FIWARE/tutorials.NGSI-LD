"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_1 = __importDefault(require("moment"));
function monitor(type, message, payload) {
    global.SOCKET_IO.emit(type, (0, moment_1.default)().format('LTS') + ' - ' + message);
    if (payload && Object.keys(payload).length !== 0) {
        global.SOCKET_IO.emit('payload', payload);
    }
}
exports.default = monitor;
