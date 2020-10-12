// Connect to an IoT Agent and use fallback values if necessary

const IoTDevices = require('../devices');
const DEVICE_API_KEY = process.env.DUMMY_DEVICES_API_KEY || '1234';
const xmlParser = require('xml-parser');

// A series of constants used by our set of devices
const OK = 'success';
const NOT_OK = 'error';

/* global MQTT_CLIENT */

//
// Splits the deviceId from the command sent.
//
function getResult(status, command, id, info) {
    if (info) {
        return '<' + status + ' command="' + command + '" device="' + id + '">' + info + '</' + status + '/>';
    }
    return '<' + status + ' command="' + command + '" device="' + id + '"/>';
}

// This processor sends XML payload northbound to
// the southport of the IoT Agent and sends measures
// for the animal collars, temperature sensor, filling sensor etc.

class XMLCommand {
    // The water sprinkler responds to "on" and "off" commands
    // Whilst On the soil humidity will increase.
    // The waterSprinker is not a sensor - it will not report state northbound
    actuateWaterSprinkler(req, res) {
        const data = xmlParser(req.body);
        const deviceId = data.root.attributes.device;
        const command = data.root.name;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(getResult(NOT_OK, command, deviceId, 'not found'));
        } else if (IoTDevices.isUnknownCommand('water', command)) {
            return res.status(422).send(getResult(NOT_OK, command, deviceId, 'unknown command'));
        }

        // Update device state
        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(getResult(OK, command, deviceId));
    }

    // The tractor responds to "start", "stop" commands
    // Each command alters the state of the tractor.
    actuateTractor(req, res) {
        const data = xmlParser(req.body);
        const deviceId = data.root.attributes.device;
        const command = data.root.name;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(getResult(NOT_OK, command, deviceId, 'not found'));
        } else if (IoTDevices.isUnknownCommand('tractor', command)) {
            return res.status(422).send(getResult(NOT_OK, command, deviceId, 'unknown command'));
        }

        // Update device state
        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(getResult(OK, command, deviceId));
    }

    // The filling station can have items added or removed.
    // All changes are manual
    actuateFillingStation(req, res) {
        const data = xmlParser(req.body);
        const deviceId = data.root.attributes.device;
        const command = data.root.name;

        if (IoTDevices.notFound(deviceId)) {
            return res.status(404).send(getResult(NOT_OK, command, deviceId, 'not found'));
        } else if (IoTDevices.isUnknownCommand('filling', command)) {
            return res.status(422).send(getResult(NOT_OK, command, deviceId, 'unknown command'));
        }

        // Update device state
        IoTDevices.actuateDevice(deviceId, command);
        return res.status(200).send(getResult(OK, command, deviceId));
    }
    // cmd topics are consumed by the actuators (filling, tractor and water-sprinkler)
    processMqttMessage(topic, message) {
        const path = topic.split('/');
        if (path.pop() === 'cmd') {
            const data = xmlParser(message);
            const deviceId = data.root.attributes.device;
            const command = data.root.name;

            if (!IoTDevices.notFound(deviceId)) {
                IoTDevices.actuateDevice(deviceId, command);
                const topic = '/' + DEVICE_API_KEY + '/' + deviceId + '/cmdexe';
                MQTT_CLIENT.publish(topic, getResult(OK, command, deviceId));
            }
        }
    }
}

module.exports = XMLCommand;
