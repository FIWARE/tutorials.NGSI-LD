import * as myCache from '../lib/cache';
import _ from 'lodash';
import debug from 'debug';
import * as Northbound from '../controllers/iot/northbound';
import * as Emitter from '../lib/emitter';
import * as Writer from '../lib/writer';

const log = debug('devices:devices');

const WATER_OFF = 's|OFF';
const WATER_ON = 's|ON';
const HUMIDITY_WET = 'h|80';
const TRACTOR_IDLE = 'd|IDLE';
const DEFAULT_TEMPERATURE = 't|25';
const FILLING_STATION_FULL = 'f|1';
const FILLING_STATION_EMPTY = 'f|0';

const VALID_COMMANDS: Record<string, string[]> = {
    tractor: ['start', 'stop'],
    water: ['on', 'off'],
    filling: ['add', 'remove', 'refill'],
};

const numberOfSoilSensors = process.env.SOIL_SENSOR_COUNT || 5;

function getStatusCode(status: string): number {
    switch (status) {
        case 'AT_REST':
        case 'IDLE':
        case 'OFF':
            return 0;
        case 'ON':
            return 1;
        case 'FORAGING':
            return 3;
        case 'DRINKING':
        case 'WALLOWING':
            return 5;
        case 'GRAZING':
            return 6;
        case 'MOVING':
            return 7;
        case 'SOWING':
            return 8;
        default:
            return 0;
    }
}

export function actuateDevice(deviceId: string, command: string): void {
    log('actuateDevice: ' + deviceId + ' ' + command);
    switch (deviceId.replace(/\d/g, '')) {
        case 'water':
            if (command === 'on') {
                setDeviceState(deviceId, WATER_ON, false);
                Emitter.emit(deviceId, WATER_ON);
            } else if (command === 'off') {
                setDeviceState(deviceId, WATER_OFF, false);
                Emitter.emit(deviceId, WATER_OFF);
            }
            break;
        case 'tractor':
            getDeviceState(deviceId).then((state) => {
                if (command === 'start') {
                    state.d = 'MOVING';
                } else if (command === 'stop') {
                    state.d = 'IDLE';
                }
                state.s = String(getStatusCode(state.d));
                setDeviceState(deviceId, toUltraLight(state));
            });
            break;
        case 'filling':
            if (command === 'refill') {
                void alterFilling(deviceId, true);
                setTimeout(alterFilling, 400, deviceId, true);
                setTimeout(alterFilling, 800, deviceId, true);
                setTimeout(alterFilling, 1200, deviceId, true);
                setTimeout(alterFilling, 1600, deviceId, true);
                setTimeout(alterFilling, 2000, deviceId, true);
                setTimeout(alterFilling, 2400, deviceId, true);
                setTimeout(alterFilling, 2800, deviceId, true);
            } else if (command === 'add') {
                void alterFilling(deviceId, true);
                setTimeout(alterFilling, 1000, deviceId, true);
                setTimeout(alterFilling, 2000, deviceId, true);
            } else if (command === 'remove') {
                void alterFilling(deviceId, false);
                setTimeout(alterFilling, 1000, deviceId, false);
                setTimeout(alterFilling, 2000, deviceId, false);
            }
            break;
    }
}

export function initDevices(): void {
    log('initDevices');
    myCache.set('barn', 'door-open');
    Emitter.emit('barn', 'door-open');
}

export function stopDevices(): void {
    log('stopDevices');
    myCache.set('barn', 'door-locked');
    Emitter.emit('barn', 'door-locked');
}

myCache.init().then(() => {
    myCache.set('water001', WATER_OFF);
    myCache.set('water002', WATER_OFF);
    myCache.set('water003', WATER_OFF);
    myCache.set('water004', WATER_OFF);

    myCache.set('tractor001', TRACTOR_IDLE + '|gps|13.3505, 52.5144');
    myCache.set('tractor002', TRACTOR_IDLE + '|gps|13.3698, 52.5163');
    myCache.set('tractor003', TRACTOR_IDLE + '|gps|13.3598, 52.5165');
    myCache.set('tractor004', TRACTOR_IDLE + '|gps|13.3127, 52.4893');

    myCache.set('targetTractor001', 'x|0|y|1');
    myCache.set('targetTractor002', 'x|1|y|0');
    myCache.set('targetTractor003', 'x|-1|y|0');
    myCache.set('targetTractor004', 'x|0|y|-1');

    for (let i = 1; i < Number(numberOfSoilSensors); i++) {
        myCache.set('humidity' + i.toString().padStart(3, '0'), HUMIDITY_WET);
    }

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

    myCache.set('barn', 'door-locked');
    myCache.set('weather', 'cloudy');
});

