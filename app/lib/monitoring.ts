import moment from 'moment';

function monitor(type: string, message: string, payload?: Record<string, unknown>): void {
    global.SOCKET_IO.emit(type, moment().format('LTS') + ' - ' + message);

    if (payload && Object.keys(payload).length !== 0) {
        global.SOCKET_IO.emit('payload', payload);
    }
}

export default monitor;
