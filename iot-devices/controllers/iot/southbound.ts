import debug from 'debug';
import type { Request, Response } from 'express';
import UltralightCommand from '../../models/command/ultralight';
import JSONCommand from '../../models/command/json';
import XMLCommand from '../../models/command/xml';
import * as Emitter from '../../lib/emitter';
import * as IoTDevices from '../../models/devices';

const log = debug('devices:southbound');

const DEVICE_PAYLOAD = process.env.DUMMY_DEVICES_PAYLOAD || 'ultralight';

interface Command {
    actuateWaterSprinkler(req: Request, res: Response): Response;
    actuateTractor(req: Request, res: Response): Response;
    actuateFillingStation(req: Request, res: Response): Response;
    processMqttMessage(topic: string, message: string): void;
}

let command: Command;

switch (DEVICE_PAYLOAD.toLowerCase()) {
    case 'json':
        command = new JSONCommand();
        break;
    case 'xml':
        command = new XMLCommand();
        break;
    case 'ultralight':
    default:
        log('Device payload not recognized. Using default');
        command = new UltralightCommand();
        break;
}

function tractorHttpCommand(req: Request, res: Response): Response {
    log('tractorHttpCommand');
    IoTDevices.initDevices();
    return command.actuateTractor(req, res);
}

function waterHttpCommand(req: Request, res: Response): Response {
    log('waterHttpCommand');
    IoTDevices.initDevices();
    return command.actuateWaterSprinkler(req, res);
}

function fillingHttpCommand(req: Request, res: Response): Response {
    log('fillingHttpCommand');
    IoTDevices.initDevices();
    return command.actuateFillingStation(req, res);
}

function processMqttMessage(topic: string, message: string): void {
    log('processMqttMessage');
    IoTDevices.initDevices();
    const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://mosquitto';
    Emitter.emit('mqtt', `${mqttBrokerUrl}${topic}  ${message}`);
    command.processMqttMessage(topic, message);
}

export const HTTP = {
    water: waterHttpCommand,
    tractor: tractorHttpCommand,
    filling: fillingHttpCommand,
};

export const MQTT = {
    process: processMqttMessage,
};
