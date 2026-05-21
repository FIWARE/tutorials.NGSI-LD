import debug from 'debug';
import * as Emitter from '../../lib/emitter';
import _ from 'lodash';

const log = debug('devices:ultralight');

const DEVICE_API_KEY = process.env.DUMMY_DEVICES_API_KEY || '1234';
const IOT_AGENT_URL =
    `http://${process.env.IOTA_HTTP_HOST || 'localhost'}` +
    `:${process.env.IOTA_HTTP_PORT || 7896}` +
    `${process.env.IOTA_DEFAULT_RESOURCE || '/iot/d'}`;

function hashCode(str: string): number {
    let hash = 0;
    if (str.length === 0) {
        return hash;
    }
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0;
    }
    return Math.abs(hash);
}

function getAPIKey(deviceId: string): string | number {
    return process.env.DUMMY_DEVICES_API_KEY ? DEVICE_API_KEY : hashCode(deviceId.replace(/[0-9]/gi, ''));
}

export default class UltralightMeasure {
    private headers: Record<string, string>;

    constructor(headers: Record<string, string>) {
        this.headers = headers;
        this.headers['Content-Type'] = 'text/plain';
    }

    format(state: string): string {
        const keyValuePairs = state.split('|');
        const obj: Record<string, string> = {};
        for (let i = 0; i < keyValuePairs.length; i += 2) {
            obj[keyValuePairs[i]] = keyValuePairs[i + 1];
        }
        const hiddenKeys = (obj.hide || '').split(',');
        delete obj.hide;
        _.forEach(hiddenKeys, (key) => {
            delete obj[key];
        });

        let payload = '';
        _.forEach(obj, (value, key) => {
            if (!hiddenKeys.includes(key)) {
                payload += `${key}|${value}|`;
            }
        });
        return payload.substring(0, payload.length - 1);
    }

    sendAsHTTP(deviceId: string, state: string): Promise<Response | void> {
        const key = getAPIKey(deviceId);
        const debugText = `POST ${IOT_AGENT_URL}?i=${deviceId}&k=${key}`;
        Emitter.emit('http', `${debugText}  ${state}`);
        return fetch(`${IOT_AGENT_URL}?i=${deviceId}&k=${key}`, {
            method: 'POST',
            headers: this.headers,
            body: state,
        }).catch((e: Error) => {
            log(`${debugText} ${(e as NodeJS.ErrnoException).code}`);
        });
    }

    sendAsMQTT(deviceId: string, state: string): void {
        const topic = `/${getAPIKey(deviceId)}/${deviceId}/attrs`;
        global.MQTT_CLIENT.publish(topic, state);
    }
}
