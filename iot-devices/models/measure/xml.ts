import debug from 'debug';
import * as Emitter from '../../lib/emitter';

const log = debug('devices:xml');

const DEVICE_API_KEY = process.env.DUMMY_DEVICES_API_KEY || '1234';
const IOT_AGENT_URL =
    `http://${process.env.IOTA_HTTP_HOST || 'localhost'}` +
    `:${process.env.IOTA_HTTP_PORT || 7896}` +
    `${process.env.IOTA_DEFAULT_RESOURCE || '/iot/xml'}`;

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

function ultralightToXML(key: string, deviceId: string, state: string): string {
    const keyValuePairs = state.split('|');
    let payload = `<measure device="${deviceId}" key="${key}">\n`;
    for (let i = 0; i < keyValuePairs.length; i += 2) {
        payload += `<${keyValuePairs[i]} value="${keyValuePairs[i + 1]}"/>\n`;
    }
    payload += '</measure>';
    return payload;
}

export default class XMLMeasure {
    private headers: Record<string, string>;

    constructor(headers: Record<string, string>) {
        this.headers = headers;
        this.headers['Content-Type'] = 'application/xml';
    }

    format(state: string): string {
        return state;
    }

    sendAsHTTP(deviceId: string, state: string): Promise<Response | void> {
        const payload = ultralightToXML(DEVICE_API_KEY, deviceId, state);
        const debugText = `POST ${IOT_AGENT_URL}`;
        Emitter.emit(
            'http',
            `${debugText}<br/> ${payload.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}`
        );
        return fetch(IOT_AGENT_URL, {
            method: 'POST',
            headers: this.headers,
            body: payload,
        }).catch((e: Error) => {
            log(`${debugText} ${(e as NodeJS.ErrnoException).code}`);
        });
    }

    sendAsMQTT(deviceId: string, state: string): void {
        const topic = `/${getAPIKey(deviceId)}/${deviceId}/attrs`;
        global.MQTT_CLIENT.publish(topic, state);
    }
}
