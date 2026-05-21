import * as myCache from '../lib/cache';
import _ from 'lodash';
import debug from 'debug';
import * as Northbound from '../controllers/iot/northbound';
import * as Emitter from '../lib/emitter';
import * as Writer from '../lib/writer';

const log = debug('devices:animals');

const PIG_IDLE = 'o|0|hide|o,x|d|AT_REST';
const COW_IDLE = 'o|0|hide|o,x|d|AT_REST';

const numberOfPigs = process.env.PIG_COUNT || 5;
const numberOfCows = process.env.COW_COUNT || 5;
const numberOfFields = process.env.FIELD_COUNT || 8;

const COW_HEART_RATE = 50;
const COW_BODY_TEMPERATURE = 38.6;
const COW_AVERAGE_STEPS = 10;
const COW_ACCEL_X = 0.133;
const COW_ACCEL_Y = 0.4;
const ABNORMAL_COW_HEART_RATE = 68;
const PIG_HEART_RATE = 60;

const ANIMAL_STATUS = Object.freeze({
    ILL: 'ill',
    IN_CALF: 'calf',
    LAME: 'lame',
    HUNGRY: 'hungry',
    THIRSTY: 'thirsty',
    HEAT: 'heat',
    LONELY: 'lonely',
});

interface StatusEntry {
    code: number;
    heartRates: number[];
    temperatures: number[];
    steps: number[];
    x: number[];
    y: number[];
}

interface AnimalState {
    o?: string | number;
    hide?: string;
    d?: string;
    s?: string | number;
    st?: string;
    gps?: string;
    ta?: string;
    bpm?: string | number;
    accel_x?: string;
    accel_y?: string;
    body_temp?: string | number;
    step_count?: string | number;
    by?: string;
    [key: string]: unknown;
}

interface AnimalEntry {
    id: string;
    state: AnimalState;
}

interface AnimalData {
    cow: AnimalEntry[];
    pig: AnimalEntry[];
    trough: AnimalEntry[];
    targets: Record<string, string | null>;
}

function generateRange(mean: number, sd: number): number[] {
    const ARRAY_SIZE = 100;
    const list = [...new Array<number>(ARRAY_SIZE)].map(() => Math.random() * 9 + 1);
    const sum = list.reduce((a, b) => a + b, 0);
    const currentMean = sum / list.length;
    const sumMinusMean = list.reduce((a, b) => a + (b - currentMean) * (b - currentMean), 0);
    const currentSd = Math.sqrt(sumMinusMean / (list.length - 1));
    return list.map((n) => (sd * (n - currentMean)) / currentSd + mean);
}