export function emitOverallFarmStatus(): void {
    myCache.get('weather').then((state) => {
        Emitter.emit('weather', state);
    });
    myCache.get('barn').then((state) => {
        Emitter.emit('barn', state);
    });
}

export function updateTractorStatus(): void {
    myCache.get('barn').then((state) => {
        if (state === 'door-open') {
            sendTractorReadings();
        }
    });
}

function sendTractorReadings(): void {
    const deviceIds = myCache.keys();
    _.forEach(deviceIds, (deviceId) => {
        getDeviceState(deviceId).then(async (state) => {
            if (deviceId.replace(/\d/g, '') === 'tractor') {
                if (state.d !== 'IDLE') {
                    const tractorState = await getTractorState(deviceId, 'tractor');
                    const rate = tractorState === 'MOVING' ? 3 : 6;
                    state.d = getRandom() > rate ? 'MOVING' : 'SOWING';
                }
                state.s = String(getStatusCode(state.d));
                setDeviceState(deviceId, toUltraLight(state), true);
            }
        });
    });
}

export function fireDevices(deviceType: string): boolean {
    myCache.get('barn').then((state) => {
        if (state === 'door-open') {
            const deviceIds = myCache.keys();
            _.forEach(deviceIds, (deviceId) => {
                if (deviceId.replace(/\d/g, '') === deviceType) {
                    sendDeviceReading(deviceType, deviceId);
                }
            });
            return true;
        }
        return false;
    });
    return false;
}

async function sendDeviceReading(deviceType: string, deviceId: string): Promise<void> {
    const weather = await myCache.get('weather');

    getDeviceState(deviceId).then(async (state) => {
        let humid: number;
        let isDry: boolean;

        switch (deviceType) {
            case 'humidity':
                humid = parseInt(state.h);
                isDry = weather === 'sunny' ? getRandom() > 5 : getRandom() > 7;

                if (weather === 'raining' || (await getWaterState(deviceId, 'humidity')) === 'ON') {
                    state.h = String(humid + (getRandom() % 3));
                } else if (isDry && humid > 50) {
                    state.h = String(humid - (getRandom() % 3));
                } else if (isDry && humid > 30) {
                    state.h = String(humid - 3 + (getRandom() % 4));
                } else if (humid <= 30) {
                    state.h = String(humid + 3 - (getRandom() % 4));
                }

                if (Number(state.h) > 100) state.h = '100';
                if (Number(state.h) < 0) state.h = '0';
                setDeviceState(deviceId, toUltraLight(state), true);
                break;

            case 'tractor':
                getDeviceState('targetTractor' + deviceId.replace(/[a-zA-Z]/g, '')).then((target) => {
                    const location = state.gps.split(',');
                    let y = parseFloat(location[0]);
                    let x = parseFloat(location[1]);

                    if (state.d === 'SOWING') {
                        if (getRandom() > 9) {
                            y = Math.round((y + 0.001 * parseInt(target.x)) * 1000) / 1000;
                            x = Math.round((x + 0.001 * parseInt(target.y)) * 1000) / 1000;
                        }
                    }
                    if (state.d === 'MOVING') {
                        x = Math.round((x + parseInt(target.x) / 300) * 1000) / 1000;
                        y = Math.round((y + parseInt(target.y) / 300) * 1000) / 1000;
                    }
                    if (getRandom() > 9 && state.d === 'MOVING') {
                        state.d = 'SOWING';
                    } else if (getRandom() > 7 && state.d === 'SOWING') {
                        target.x = String(-parseInt(target.x));
                        target.y = String(-parseInt(target.y));
                        setDeviceState('targetTractor' + deviceId.replace(/[a-zA-Z]/g, ''), toUltraLight(target), false);
                        y = Math.round((y + Math.abs(parseInt(target.x) / 1000)) * 1000) / 1000;
                        x = Math.round((x + Math.abs(parseInt(target.y) / 1000)) * 1000) / 1000;
                        state.d = 'MOVING';
                    }
                    state.s = String(getStatusCode(state.d));
                    state.gps = `${y},${x}`;
                    setDeviceState(deviceId, toUltraLight(state), true);
                });
                break;

            case 'temperature':
                getDeviceState('targetTemp' + deviceId.replace(/[a-zA-Z]/g, '')).then((target) => {
                    if (getRandom() > 7) {
                        const targetTemp = parseInt(target.t);
                        if (Number(state.t) < targetTemp) {
                            state.t = String(Number(state.t) + 1);
                        } else if (Number(state.t) > targetTemp) {
                            state.t = String(Number(state.t) - 1);
                        }
                    }
                    setDeviceState(deviceId, toUltraLight(state), true);
                });
                break;
        }
    });
}

