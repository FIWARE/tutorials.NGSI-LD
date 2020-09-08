//
// This controller is simulates a series of devices.
// The internal state is maintained using the Ultralight protocol
//

/* global SOCKET_IO */

const NodeCache = require('node-cache');
const myCache = new NodeCache();
const _ = require('lodash');
const debug = require('debug')('tutorial:devices');
const Northbound = require('../controllers/iot/northbound');

// A series of constants used by our set of devices

const WATER_OFF = 's|OFF';
const WATER_ON = 's|ON';

const HUMIDITY_WET = 'h|80';
const TRACTOR_IDLE = 's|IDLE';

const PIG_IDLE = 's|AT_REST';
const COW_IDLE = 's|AT_REST';
const PIG_STATE = ['AT_REST','FORAGING', 'FORAGING', 'FORAGING', 'DRINKING', 'WALLOWING'];
const COW_STATE = ['AT_REST','AT_REST', 'GRAZING', 'GRAZING', 'GRAZING', 'DRINKING'];
const OFFSET_RATE = {
    AT_REST : 0,
    GRAZING: 0,
    FORAGING : 2,
    DRINKING : 1,
    WALLOWING: 5,
}

const COW_HEART_RATE = 50;
const PIG_HEART_RATE = 60;


const DEFAULT_TEMPERATURE = 't|25';
const FILLING_STATION_FULL = 'f|1';
const FILLING_STATION_EMPTY = 'f|0';

const VALID_COMMANDS = {
    tractor: ['start', 'stop'],
    water: ['on', 'off'],
    filling: ['add', 'remove', 'refill']
};

// Change the state of a dummy IoT device based on the command received.
function actuateDevice(deviceId, command) {
    debug('actuateDevice: ' + deviceId + ' ' + command);
    let state;
    switch (deviceId.replace(/\d/g, '')) {
        case 'water':
            if (command === 'on') {
                setDeviceState(deviceId, WATER_ON, false);
                SOCKET_IO.emit(deviceId, WATER_ON);
            } else if (command === 'off') {
                setDeviceState(deviceId, WATER_OFF, false);
                SOCKET_IO.emit(deviceId, WATER_OFF);
            }
            break;
        case 'tractor':
            state = getDeviceState(deviceId);
            if (command === 'start') {
                state.s = 'MOVING';
            } else if (command === 'stop') {
                state.s = 'IDLE';
            }
            setDeviceState(deviceId, toUltraLight(state));
            break;
        case 'filling':
            if (command === 'refill') {
                setDeviceState(deviceId, FILLING_STATION_FULL, true);
            } else if (command === 'add') {
                setTimeout(fillingStationFill, 1000, deviceId);
                setTimeout(fillingStationFill, 2000, deviceId);
                setTimeout(fillingStationFill, 3000, deviceId);
            } else if (command === 'remove') {
                setTimeout(fillingStationEmpty, 1000, deviceId);
                setTimeout(fillingStationEmpty, 2000, deviceId);
                setTimeout(fillingStationEmpty, 3000, deviceId);
            }
            break;
    }
}

// Set up 36 IoT devices, animal collars, temperature sensors, filling sensors etc. for each of 4 locations.
//
// The tractor can be IDLE, MOVING or SOWING and registers location
// The water sprinkler can be ON or OFF - it does not report state.
// The motion sensor counts the number of people passing by
// The animal collars register location and state fo the animal
// The soil humidity sensor will slowly dry out unless water is added
// The temperature sensor will drift towards a preferred target
// The filling station will change level in response to add/remove c
function initDevices() {
    debug('initDevices');
    // Every few seconds, update the state of the dummy devices in a
    // semi-random fashion.
    setInterval(changeTractorState, 10000);
    setInterval(activateAnimalCollars, 5000);
    setInterval(activateDevices, 3000);
}

let isTractorActive = false;
let isDevicesActive = false;
let devicesInitialized = false;

myCache.set('pig001', PIG_IDLE + '|gps|13.3501, 52.5143');
myCache.set('pig002', PIG_IDLE + '|gps|13.3696, 52.5163');
myCache.set('pig003', PIG_IDLE + '|gps|13.3597, 52.5162');
myCache.set('pig004', PIG_IDLE + '|gps|13.3124, 52.4898');

