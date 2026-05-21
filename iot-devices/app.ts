import createError from 'http-errors';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as Southbound from './controllers/iot/southbound';
import debug from 'debug';
import mqtt from 'mqtt';
import morgan from 'morgan';
import * as IoTDevices from './models/devices';
import * as Animals from './models/animals';
import * as MyCache from './lib/cache';
import healthcheck from 'express-healthcheck';

const log = debug('devices:iot-device');

const DEVICE_TRANSPORT = process.env.DUMMY_DEVICES_TRANSPORT || 'HTTP';
const DEVICE_PAYLOAD = process.env.DUMMY_DEVICES_PAYLOAD || 'ultralight';
const HISTORY_LOG = process.env.HISTORY_LOG;

function rawBody(req: Request, _res: Response, next: NextFunction): void {
    req.setEncoding('utf8');
    req.body = '';
    req.on('data', (chunk: string) => {
        req.body += chunk;
    });
    req.on('end', () => {
        next();
    });
}

const iot = express();
iot.use(morgan('dev'));
iot.use(rawBody);

const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://mosquitto';
global.MQTT_CLIENT = mqtt.connect(mqttBrokerUrl);

const iotRouter = express.Router();

log(`Devices use a ${DEVICE_PAYLOAD} payload`);

if (HISTORY_LOG) {
    log(`Logging measures to ${HISTORY_LOG}`);
}

if (DEVICE_TRANSPORT === 'HTTP') {
    log('Listening on HTTP endpoints: /iot/water, iot/tractor, /iot/filling');
    iotRouter.post('/iot/water:id', Southbound.HTTP.water);
    iotRouter.post('/iot/tractor:id', Southbound.HTTP.tractor);
    iotRouter.post('/iot/filling:id', Southbound.HTTP.filling);
}

iotRouter.get('/status', (_req: Request, res: Response) => {
    IoTDevices.emitOverallFarmStatus();
    res.status(200).send();
});

iotRouter.get('/devices/:type', (req: Request, res: Response) => {
    const result = IoTDevices.fireDevices(String(req.params.type));
    res.status(result ? 204 : 401).send();
});

iotRouter.put('/devices/tractor', (_req: Request, res: Response) => {
    IoTDevices.updateTractorStatus();
    res.status(204).send();
});

iotRouter.put('/devices', (req: Request, res: Response) => {
    MyCache.setCacheValues(JSON.parse(req.body as string) as Record<string, string>);
    res.status(204).send();
});

iotRouter.get('/animals', (_req: Request, res: Response) => {
    Animals.fireAnimalCollars();
    res.status(204).send();
});

iotRouter.put('/barndoor', (_req: Request, res: Response) => {
    IoTDevices.barnDoor();
    res.status(204).send();
});

iotRouter.put('/weather', (req: Request, res: Response) => {
    IoTDevices.alterWeather((req.body as { action: string }).action);
    res.status(204).send();
});

iotRouter.put('/temperature/:id', (req: Request, res: Response) => {
    IoTDevices.initDevices();
    void IoTDevices.alterTemperature(String(req.params.id), (req.body as { raise: boolean }).raise);
    res.status(204).send();
});

iot.use('/', iotRouter);
iot.use('/health', healthcheck());

if (DEVICE_TRANSPORT === 'MQTT') {
    const apiKeys = process.env.DUMMY_DEVICES_API_KEYS || process.env.DUMMY_DEVICES_API_KEY || '1234';

    global.MQTT_CLIENT.on('connect', () => {
        apiKeys.split(',').forEach((apiKey) => {
            const topic = '/' + apiKey + '/#';
            log('Subscribing to MQTT Broker: ' + mqttBrokerUrl + ' ' + topic);
            global.MQTT_CLIENT.subscribe(topic);
            global.MQTT_CLIENT.subscribe(topic + '/#');
        });
    });

    global.MQTT_CLIENT.on('message', (topic: string, message: Buffer) => {
        Southbound.MQTT.process(topic.toString(), message.toString());
    });
}

iot.use((_req: Request, res: Response) => {
    res.status(404).send(new createError.NotFound());
});

export default iot;