const STATUS: Record<string, StatusEntry> = {
    AT_REST: {
        code: 0,
        heartRates: generateRange(COW_HEART_RATE, 2).map((n) => parseFloat(n.toFixed(2))),
        temperatures: generateRange(COW_BODY_TEMPERATURE, 1).map((n) => parseFloat(n.toFixed(2))),
        steps: generateRange(COW_AVERAGE_STEPS, 4).map((n) => Math.floor(n * 1000)),
        x: generateRange(COW_ACCEL_X, 1).map((n) => parseFloat(n.toFixed(4))),
        y: generateRange(COW_ACCEL_Y, 1).map((n) => parseFloat(n.toFixed(4))),
    },
    FORAGING: { code: 3, heartRates: [], temperatures: [], steps: [], x: [], y: [] },
    DRINKING: {
        code: 5,
        heartRates: generateRange(COW_HEART_RATE + 0.5, 0.4).map((n) => parseFloat(n.toFixed(2))),
        temperatures: generateRange(COW_BODY_TEMPERATURE + 0.2, 0.2).map((n) => parseFloat(n.toFixed(2))),
        steps: generateRange(COW_AVERAGE_STEPS - 2, 1).map((n) => Math.floor(n * 1000)),
        x: generateRange(COW_ACCEL_X, 0.8),
        y: generateRange(COW_ACCEL_Y, 1.2),
    },
    WALLOWING: { code: 5, heartRates: [], temperatures: [], steps: [], x: [], y: [] },
    GRAZING: {
        code: 6,
        heartRates: generateRange(COW_HEART_RATE - 1, 3).map((n) => parseFloat(n.toFixed(2))),
        temperatures: generateRange(COW_BODY_TEMPERATURE - 0.1, 1).map((n) => parseFloat(n.toFixed(2))),
        steps: generateRange(COW_AVERAGE_STEPS, 3).map((n) => Math.floor(n * 1000)),
        x: generateRange(COW_ACCEL_X, 0.1),
        y: generateRange(COW_ACCEL_Y, 2),
    },
    MOVING: {
        code: 7,
        heartRates: generateRange(COW_HEART_RATE + 10, 2).map((n) => parseFloat(n.toFixed(2))),
        temperatures: generateRange(COW_BODY_TEMPERATURE + 0.2, 2).map((n) => parseFloat(n.toFixed(2))),
        steps: generateRange(COW_AVERAGE_STEPS + 2, 4).map((n) => Math.floor(n * 1000)),
        x: generateRange(COW_ACCEL_X, 2),
        y: generateRange(COW_ACCEL_Y, 2),
    },
    MOUNTING: {
        code: 9,
        heartRates: generateRange(COW_HEART_RATE + 3, 0.5).map((n) => parseFloat(n.toFixed(2))),
        temperatures: generateRange(COW_BODY_TEMPERATURE, 1).map((n) => parseFloat(n.toFixed(2))),
        steps: generateRange(COW_AVERAGE_STEPS, 4).map((n) => Math.floor(n * 1000)),
        x: generateRange(COW_ACCEL_X, 1.1),
        y: generateRange(COW_ACCEL_Y, 0.6),
    },
};

const PIG_ACTIVITY = ['AT_REST', 'FORAGING', 'FORAGING', 'FORAGING', 'DRINKING', 'WALLOWING'];
const COW_ACTIVITY = ['AT_REST', 'AT_REST', 'GRAZING', 'GRAZING', 'GRAZING', 'DRINKING'];
const OFFSET_RATE: Record<string, number> = {
    AT_REST: 0,
    GRAZING: 0,
    FORAGING: 2,
    DRINKING: 1,
    WALLOWING: 5,
};

myCache.init().then(() => {
    for (let i = 1; i <= Number(numberOfPigs); i++) {
        const lng = addAndTrim(13.356 + 0.0004 * getRandom(-10), true);
        const lat = addAndTrim(52.515 + 0.0003 * getRandom(-10), true);
        myCache.set('pig' + i.toString().padStart(3, '0'), `${PIG_IDLE}|bpm|60|gps|${lng},${lat}`);
    }
    for (let i = 1; i <= Number(numberOfCows); i++) {
        const lng = addAndTrim(13.41 + 0.0003 * getRandom(-10), true);
        const lat = addAndTrim(52.471 + 0.0004 * getRandom(-10), true);
        myCache.set('cow' + i.toString().padStart(3, '0'), `${COW_IDLE}|bpm|50|gps|${lng},${lat}`);
    }
    for (let i = 1; i <= Number(numberOfFields); i++) {
        myCache.set('field' + i.toString().padStart(3, '0'), '');
    }

    myCache.set('trough021', '');
    myCache.set('trough031', '');
    myCache.set('trough032', '');
    myCache.set('trough041', '');
    myCache.set('trough042', '');
    myCache.set('trough051', '');
    myCache.set('trough052', '');
    myCache.set('trough053', '');
    myCache.set('trough061', '');
    myCache.set('trough062', '');
    myCache.set('trough063', '');
    myCache.set('trough071', '');
});

function getRandom(add = 1): number {
    return Math.floor(Math.random() * 10) + add;
}

function addAndTrim(value: number, add: boolean, weather?: string | null): number {
    const delta = weather === 'sunny' ? 0.0007 : 0.0003;
    const newValue = add ? value + delta : value - delta;
    return Math.round(newValue * 10000) / 10000;
}

function toUltraLight(object: Record<string, unknown>): string {
    const strArray: string[] = [];
    _.forEach(object, (value, key) => {
        strArray.push(`${key}|${value}`);
    });
    return strArray.join('|');
}