function getDeviceState(deviceId: string): Promise<Record<string, string>> {
    return myCache.get(deviceId).then((data) => {
        const obj: Record<string, string> = {};
        if (data) {
            const keyValuePairs = data.split('|');
            for (let i = 0; i < keyValuePairs.length; i += 2) {
                obj[keyValuePairs[i]] = keyValuePairs[i + 1];
            }
        }
        return obj;
    });
}

async function setDeviceState(deviceId: string, state: string, isSensor = true, force = false): Promise<void> {
    const previousState = await myCache.get(deviceId);
    myCache.set(deviceId, state);
    const payload = Northbound.format(state);
    if (isSensor && (state !== previousState || force)) {
        Northbound.sendMeasure(deviceId, payload);
    }
    Writer.write(deviceId, state);
    Emitter.emit(deviceId, payload);
}

function toUltraLight(object: Record<string, unknown>): string {
    const strArray: string[] = [];
    _.forEach(object, (value, key) => {
        strArray.push(`${key}|${value}`);
    });
    return strArray.join('|');
}

async function getTractorState(deviceId: string, type: string): Promise<string> {
    const tractor = await getDeviceState(deviceId.replace(type, 'tractor'));
    return tractor.d || 'IDLE';
}

async function getWaterState(deviceId: string, type: string): Promise<string> {
    const water = await getDeviceState(deviceId.replace(type, 'water'));
    return water.s || 'OFF';
}

async function alterFilling(deviceId: string, raise: boolean): Promise<void> {
    log('alterFilling');
    const state = await getDeviceState(deviceId);
    const fill = raise ? (getRandom() * getRandom()) / 1000 : -(getRandom() * getRandom()) / 1000;
    const newFill = Math.round((parseFloat(state.f) + fill) * 100) / 100;

    if (newFill > 1) {
        setDeviceState(deviceId, FILLING_STATION_FULL, true);
    } else if (newFill < 0) {
        setDeviceState(deviceId, FILLING_STATION_EMPTY, true);
    } else {
        state.f = String(newFill);
        setDeviceState(deviceId, toUltraLight(state), true);
    }
}

function getRandom(add = 1): number {
    return Math.floor(Math.random() * 10) + add;
}

export function fireWaterSprinkler(id: string): void {
    log('fireWaterSprinkler');
    setDeviceState(id, WATER_ON, true);
}

export async function alterTemperature(id: string, raise: boolean): Promise<void> {
    log('alterTemperature');
    const target = await getDeviceState(id);
    target.t = raise ? String(parseInt(target.t) + 5) : String(parseInt(target.t) - 5);
    setDeviceState(id, toUltraLight(target), false);
}

export function alterWeather(newWeather: string): void {
    log('The weather is: ' + newWeather);
    myCache.set('weather', newWeather);
    Emitter.emit('weather', newWeather);
}

export function notFound(deviceId: string): boolean {
    const deviceUnknown = !myCache.exists(deviceId);
    if (deviceUnknown) {
        log('Unknown IoT device: ' + deviceId);
    }
    return deviceUnknown;
}

export function isUnknownCommand(device: string, command: string): boolean {
    const invalid = _.indexOf(VALID_COMMANDS[device], command) === -1;
    if (invalid) {
        log('Invalid command for a ' + device + ': ' + command);
    }
    return invalid;
}

export function barnDoor(): void {
    myCache.get('barn').then((status) => {
        if (status === 'door-locked') {
            log('Opening Barn');
            initDevices();
        } else if (status === 'door-open') {
            log('Shutting Barn');
            stopDevices();
        }
    });
}
