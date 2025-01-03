//
// This controller is simulates a receiver for a series of devices.
// Southbound traffic consists of commands which are processed by the
// dummy IoT devices
//

const debug = require('debug')('devices:southbound');
const UltralightCommand = require('../../models/command/ultralight');
const JSONCommand = require('../../models/command/json');
const XMLCommand = require('../../models/command/xml');
const Emitter = require('../../lib/emitter');

const DEVICE_PAYLOAD = process.env.DUMMY_DEVICES_PAYLOAD || 'ultralight';

let Command;

switch (DEVICE_PAYLOAD.toLowerCase()) {
    case 'ultralight':
        Command = new UltralightCommand();
        break;
    case 'json':
        Command = new JSONCommand();
        break;
    case 'lorawan':
        //Command = new LoraCommand();
        break;
    case 'sigfox':
        //Command = new SigfoxCommand();
        break;
    case 'xml':
        Command = new XMLCommand();
        break;
    default:
        debug('Device payload not recognized. Using default');
        Command = new UltralightCommand();
        break;
}

// The bell will respond to the "ring" command.
// this will briefly set the bell to on.
// The bell  is not a sensor - it will not report state northbound
function tractorHttpCommand(req, res) {
    debug('tractorHttpCommand');
    return Command.actuateTractor(req, res);
}

// The door responds to "open", "close", "lock" and "unlock" commands
// Each command alters the state of the door. When the door is unlocked
// it can be opened and shut by external events.
function waterHttpCommand(req, res) {
    debug('waterHttpCommand');
    return Command.actuateWaterSprinkler(req, res);
}

// The filling can re-filled, or a proportion can be removed.
function fillingHttpCommand(req, res) {
    debug('fillingHttpCommand');
    return Command.actuateFillingStation(req, res);
}

// The device monitor will display all MQTT messages on screen.
// cmd topics are consumed by the actuators (water sprinkler, tractor and fillingStation)
function processMqttMessage(topic, message) {
    debug('processMqttMessage');
    const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://mosquitto';
    Emitter.emit('mqtt', mqttBrokerUrl + topic + '  ' + message);
    Command.processMqttMessage(topic, message);
}

module.exports = {
    HTTP: {
        water: waterHttpCommand,
        tractor: tractorHttpCommand,
        filling: fillingHttpCommand
    },
    MQTT: {
        process: processMqttMessage
    }
};
