import type { Request, Response } from 'express';
import * as IoTDevices from '../devices';

const DEVICE_API_KEY = process.env.DUMMY_DEVICES_API_KEY || '1234';

const OK = 'OK';
const NOT_OK = 'NOT OK';

function getJSONCommand(body: string): string {
    const obj = JSON.parse(body) as Record<string, unknown>;
    return Object.keys(obj)[0];
}

function getResult(cmd: string, status: string): string {
    const result: Record<string, string> = {};
    result[cmd] = status;
    return JSON.stringify(result);
}

export default class JSONCommand {
    actuateWaterSprinkler(req: Request, res: Response): Response {
        const command = getJSONCommand(req.body as string);
        const deviceId = 'water' + req.params.id;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(getResult(command, NOT_OK));
        } else if (IoTDevices.isUnknownCommand('water', command)) {
            return res.status(422).send(getResult(command, NOT_OK));
        }

        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(getResult(command, OK));
    }

    actuateTractor(req: Request, res: Response): Response {
        const command = getJSONCommand(req.body as string);
        const deviceId = 'tractor' + req.params.id;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(getResult(command, NOT_OK));
        } else if (IoTDevices.isUnknownCommand('tractor', command)) {
            return res.status(422).send(getResult(command, NOT_OK));
        }

        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(getResult(command, OK));
    }

    actuateFillingStation(req: Request, res: Response): Response {
        const command = getJSONCommand(req.body as string);
        const deviceId = 'filling' + req.params.id;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(getResult(command, NOT_OK));
        } else if (IoTDevices.isUnknownCommand('filling', command)) {
            return res.status(422).send(getResult(command, NOT_OK));
        }

        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(getResult(command, OK));
    }

    processMqttMessage(topic: string, message: string): void {
        const path = topic.split('/');
        if (path.pop() === 'cmd') {
            const command = getJSONCommand(message);
            const deviceId = path.pop() ?? '';

            if (!IoTDevices.notFound(deviceId)) {
                IoTDevices.actuateDevice(deviceId, command);
                const cmdTopic = `/${DEVICE_API_KEY}/${deviceId}/cmdexe`;
                global.MQTT_CLIENT.publish(cmdTopic, getResult(command, OK));
            }
        }
    }
}