myCache.set('cow001', COW_IDLE + '|gps|13.3504, 52.5140');
myCache.set('cow002', COW_IDLE + '|gps|13.37, 52.516');
myCache.set('cow003', COW_IDLE + '|gps|13.6,52.3');
myCache.set('cow004', COW_IDLE + '|gps|13.3126, 52.4895');

myCache.set('water001', WATER_OFF, false);
myCache.set('water002', WATER_OFF, false);
myCache.set('water003', WATER_OFF, false);
myCache.set('water004', WATER_OFF, false);

myCache.set('tractor001', TRACTOR_IDLE + '|gps|13.3505, 52.5144');
myCache.set('tractor002', TRACTOR_IDLE + '|gps|13.3698, 52.5163');
myCache.set('tractor003', TRACTOR_IDLE + '|gps|13.3598, 52.5165');
myCache.set('tractor004', TRACTOR_IDLE + '|gps|13.3127, 52.4893');

myCache.set('targetTractor001', 'x|0|y|1');
myCache.set('targetTractor002', 'x|1|y|0');
myCache.set('targetTractor003', 'x|-1|y|0');
myCache.set('targetTractor004', 'x|0|y|-1');

myCache.set('humidity001', HUMIDITY_WET);
myCache.set('humidity002', HUMIDITY_WET);
myCache.set('humidity003', HUMIDITY_WET);
myCache.set('humidity004', HUMIDITY_WET);

myCache.set('temperature001', DEFAULT_TEMPERATURE);
myCache.set('temperature002', DEFAULT_TEMPERATURE);
myCache.set('temperature003', DEFAULT_TEMPERATURE);
myCache.set('temperature004', DEFAULT_TEMPERATURE);

myCache.set('targetTemp001', DEFAULT_TEMPERATURE);
myCache.set('targetTemp002', DEFAULT_TEMPERATURE);
myCache.set('targetTemp003', DEFAULT_TEMPERATURE);
myCache.set('targetTemp004', DEFAULT_TEMPERATURE);

myCache.set('filling001', FILLING_STATION_FULL);
myCache.set('filling002', FILLING_STATION_FULL);
myCache.set('filling003', FILLING_STATION_FULL);
myCache.set('filling004', FILLING_STATION_EMPTY);

// Update the state of a tractor
function changeTractorState() {
    if (isTractorActive) {
        return;
    }

    isTractorActive = true;
    const deviceIds = myCache.keys();

    _.forEach(deviceIds, (deviceId) => {
        const state = getDeviceState(deviceId);
        const isSensor = true;

        switch (deviceId.replace(/\d/g, '')) {
            case 'tractor':
                //  The tractor is IDLE, MOVING or SOWING
                if (state.s !== 'IDLE') {
                    const rate = getTractorState(deviceId, 'tractor') === 'MOVING' ? 3 : 6;
                    state.s = getRandom() > rate ? 'MOVING' : 'SOWING';
                }
                setDeviceState(deviceId, toUltraLight(state), isSensor);
                break;
        }
    });
    isTractorActive = false;
}

function addAndTrim(value, add) {
    const newValue = add ? parseFloat(value) + 0.001 : parseFloat(value) - 0.001;
    return Math.round(newValue * 1000) / 1000;
}

function randomWalk(state){
    const location = state.gps.split(',');
    let y = location[0];
    let x = location[1];
    if (getRandom() > 7) {
        x = addAndTrim(x, true);
    }
    if (getRandom() > 7) {
        x = addAndTrim(x, false);
    }
    if (getRandom() > 7) {
        y = addAndTrim(y, true);
    }
    if (getRandom() > 7) {
        y = addAndTrim(y, false);
    }
    state.gps = y + "," + x;
}

