// Connect to an IoT Agent and use fallback values if necessary

const IoTDevices = require('../devices');
const DEVICE_API_KEY = process.env.DUMMY_DEVICES_API_KEY || '1234';

// A series of constants used by our set of devices
const OK = 'OK';
const NOT_OK = 'NOT OK';

/* global MQTT_CLIENT */

//
// Splits the deviceId from the command sent.
//
function getJSONCommand(string) {
  const obj = JSON.parse(string);
  return Object.keys(obj)[0];
}

function getResult(cmd, status) {
  const result = {};
  result[cmd] = status;
  return JSON.stringify(result);
}

// This processor sends JSON payload northbound to
// the southport of the IoT Agent and sends measures
// for the animal collars, temperature sensor, filling sensor etc.

// A device can report new measures to the IoT Platform using an HTTP GET request to the /iot/d path with the following query parameters:
//
//  i (device ID): Device ID (unique for the API Key).
//  k (API Key): API Key for the service the device is registered on.
//  t (timestamp): Timestamp of the measure. Will override the automatic IoTAgent timestamp (optional).
//  d (Data): JSON payload.
//
// At the moment the API key and timestamp are unused by the simulator.

class JSONCommand {
  // The water sprinkler responds to "on" and "off" commands
  // Whilst On the soil humidity will increase.
  // The waterSprinker is not a sensor - it will not report state northbound
  actuateWaterSprinkler(req, res) {
    const command = getJSONCommand(req.body);
    const deviceId = 'water' + req.params.id;

    if (IoTDevices.notFound(deviceId)) {
      return res.status(404).send(getResult(command, NOT_OK));
    } else if (IoTDevices.isUnknownCommand('water', command)) {
      return res.status(422).send(getResult(command, NOT_OK));
    }

    // Update device state
    IoTDevices.actuateDevice(deviceId, command);
    return res.status(200).send(getResult(command, OK));
  }

  // The tractor responds to "start", "stop" commands
  // Each command alters the state of the tractor.
  actuateTractor(req, res) {
    const command = getJSONCommand(req.body);
    const deviceId = 'tractor' + req.params.id;

    if (IoTDevices.notFound(deviceId)) {
      return res.status(404).send(getResult(command, NOT_OK));
    } else if (IoTDevices.isUnknownCommand('tractor', command)) {
      return res.status(422).send(getResult(command, NOT_OK));
    }

    // Update device state
    IoTDevices.actuateDevice(deviceId, command);
    return res.status(200).send(getResult(command, OK));
  }

  // The filling station can have items added or removed.
  // All changes are manual
  actuateFillingStation(req, res) {
    const command = getJSONCommand(req.body);
    const deviceId = 'filling' + req.params.id;

    if (IoTDevices.notFound(deviceId)) {
      return res.status(404).send(getResult(command, NOT_OK));
    } else if (IoTDevices.isUnknownCommand('filling', command)) {
      return res.status(422).send(getResult(command, NOT_OK));
    }

    // Update device state
    IoTDevices.actuateDevice(deviceId, command);
    return res.status(200).send(getResult(command, OK));
  }

  // cmd topics are consumed by the actuators (filling, tractor and water-sprinkler)
  processMqttMessage(topic, message) {
    const path = topic.split('/');
    if (path.pop() === 'cmd') {
      const command = getJSONCommand(message);
      const deviceId = path.pop();

      if (!IoTDevices.notFound(deviceId)) {
        IoTDevices.actuateDevice(deviceId, command);
        const topic = '/' + DEVICE_API_KEY + '/' + deviceId + '/cmdexe';
        MQTT_CLIENT.publish(topic, getResult(command, OK));
      }
    }
  }
}

module.exports = JSONCommand;
