import type { Request, Response } from 'express';
import * as IoTDevices from '../devices';

const DEVICE_API_KEY = process.env.DUMMY_DEVICES_API_KEY || '1234';

const OK = ' OK';
const NOT_OK = ' NOT OK';

function getUltralightCommand(string: string): string {
    const command = string.split('@');
    if (command.length === 1) {
        command.push('');
    }
    return command[1];
}

export default class UltralightCommand {
    actuateWaterSprinkler(req: Request, res: Response): Response {
        const keyValuePairs = req.body.split('|') as string[];
        const command = getUltralightCommand(keyValuePairs[0]);
        const deviceId = 'water' + req.params.id;
        const result = `${keyValuePairs[0]}| ${command}`;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(result + NOT_OK);
        } else if (IoTDevices.isUnknownCommand('water', command)) {
            return res.status(422).send(result + NOT_OK);
        }

        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(result + OK);
    }

    actuateTractor(req: Request, res: Response): Response {
        const keyValuePairs = req.body.split('|') as string[];
        const command = getUltralightCommand(keyValuePairs[0]);
        const deviceId = 'tractor' + req.params.id;
        const result = `${keyValuePairs[0]}| ${command}`;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(result + NOT_OK);
        } else if (IoTDevices.isUnknownCommand('tractor', command)) {
            return res.status(422).send(result + NOT_OK);
        }

        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(result + OK);
    }

    actuateFillingStation(req: Request, res: Response): Response {
        const keyValuePairs = req.body.split('|') as string[];
        const command = getUltralightCommand(keyValuePairs[0]);
        const deviceId = 'filling' + req.params.id;
        const result = `${keyValuePairs[0]}| ${command}`;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(result + NOT_OK);
        } else if (IoTDevices.isUnknownCommand('filling', command)) {
            return res.status(422).send(result + NOT_OK);
        }

        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(result + OK);
    }

    processMqttMessage(topic: string, message: string): void {
        const path = topic.split('/');
        if (path.pop() === 'cmd') {
            const keyValuePairs = message.split('|');
            const command = getUltralightCommand(keyValuePairs[0]);
            const deviceId = path.pop() ?? '';
            const result = `${keyValuePairs[0]}| ${command}`;

            if (!IoTDevices.notFound(deviceId)) {
                IoTDevices.actuateDevice(deviceId, command);
                const cmdTopic = `/${DEVICE_API_KEY}/${deviceId}/cmdexe`;
                global.MQTT_CLIENT.publish(cmdTopic, result + OK);
            }
        }
    }
}