function activateAnimalCollars(){
    isDevicesActive = true;

    const deviceIds = myCache.keys();

    _.forEach(deviceIds, (deviceId) => {
        const state = getDeviceState(deviceId);
        const isSensor = true;

        switch (deviceId.replace(/\d/g, '')) {

            case 'pig':
                state.bpm = PIG_HEART_RATE + 2 * OFFSET_RATE[state.s] + getRandom() % 4;
                if (state.s === 'AT_REST'){
                    if (getRandom() * getRandom() > 63){
                        state.s = PIG_STATE [getRandom() % 6];
                    }
                } else {
                    randomWalk(state);
                    if (getRandom() > 7){

                        state.s = (getRandom() > 3) ? PIG_STATE [getRandom() % 6] : 'AT_REST';
                    }
                }
                setDeviceState(deviceId, toUltraLight(state), isSensor);
                break;
            case 'cow':
                state.bpm = COW_HEART_RATE + 2 * OFFSET_RATE[state.s] + getRandom() % 4;
                if (state.s === 'AT_REST'){
                    if (getRandom() * getRandom() > 80){
                        state.s =  COW_STATE [getRandom() % 6];
                    }
                
                } else {
                    randomWalk(state, COW_HEART_RATE);
                    if (getRandom() > 8){
                        state.s =  (getRandom() > 7) ? COW_STATE [getRandom() % 6] : 'GRAZING';
                    }
                }
                setDeviceState(deviceId, toUltraLight(state), isSensor);
                break;
            default:
                break;
        }

       
    });
    isDevicesActive = false;

}

// Update state of Sensors
function activateDevices() {
    if (isDevicesActive) {
        return;
    }

    isDevicesActive = true;

    const deviceIds = myCache.keys();

    _.forEach(deviceIds, (deviceId) => {
        const state = getDeviceState(deviceId);
        const isSensor = true;
        let humid;
        let isDry;
        let target;
        let targetTemp;
        let location;

        switch (deviceId.replace(/\d/g, '')) {
            case 'humidity':
                humid = parseInt(state.h);
                isDry = (getRandom() > 5);

                // If the water is ON, randomly increase the soil humidity.
                if (getWaterState(deviceId, 'humidity') === 'ON') {
                    state.h = humid + getRandom() % 3;
                } else if (isDry && (humid > 50) ) {
                    state.h = humid - getRandom() % 3;
                } else if (isDry && (humid > 30) ) {
                    state.h = humid - 3 + getRandom() % 4;
                } else if (humid <= 30) {
                    state.h = humid + 3 - getRandom() % 4;
                }

                if (state.h > 100) {
                    state.h = 100;
                }
                if (state.h < 0) {
                    state.h = 0;
                }
                break;
            case 'tractor':
                target = getDeviceState('targetTractor' + deviceId.replace(/[a-zA-Z]/g, ''));
                location = state.gps.split(',');
                state.y = parseFloat(location[0]);
                state.x = parseFloat(location[1]);

                if (state.s === 'SOWING') {
                    if (getRandom() > 9) {
                        state.y = Math.round((state.y + (0.001 * parseInt(target.x))) * 1000) / 1000;
                        state.x = Math.round((state.x + (0.001 * parseInt(target.y)))  * 1000) / 1000;

                    }
                }

                if (state.s === 'MOVING') {
                    state.x = Math.round((state.x + (parseInt(target.x) / 300))  * 1000) / 1000;
                    state.y = Math.round((state.y + (parseInt(target.y) / 300))  * 1000) / 1000;
                }
                

                if (getRandom() > 9 && state.s === 'MOVING') {
                    state.s = 'SOWING';
                } else if (getRandom() > 7 && state.s === 'SOWING') {
                    target.x = -target.x;
                    target.y = -target.y;
                    setDeviceState('targetTractor' + deviceId.replace(/[a-zA-Z]/g, ''), toUltraLight(target), false);
                    state.y = Math.round((state.y + (Math.abs (parseInt(target.x)/1000))) * 1000) / 1000;
                    state.x = Math.round((state.x + (Math.abs (parseInt(target.y)/1000))) * 1000) / 1000;
                    state.s = 'MOVING';
                }
                
                state.gps = state.y + "," + state.x;
                delete state.y;
                delete state.x;
                break;

            case 'temperature':
                target = getDeviceState('targetTemp' + deviceId.replace(/[a-zA-Z]/g, ''));
                if (getRandom() > 7) {
                    targetTemp = parseInt(target.t);
                    if (state.t < targetTemp) {
                        state.t++;
                    } else if (state.t > targetTemp) {
                        state.t--;
                    }
                }
                break;
        }

        setDeviceState(deviceId, toUltraLight(state), isSensor);
    });
    isDevicesActive = false;
}

