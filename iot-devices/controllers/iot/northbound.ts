import debug from 'debug';
import * as Security from '../security';
import UltralightMeasure from '../../models/measure/ultralight';
import JSONMeasure from '../../models/measure/json';
import XMLMeasure from '../../models/measure/xml';

const log = debug('devices:northbound');

const DEVICE_TRANSPORT = process.env.DUMMY_DEVICES_TRANSPORT || 'HTTP';
const DEVICE_PAYLOAD = process.env.DUMMY_DEVICES_PAYLOAD || 'ultralight';

interface Measure {
    format(state: string): string;
    sendAsHTTP(deviceId: string, state: string): Promise<Response | void>;
    sendAsMQTT(deviceId: string, state: string): void;
}

const headers: Record<string, string> = {};
let measure: Measure;

function setDevice(): void {
    switch (DEVICE_PAYLOAD.toLowerCase()) {
        case 'json':
            measure = new JSONMeasure(headers);
            break;
        case 'xml':
            measure = new XMLMeasure(headers);
            break;
        case 'ultralight':
        default:
            measure = new UltralightMeasure(headers);
            break;
    }
}

function setAuthToken(header: Record<string, string>, callback: () => void): void {
    Security.oa
        .getOAuthPasswordCredentials(
            process.env.DUMMY_DEVICES_USER ?? '',
            process.env.DUMMY_DEVICES_PASSWORD ?? ''
        )
        .then((results) => {
            header.Authorization = `Bearer ${(results as { access_token: string }).access_token}`;
            callback();
        })
        .catch((error: Error) => {
            log(error);
            log('retry after 5 seconds.');
            setTimeout(() => setAuthToken(header, callback), 5000);
        });
}

if (process.env.DUMMY_DEVICES_USER && process.env.DUMMY_DEVICES_PASSWORD) {
    setAuthToken(headers, setDevice);
} else {
    setDevice();
}

export function sendMeasure(deviceId: string, state: string): void {
    if (DEVICE_TRANSPORT === 'HTTP') {
        measure.sendAsHTTP(deviceId, state);
    }
    if (DEVICE_TRANSPORT === 'MQTT') {
        measure.sendAsMQTT(deviceId, state);
    }
}

export function format(state: string): string {
    return measure.format(state);
}
