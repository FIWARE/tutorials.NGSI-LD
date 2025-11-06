const createError = require('http-errors');
const express = require('express');
const Southbound = require('./controllers/iot/southbound');
const debug = require('debug')('devices:iot-device');
const mqtt = require('mqtt');
const logger = require('morgan');
const IoTDevices = require('./models/devices');
const MyCache = require('./lib/cache');

/* global MQTT_CLIENT */
const DEVICE_TRANSPORT = process.env.DUMMY_DEVICES_TRANSPORT || 'HTTP';
const DEVICE_PAYLOAD = process.env.DUMMY_DEVICES_PAYLOAD || 'ultralight';

// The motion sensor offers no commands, hence it does not need an endpoint.

// parse everything as a stream of text
function rawBody(req, res, next) {
  req.setEncoding('utf8');
  req.body = '';
  req.on('data', function (chunk) {
    req.body += chunk;
  });
  req.on('end', function () {
    next();
  });
}

const iot = express();
iot.use(logger('dev'));
iot.use(rawBody);

const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://mosquitto';
global.MQTT_CLIENT = mqtt.connect(mqttBrokerUrl);

const iotRouter = express.Router();

debug(`Devices use a ${DEVICE_PAYLOAD} payload`);
// If the Ultralight Dummy Devices are configured to use the HTTP transport, then
// listen to the command endpoints using HTTP
if (DEVICE_TRANSPORT === 'HTTP') {
  debug('Listening on HTTP endpoints: /iot/water, iot/tractor, /iot/filling');
  // The router listening on the IoT port is responding to commands going southbound only.
  // Therefore we need a route for each actuator
  iotRouter.post('/iot/water:id', Southbound.HTTP.water);
  iotRouter.post('/iot/tractor:id', Southbound.HTTP.tractor);
  iotRouter.post('/iot/filling:id', Southbound.HTTP.filling);
}

iotRouter.get('/status', (req, res) => {
  IoTDevices.emitOverallFarmStatus();
  res.status(200).send();
});

iotRouter.get('/devices/:type', (req, res) => {
  IoTDevices.fireDevices(req.params.type);
  res.status(204).send();
});

iotRouter.put('/devices/tractor', (req, res) => {
  IoTDevices.updateTractorStatus();
  res.status(204).send();
});

iotRouter.put('/devices', (req, res) => {
  MyCache.setCacheValues(JSON.parse(req.body));
  res.status(204).send();
});

iotRouter.get('/animals', (req, res) => {
  IoTDevices.fireAnimalCollars();
  res.status(204).send();
});

iotRouter.put('/barndoor', (req, res) => {
  IoTDevices.barnDoor();
  res.status(204).send();
});
iotRouter.put('/weather', (req, res) => {
  IoTDevices.alterWeather(req.body.action);
  res.status(204).send();
});
iotRouter.put('/temperature/:id', (req, res) => {
  IoTDevices.initDevices();
  IoTDevices.alterTemperature(req.params.id, req.body.raise);
  res.status(204).send();
});
iot.use('/', iotRouter);
iot.use('/health', require('express-healthcheck')());

// If the IoT Devices are configured to use the MQTT transport, then
// subscribe to the assoicated topics for each device.
if (DEVICE_TRANSPORT === 'MQTT') {
  const apiKeys =
    process.env.DUMMY_DEVICES_API_KEYS ||
    process.env.DUMMY_DEVICES_API_KEY ||
    '1234';

  MQTT_CLIENT.on('connect', () => {
    apiKeys.split(',').forEach((apiKey) => {
      const topic = '/' + apiKey + '/#';
      debug('Subscribing to MQTT Broker: ' + mqttBrokerUrl + ' ' + topic);
      MQTT_CLIENT.subscribe(topic);
      MQTT_CLIENT.subscribe(topic + '/#');
    });
  });

  mqtt.connect(mqttBrokerUrl);

  MQTT_CLIENT.on('message', function (topic, message) {
    // message is a buffer. The IoT devices will be listening and
    // responding to commands going southbound.
    Southbound.MQTT.process(topic.toString(), message.toString());
  });
}

// catch 404 and forward to error handler
iot.use(function (req, res) {
  res.status(404).send(new createError.NotFound());
});

module.exports = iot;