//
// Transformation function from Ultralight Protocol to an object
// Ultralight is a series of pipe separated key-value pairs.
// Each key and value is in turn separated by a pipe character
//
// e.g. s|ON|gps|1000 becomes
// { s: 'ON', l: '1000'}
//
function getDeviceState(deviceId) {
    const ultraLight = myCache.get(deviceId);
    const obj = {};
    const keyValuePairs = ultraLight.split('|');
    for (let i = 0; i < keyValuePairs.length; i = i + 2) {
        obj[keyValuePairs[i]] = keyValuePairs[i + 1];
    }
    return obj;
}
//
// Sets the device state in the in-memory cache. If the device is a sensor
// it also reports (and attempts to send) the northbound traffic to the IoT agent.
// The state of the dummy device is also sent to the browser for display
//
function setDeviceState(deviceId, state, isSensor = true, force = false) {
    const previousState = myCache.get(deviceId);
    myCache.set(deviceId, state);

    if (!devicesInitialized) {
        initDevices();
        devicesInitialized = true;
    }

    // If we are running under HTTP mode the device will respond with a result
    // If we are running under MQTT mode the device will post the result as a topic
    if (isSensor && (state !== previousState || force)) {
        Northbound.sendMeasure(deviceId, state);
    }

    SOCKET_IO.emit(deviceId, state);
}

// Transformation function from a state object to the Ultralight Protocol
// Ultralight is a series of pipe separated key-value pairs.
// Each key and value is in turn separated by a pipe character
//
// e.g. s|ON,l|1000
function toUltraLight(object) {
    const strArray = [];
    _.forEach(object, function (value, key) {
        strArray.push(key + '|' + value);
    });
    return strArray.join('|');
}

// Return the state of the tractor with the same number as the current element
// this is because work will be done if the tractor is IDLE, and therefore
// other devices will not update
function getTractorState(deviceId, type) {
    const tractor = getDeviceState(deviceId.replace(type, 'tractor'));
    return tractor.s || 'IDLE';
}

// Return the state of the water sprinkler with the same number as the current element
// this is because the humidity sensor is linked to the water sprinker (along with
// the weather)
function getWaterState(deviceId, type) {
    const water = getDeviceState(deviceId.replace(type, 'water'));
    return water.s || 'OFF';
}

function fillingStationEmpty(deviceId) {
    const state = getDeviceState(deviceId);
    state.f = state.f - (getRandom() * getRandom()) / 1000;
    state.f = Math.round(state.f * 100) / 100;

    if (state.f < 0) {
        setDeviceState(deviceId, FILLING_STATION_EMPTY, true);
    } else {
        setDeviceState(deviceId, toUltraLight(state), true);
    }
}

function fillingStationFill(deviceId) {
    const state = getDeviceState(deviceId);
    state.f = state.f - (getRandom() * getRandom()) / 1000;
    state.f = Math.round(state.f * 100) / 100;
    if (state.f > 1) {
        setDeviceState(deviceId, FILLING_STATION_FULL, true);
    } else {
        setDeviceState(deviceId, toUltraLight(state), true);
    }
}

// Pick a random number between 1 and 10
function getRandom() {
    return Math.floor(Math.random() * 10) + 1;
}

// Directly alter the state of a water sprinkler
function fireWaterSprinkler(id) {
    debug('fireWaterSprinkler');
    setDeviceState(id, WATER_ON, true);
}

// Indirectly alter the state of the temperature gauge
// by raising or lowering the target temperature.
function alterTemperature(id, raise) {
    debug('alterTemperature');
    const target = getDeviceState(id);
    target.t = raise ? parseInt(target.t) + 5 : parseInt(target.t) - 5;
    setDeviceState(id, toUltraLight(target), false);
}

// Check to see if a deviceId has a corresponding entry in the cache
function notFound(deviceId) {
    const deviceUnknown = _.indexOf(myCache.keys(), deviceId) === -1;
    if (deviceUnknown) {
        debug('Unknown IoT device: ' + deviceId);
    }
    return deviceUnknown;
}

// Check to see if a command can be processed by a class of devices
function isUnknownCommand(device, command) {
    const invalid = _.indexOf(VALID_COMMANDS[device], command) === -1;
    if (invalid) {
        debug('Invalid command for a ' + device + ': ' + command);
    }
    return invalid;
}

module.exports = {
    actuateDevice,
    fireWaterSprinkler,
    alterTemperature,
    alterFilling: fillingStationEmpty,
    notFound,
    isUnknownCommand
};
