// Connect to an IoT Agent and use fallback values if necessary

const IoTDevices = require('../devices');
const DEVICE_API_KEY = process.env.DUMMY_DEVICES_API_KEY || '1234';

// A series of constants used by our set of devices
const OK = ' OK';
const NOT_OK = ' NOT OK';

/* global MQTT_CLIENT */

//
// Splits the deviceId from the command sent.
//
function getUltralightCommand(string) {
    const command = string.split('@');
    if (command.length === 1) {
        command.push('');
    }
    return command[1];
}

// This processor sends ultralight payload northbound to
// the southport of the IoT Agent and sends measures
// for the animal collars, temperature sensor, filling sensor etc.

// Ultralight 2.0 is a lightweight text based protocol aimed to constrained
// devices and communications
// where the bandwidth and device memory may be limited resources.
//
// A device can report new measures to the IoT Platform using an HTTP GET request to the /iot/d path with the following query parameters:
//
//  i (device ID): Device ID (unique for the API Key).
//  k (API Key): API Key for the service the device is registered on.
//  t (timestamp): Timestamp of the measure. Will override the automatic IoTAgent timestamp (optional).
//  d (Data): Ultralight 2.0 payload.
//
// At the moment the API key and timestamp are unused by the simulator.

class UltralightCommand {
    // The water sprinkler responds to "on" and "off" commands
    // Whilst On the soil humidity will increase.
    // The waterSprinker is not a sensor - it will not report state northbound
    actuateWaterSprinkler(req, res) {
        const keyValuePairs = req.body.split('|') || [''];
        const command = getUltralightCommand(keyValuePairs[0]);
        const deviceId = 'water' + req.params.id;
        const result = keyValuePairs[0] + '| ' + command;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(result + NOT_OK);
        } else if (IoTDevices.isUnknownCommand('water', command)) {
            return res.status(422).send(result + NOT_OK);
        }

        // Update device state
        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(result + OK);
    }

    // The tractor responds to "start", "stop" commands
    // Each command alters the state of the tractor.
    actuateTractor(req, res) {
        const keyValuePairs = req.body.split('|') || [''];
        const command = getUltralightCommand(keyValuePairs[0]);
        const deviceId = 'tractor' + req.params.id;
        const result = keyValuePairs[0] + '| ' + command;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(result + NOT_OK);
        } else if (IoTDevices.isUnknownCommand('tractor', command)) {
            return res.status(422).send(result + NOT_OK);
        }

        // Update device state
        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(result + OK);
    }

    // The filling station can have items added or removed.
    // All changes are manual
    actuateFillingStation(req, res) {
        const keyValuePairs = req.body.split('|') || [''];
        const command = getUltralightCommand(keyValuePairs[0]);
        const deviceId = 'filling' + req.params.id;
        const result = keyValuePairs[0] + '| ' + command;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(result + NOT_OK);
        } else if (IoTDevices.isUnknownCommand('filling', command)) {
            return res.status(422).send(result + NOT_OK);
        }

        // Update device state
        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(result + OK);
    }

    // cmd topics are consumed by the actuators (filling, tractor and water-sprinkler)
    processMqttMessage(topic, message) {
        const path = topic.split('/');
        if (path.pop() === 'cmd') {
            const keyValuePairs = message.split('|') || [''];
            const command = getUltralightCommand(keyValuePairs[0]);
            const deviceId = path.pop();
            const result = keyValuePairs[0] + '| ' + command;

            if (!IoTDevices.notFound(deviceId)) {
                IoTDevices.actuateDevice(deviceId, command);
                const topic = '/' + DEVICE_API_KEY + '/' + deviceId + '/cmdexe';
                MQTT_CLIENT.publish(topic, result + OK);
            }
        }
    }
}

module.exports = UltralightCommand;
