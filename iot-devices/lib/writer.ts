import JSONMeasure from '../models/measure/json';
import { createWriteStream, WriteStream } from 'fs';

const HISTORY_LOG = process.env.HISTORY_LOG;
const json = new JSONMeasure({});
const stream: WriteStream | null = HISTORY_LOG ? createWriteStream(HISTORY_LOG, { flags: 'a' }) : null;

export function write(deviceId: string, state: string): void {
    if (!stream || !deviceId.startsWith('cow')) {
        return;
    }
    const data = JSON.parse(json.format(state, false)) as Record<string, string>;
    let line = `${data.o},${deviceId},${data.bpm},${data.gps},${data.d},`;
    line += `${data.accel_x},${data.accel_y},${data.bmp},${data.body_temp},${data.step_count},${data.by}`;
    stream.write(line + '\n');
}