function getDeviceState(deviceId: string): Promise<AnimalState>;
function getDeviceState(deviceId: string, force: true): Promise<string | null>;
function getDeviceState(deviceId: string, force = false): Promise<AnimalState | string | null> {
    return myCache.get(deviceId).then((data) => {
        if (force) {
            return data;
        }
        const obj: AnimalState = {};
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

function getStatusCode(status: string): number {
    return STATUS[status].code;
}

function getRandomFromArray<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function setRawReadings(state: AnimalState, desc: string): void {
    if (!STATUS[desc].heartRates.length) {
        return;
    }
    state.accel_x = getRandomFromArray(STATUS[desc].x).toFixed(4);
    state.accel_y = getRandomFromArray(STATUS[desc].y).toFixed(4);
    state.bpm = getRandomFromArray(STATUS[desc].heartRates);
    state.body_temp = getRandomFromArray(STATUS[desc].temperatures);
    state.step_count = getRandomFromArray(STATUS[desc].steps);
}

async function randomWalk(state: AnimalState, deviceId: string, lng: number, lat: number): Promise<void> {
    let moveFactor = 6;
    const weather = await myCache.get('weather');

    if (weather === 'raining' || (state.st && state.st.includes(ANIMAL_STATUS.ILL))) {
        moveFactor = 8;
    } else if (state.st && state.st.includes(ANIMAL_STATUS.IN_CALF)) {
        moveFactor = 7;
    }

    const location = (state.gps as string).split(',');
    let y = parseFloat(location[0]);
    let x = parseFloat(location[1]);
    const yOffset = y - lng;
    const xOffset = x - lat;

    if (getRandom() > moveFactor || xOffset < -0.015) x = addAndTrim(x, true, weather);
    if (getRandom() > moveFactor || xOffset > 0.015) x = addAndTrim(x, false, weather);
    if (getRandom() > moveFactor || yOffset < -0.015) y = addAndTrim(y, true, weather);
    if (getRandom() > moveFactor || yOffset > 0.015) y = addAndTrim(y, false, weather);

    state.gps = `${y},${x}`;
}

async function directedWalk(
    state: AnimalState,
    deviceId: string,
    goal: string
): Promise<{ gps: string; complete: boolean; onHeat?: boolean }> {
    const location = (state.gps as string).split(',');
    let y = parseFloat(location[0]);
    let x = parseFloat(location[1]);

    const weather = await myCache.get('weather');
    const target = await getDeviceState(state.ta as string);

    if (target.gps === undefined) {
        log(`${deviceId} ${goal} - ${state.ta} is ${String(target.gps)}`);
        return { gps: `${y},${x}`, complete: false };
    }

    const targetLocation = (target.gps as string).split(',');
    const ty = parseFloat(targetLocation[0]);
    const tx = parseFloat(targetLocation[1]);

    const offset1 = (
        Math.abs(parseFloat(location[1]) - tx) + Math.abs(parseFloat(location[0]) - ty)
    ).toFixed(4);

    if (tx > x) x = addAndTrim(x, true, weather);
    if (tx < x) x = addAndTrim(x, false, weather);
    if (ty > y) y = addAndTrim(y, true, weather);
    if (ty < y) y = addAndTrim(y, false, weather);

    const offset2 = (Math.abs(x - tx) + Math.abs(y - ty)).toFixed(4);
    const onHeat = target.st ? (target.st as string).includes(ANIMAL_STATUS.HEAT) : false;
    return { gps: `${y},${x}`, complete: offset2 >= offset1, onHeat };
}

function selectTarget(id: string, type: string, animals: AnimalData): string | undefined {
    let targetList: string[] = [];

    _.forEach(animals.targets, (value) => {
        if (!value) return;
        const targets = value.split(',');
        if (targets.includes(id)) {
            targetList = targets.filter((e) => e !== id).filter((e) => e.startsWith(type));
        }
    });

    return targetList[Math.floor(Math.random() * targetList.length)];
}

function findNeighbour(id: string, state: AnimalState, animals: AnimalEntry[]): string | undefined {
    const location = (state.gps as string).split(',');
    const y = parseFloat(location[0]);
    const x = parseFloat(location[1]);

    let nearest: string | undefined;
    let distance = Infinity;

    _.forEach(animals, (animal) => {
        if (animal.id !== id) {
            const animalLocation = (animal.state.gps as string).split(',');
            const ty = parseFloat(animalLocation[0]);
            const tx = parseFloat(animalLocation[1]);
            const animalDistance = parseFloat((Math.abs(x - tx) + Math.abs(y - ty)).toFixed(4));
            if (distance > animalDistance) {
                nearest = animal.id;
                distance = animalDistance;
            }
        }
    });

    return nearest;
}

async function getAllAnimalData(): Promise<AnimalData> {
    const deviceIds = myCache.keys();
    const animals: AnimalData = { cow: [], pig: [], trough: [], targets: {} };

    const promises = deviceIds.map((id) => {
        switch (id.replace(/\d/g, '')) {
            case 'pig':
                return getDeviceState(id).then((state) => {
                    animals.pig.push({ id, state });
                });
            case 'cow':
                return getDeviceState(id).then((state) => {
                    animals.cow.push({ id, state });
                });
            case 'trough':
                return getDeviceState(id).then((state) => {
                    animals.trough.push({ id, state });
                });
            case 'field':
                return getDeviceState(id, true).then((targets) => {
                    animals.targets[id] = targets;
                });
            default:
                return Promise.resolve();
        }
    });

    await Promise.all(promises);
    return animals;
}

function sendAnimalCollarReadings(animals: AnimalData): void {
    let count = 0;

    _.forEach(animals.cow, async (cow) => {
        const state = cow.state;
        count += getRandom();
        let animalStatus = state.st ? (state.st as string).split(',') : [];

        const isLonely = animalStatus.includes(ANIMAL_STATUS.LONELY);
        const isThirsty = animalStatus.includes(ANIMAL_STATUS.THIRSTY);
        const isHungry = !(isLonely || isThirsty);

        let targetRate =
            COW_HEART_RATE + 2 * (OFFSET_RATE[state.d as string] ?? 0) + (getRandom() % 4);
        if (animalStatus.includes(ANIMAL_STATUS.ILL)) {
            targetRate = ABNORMAL_COW_HEART_RATE + 2 * (OFFSET_RATE[state.d as string] ?? 0) + (getRandom() % 4);
        }

        if (targetRate > Number(state.bpm)) {
            state.bpm = Number(state.bpm) + 1;
        } else if (targetRate < Number(state.bpm)) {
            state.bpm = Number(state.bpm) - 1;
        }

        if (state.d === 'MOUNTING') {
            state.d = 'AT_REST';
        }

        if (isHungry) {
            if (state.d === 'AT_REST') {
                if (getRandom() * getRandom() > 80) {
                    state.d = COW_ACTIVITY[getRandom() % 6];
                }
            } else {
                await randomWalk(state, cow.id, 13.34973, 52.51139);
                if (getRandom() > 8) {
                    state.d = getRandom() > 7 ? COW_ACTIVITY[getRandom() % 6] : 'GRAZING';
                }
            }

            if (state.o) {
                if ((Number(state.o) + count) % 27 === 0) {
                    if (getRandom() > 3) {
                        log(`${cow.id} lonely`);
                        animalStatus = animalStatus.filter((e) => e !== ANIMAL_STATUS.HUNGRY);
                        animalStatus.push(ANIMAL_STATUS.LONELY);
                        const hide = state.hide ? (state.hide as string).split(',') : [];
                        if (!hide.includes('ta')) {
                            hide.push('ta');
                            state.hide = hide.join(',');
                        }
                        state.ta = selectTarget(cow.id, 'cow', animals);
                        if (state.ta === undefined) {
                            animalStatus = animalStatus.filter((e) => e !== ANIMAL_STATUS.LONELY);
                            animalStatus.push(ANIMAL_STATUS.THIRSTY);
                            state.ta = selectTarget(cow.id, 'trough', animals);
                        }
                    } else if (getRandom() > 3) {
                        log(`${cow.id} thirsty`);
                        animalStatus = animalStatus.filter((e) => e !== ANIMAL_STATUS.HUNGRY);
                        animalStatus.push(ANIMAL_STATUS.THIRSTY);
                        const hide = state.hide ? (state.hide as string).split(',') : [];
                        if (!hide.includes('ta')) {
                            hide.push('ta');
                            state.hide = hide.join(',');
                        }
                        state.ta = selectTarget(cow.id, 'trough', animals);
                    }
                    state.st = animalStatus.join(',');
                }
            }

            state.s = getStatusCode(state.d as string);
            if (state.o) {
                setRawReadings(state, state.d as string);
                state.o = Number(state.o) + 1;
            }
            state.by = findNeighbour(cow.id, state, animals.cow);
            setDeviceState(cow.id, toUltraLight(cow.state), true);
        } else if (isLonely) {
            directedWalk(state, cow.id, 'lonely').then((result) => {
                state.gps = result.gps;
                state.d = 'GRAZING';
                state.s = getStatusCode(state.d);
                if (result.complete) {
                    log(`${cow.id} not lonely`);
                    animalStatus = animalStatus.filter((e) => e !== ANIMAL_STATUS.LONELY);
                    animalStatus.push(ANIMAL_STATUS.HUNGRY);
                    state.st = animalStatus.join(',');
                    state.d = 'AT_REST';
                    if (result.onHeat || getRandom() > 3) {
                        state.d = 'MOUNTING';
                    }
                    state.s = getStatusCode(state.d);
                }
                if (state.o) {
                    setRawReadings(state, state.d as string);
                    state.o = Number(state.o) + 1;
                }
                state.by = findNeighbour(cow.id, state, animals.cow);
                setDeviceState(cow.id, toUltraLight(cow.state), true);
            });
        } else if (isThirsty) {
            directedWalk(state, cow.id, 'thirsty').then((result) => {
                state.gps = result.gps;
                state.d = 'GRAZING';
                state.s = getStatusCode(state.d);
                if (result.complete) {
                    log(`${cow.id} not thirsty`);
                    animalStatus = animalStatus.filter((e) => e !== ANIMAL_STATUS.THIRSTY);
                    animalStatus.push(ANIMAL_STATUS.HUNGRY);
                    state.st = animalStatus.join(',');
                    state.d = 'DRINKING';
                    state.s = getStatusCode(state.d);
                }
                if (state.o) {
                    setRawReadings(state, state.d as string);
                    state.o = Number(state.o) + 1;
                }
                setDeviceState(cow.id, toUltraLight(cow.state), true);
            });
        }
    });

    _.forEach(animals.pig, async (pig) => {
        const targetRate = PIG_HEART_RATE + 2 * (OFFSET_RATE[pig.state.d as string] ?? 0) + (getRandom() % 4);

        if (targetRate > Number(pig.state.bpm)) {
            pig.state.bpm = Number(pig.state.bpm) + 1;
        } else if (targetRate < Number(pig.state.bpm)) {
            pig.state.bpm = Number(pig.state.bpm) - 1;
        }

        if (pig.state.d === 'AT_REST') {
            if (getRandom() * getRandom() > 63) {
                pig.state.d = PIG_ACTIVITY[getRandom() % 6];
            }
        } else {
            await randomWalk(pig.state, pig.id, 13.35073, 52.51839);
            if (getRandom() > 7) {
                pig.state.d = getRandom() > 3 ? PIG_ACTIVITY[getRandom() % 6] : 'AT_REST';
            }
        }

        pig.state.s = getStatusCode(pig.state.d as string);
        if (pig.state.o) {
            pig.state.o = Number(pig.state.o) + 1;
        }
        setDeviceState(pig.id, toUltraLight(pig.state), true);
    });
}

export function fireAnimalCollars(): void {
    myCache.get('barn').then((state) => {
        if (state === 'door-open') {
            getAllAnimalData().then((animals) => {
                sendAnimalCollarReadings(animals);
            });
        }
    });
}
