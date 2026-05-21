import type { Request, Response } from 'express';
import * as IoTDevices from '../devices';
import xmlParser from 'xml-parser';

const DEVICE_API_KEY = process.env.DUMMY_DEVICES_API_KEY || '1234';

const OK = 'success';
const NOT_OK = 'error';

function getResult(status: string, command: string, id: string, info?: string): string {
    if (info) {
        return `<${status} command="${command}" device="${id}">${info}</${status}/>`;
    }
    return `<${status} command="${command}" device="${id}"/>`;
}

export default class XMLCommand {
    actuateWaterSprinkler(req: Request, res: Response): Response {
        const data = xmlParser(req.body as string);
        const deviceId = data.root.attributes.device;
        const command = data.root.name;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(getResult(NOT_OK, command, deviceId, 'not found'));
        } else if (IoTDevices.isUnknownCommand('water', command)) {
            return res.status(422).send(getResult(NOT_OK, command, deviceId, 'unknown command'));
        }

        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(getResult(OK, command, deviceId));
    }

    actuateTractor(req: Request, res: Response): Response {
        const data = xmlParser(req.body as string);
        const deviceId = data.root.attributes.device;
        const command = data.root.name;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(getResult(NOT_OK, command, deviceId, 'not found'));
        } else if (IoTDevices.isUnknownCommand('tractor', command)) {
            return res.status(422).send(getResult(NOT_OK, command, deviceId, 'unknown command'));
        }

        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(getResult(OK, command, deviceId));
    }

    actuateFillingStation(req: Request, res: Response): Response {
        const data = xmlParser(req.body as string);
        const deviceId = data.root.attributes.device;
        const command = data.root.name;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(getResult(NOT_OK, command, deviceId, 'not found'));
        } else if (IoTDevices.isUnknownCommand('filling', command)) {
            return res.status(422).send(getResult(NOT_OK, command, deviceId, 'unknown command'));
        }

        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(getResult(OK, command, deviceId));
    }

    processMqttMessage(topic: string, message: string): void {
        const path = topic.split('/');
        if (path.pop() === 'cmd') {
            const data = xmlParser(message);
            const deviceId = data.root.attributes.device;
            const command = data.root.name;

            if (!IoTDevices.notFound(deviceId)) {
                IoTDevices.actuateDevice(deviceId, command);
                const cmdTopic = `/${DEVICE_API_KEY}/${deviceId}/cmdexe`;
                global.MQTT_CLIENT.publish(cmdTopic, getResult(OK, command, deviceId));
            }
        }
    }
}
