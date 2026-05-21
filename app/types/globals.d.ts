import { Server } from 'socket.io';
declare global {
    var SOCKET_IO: Server;
}
export {};
