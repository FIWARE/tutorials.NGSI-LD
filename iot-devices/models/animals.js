const myCache = require('../lib/cache');
const _ = require('lodash');

const Northbound = require('../controllers/iot/northbound');
const Emitter = require('../lib/emitter');
const Writer = require('../lib/writer');

const debug = require('debug')('devices:animals');

const PIG_IDLE = 'o|0|hide|o,x|d|AT_REST';
const COW_IDLE = 'o|0|hide|o,x|d|AT_REST';

const numberOfPigs = process.env.PIG_COUNT || 5;
const numberOfCows = process.env.COW_COUNT || 5;
const numberOfFields = process.env.FIELD_COUNT || 8;

const ANIMAL_STATUS = Object.freeze({
  ILL: 'ill',
  IN_CALF: 'calf',
  LAME: 'lame',
  HUNGRY: 'hungry',
  THIRSTY: 'thirsty',
  HEAT: 'heat',
  LONELY: 'lonely',
});

const PIG_ACTIVITY = [
  'AT_REST',
  'FORAGING',
  'FORAGING',
  'FORAGING',
  'DRINKING',
  'WALLOWING',
];
const COW_ACTIVITY = [
  'AT_REST',
  'AT_REST',
  'GRAZING',
  'GRAZING',
  'GRAZING',
  'DRINKING',
];
const OFFSET_RATE = {
  AT_REST: 0,
  GRAZING: 0,
  FORAGING: 2,
  DRINKING: 1,
  WALLOWING: 5,
};

const COW_HEART_RATE = 50;
const ABNORMAL_COW_HEART_RATE = 68;
const PIG_HEART_RATE = 60;

myCache.init().then(() => {
  for (let i = 1; i <= numberOfPigs; i++) {
    const lng = addAndTrim(13.356 + 0.0004 * getRandom(-10), true);
    const lat = addAndTrim(52.515 + 0.0003 * getRandom(-10), true);
    myCache.set(
      'pig' + i.toString().padStart(3, '0'),
      PIG_IDLE + '|bpm|60|gps|' + lng + ',' + lat
    );
  }
  for (let i = 1; i <= numberOfCows; i++) {
    const lng = addAndTrim(13.41 + 0.0003 * getRandom(-10), true);
    const lat = addAndTrim(52.471 + 0.0004 * getRandom(-10), true);
    myCache.set(
      'cow' + i.toString().padStart(3, '0'),
      COW_IDLE + '|bpm|50|gps|' + lng + ',' + lat
    );
  }

  for (let i = 1; i <= numberOfFields; i++) {
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

// Pick a random number between 1 and 10
function getRandom(add = 1) {
  return Math.floor(Math.random() * 10) + add;
}

function addAndTrim(value, add, weather) {
  let newValue;
  if (weather === 'sunny') {
    newValue = add ? parseFloat(value) + 0.0007 : parseFloat(value) - 0.0007;
  } else {
    newValue = add ? parseFloat(value) + 0.0003 : parseFloat(value) - 0.0003;
  }

  return Math.round(newValue * 10000) / 10000;
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

//
// Transformation function from Ultralight Protocol to an object
// Ultralight is a series of pipe separated key-value pairs.
// Each key and value is in turn separated by a pipe character
//
// e.g. s|ON|gps|1000 becomes
// { s: 'ON', l: '1000'}
//
function getDeviceState(deviceId, force = false) {
  return myCache.get(deviceId).then((data) => {
    if (force) {
      return data;
    }
    const obj = {};
    if (data) {
      const keyValuePairs = data.split('|');
      for (let i = 0; i < keyValuePairs.length; i = i + 2) {
        obj[keyValuePairs[i]] = keyValuePairs[i + 1];
      }
    }
    return obj;
  });
}
//
// Sets the device state in the in-memory cache. If the device is a sensor
// it also reports (and attempts to send) the northbound traffic to the IoT agent.
// The state of the dummy device is also sent to the browser for display
//
function setDeviceState(deviceId, state, isSensor = true, force = false) {
  const previousState = myCache.get(deviceId);
  myCache.set(deviceId, state);
  const payload = Northbound.format(state);
  // If we are running under HTTP mode the device will respond with a result
  // If we are running under MQTT mode the device will post the result as a topic
  if (isSensor && (state !== previousState || force)) {
    Northbound.sendMeasure(deviceId, payload);
  }
  Writer.write(deviceId, state);
  Emitter.emit(deviceId, payload);
}

function getStatusCode(status) {
  let code = 0;
  switch (status) {
    case 'AT_REST':
    case 'IDLE':
    case 'OFF':
      code = 0;
      break;
    case 'ON':
      code = 1;
      break;
    case 'FORAGING':
      code = 3;
      break;
    case 'DRINKING':
      code = 5;
      break;
    case 'WALLOWING':
      code = 5;
      break;
    case 'GRAZING':
      code = 6;
      break;
    case 'MOVING':
      code = 7;
      break;
    case 'SOWING':
      code = 8;
      break;
    case 'MOUNTING':
      code = 9;
      break;
  }
  return code;
}

async function directedWalk(state, deviceId, goal) {
  const location = state.gps.split(',');
  let y = parseFloat(location[0]);
  let x = parseFloat(location[1]);

  const weather = await myCache.get('weather');
  const target = await getDeviceState(state.ta);

  if (target.gps === undefined) {
    debug(`${deviceId} ${goal} - ${state.ta} is ${target.gps}`);
    return { gps: y + ',' + x, complete: false };
  }

  const targetLocation = target.gps.split(',');
  const ty = parseFloat(targetLocation[0]);
  const tx = parseFloat(targetLocation[1]);

  const offset1 = Math.abs(
    0 + parseFloat(location[1]) - tx + parseFloat(location[0]) - ty
  ).toFixed(4);

  if (tx > x) {
    x = addAndTrim(x, true, weather);
  }
  if (tx < x) {
    x = addAndTrim(x, false, weather);
  }
  if (ty > y) {
    y = addAndTrim(y, true, weather);
  }
  if (ty < y) {
    y = addAndTrim(y, false, weather);
  }

  const offset2 = Math.abs(0 + x - tx + y - ty).toFixed(4);
  return { gps: y + ',' + x, complete: offset2 >= offset1 };
}

function randomWalk(state, deviceId, lng, lat) {
  let moveFactor = 6;
  const weather = myCache.get('weather');

  if (
    weather === 'raining' ||
    (state.st && state.st.includes(ANIMAL_STATUS.ILL))
  ) {
    moveFactor = 8;
  } else if (state.st && state.st.includes(ANIMAL_STATUS.IN_CALF)) {
    moveFactor = 7;
  }

  const location = state.gps.split(',');
  let y = location[0];
  let x = location[1];
  const yOffset = y - lng;
  const xOffset = x - lat;
  if (getRandom() > moveFactor || xOffset < -0.015) {
    x = addAndTrim(x, true, weather);
  }
  if (getRandom() > moveFactor || xOffset > 0.015) {
    x = addAndTrim(x, false, weather);
  }
  if (getRandom() > moveFactor || yOffset < -0.015) {
    y = addAndTrim(y, true, weather);
  }
  if (getRandom() > moveFactor || yOffset > 0.015) {
    y = addAndTrim(y, false, weather);
  }
  state.gps = y + ',' + x;
}

function selectTarget(id, type, animals) {
  let targetList;

  _.forEach(animals.targets, function (value) {
    const targets = value.split(',');
    if (targets.includes(id)) {
      targetList = targets
        .filter((e) => e !== id)
        .filter((e) => e.startsWith(type));
    }
  });
  const target = targetList[Math.floor(Math.random() * targetList.length)];
  return target;
}

async function getAllAnimalData() {
  const deviceIds = myCache.keys();
  const animals = {
    cow: [],
    pig: [],
    trough: [],
    targets: {},
  };

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

function sendAnimalCollarReadings(animals) {
  let count = 0;
  _.forEach(animals.cow, (cow) => {
    const state = cow.state;
    count = count + getRandom();
    let animalStatus = state.st ? state.st.split(',') : [];
    const isLonely = animalStatus.includes(ANIMAL_STATUS.LONELY);
    const isThirsty = animalStatus.includes(ANIMAL_STATUS.THIRSTY);
    const isHungry = !(isLonely || isThirsty);
    let targetRate =
      COW_HEART_RATE + 2 * OFFSET_RATE[cow.state.d] + (getRandom() % 4);
    if (animalStatus.includes(ANIMAL_STATUS.ILL)) {
      targetRate =
        ABNORMAL_COW_HEART_RATE + 2 * OFFSET_RATE[state.d] + (getRandom() % 4);
    }
    if (targetRate > state.bpm) {
      state.bpm++;
    } else if (targetRate < state.bpm) {
      state.bpm--;
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
        randomWalk(state, cow.id, 13.34973, 52.51139);
        if (getRandom() > 8) {
          state.d = getRandom() > 7 ? COW_ACTIVITY[getRandom() % 6] : 'GRAZING';
        }
      }

      if (state.o) {
        if ((state.o + count) % 27 === 0) {
          if (getRandom() > 3) {
            debug(`${cow.id} lonely`);
            animalStatus = animalStatus.filter(
              (e) => e !== ANIMAL_STATUS.HUNGRY
            );
            animalStatus.push(ANIMAL_STATUS.LONELY);
            const hide = state.hide.split(',') || [];
            if (!hide.includes('ta')) {
              hide.push('ta');
              state.hide = hide.join(',');
            }
            state.ta = selectTarget(cow.id, 'cow', animals);

            if (state.ta === undefined) {
              animalStatus = animalStatus.filter(
                (e) => e !== ANIMAL_STATUS.LONELY
              );
              animalStatus.push(ANIMAL_STATUS.THIRSTY);
              state.ta = selectTarget(cow.id, 'trough', animals);
            }

            // eslint-disable-next-line  no-dupe-else-if
          } else if (getRandom() > 3) {
            debug(`${cow.id} thirsty`);
            animalStatus = animalStatus.filter(
              (e) => e !== ANIMAL_STATUS.HUNGRY
            );
            animalStatus.push(ANIMAL_STATUS.THIRSTY);
            const hide = state.hide.split(',') || [];
            if (!hide.includes('ta')) {
              hide.push('ta');
              state.hide = hide.join(',');
            }
            state.ta = selectTarget(cow.id, 'trough', animals);
          }
          state.st = animalStatus.join(',');
        }
      }

      state.s = getStatusCode(state.d);
      if (state.o) {
        state.o++;
      }
      setDeviceState(cow.id, toUltraLight(cow.state), true);
    } else if (isLonely) {
      directedWalk(state, cow.id, 'lonely').then((result) => {
        state.gps = result.gps;
        state.d = 'GRAZING';
        state.s = getStatusCode(state.d);
        if (result.complete) {
          debug(`${cow.id} not lonely`);
          animalStatus = animalStatus.filter((e) => e !== ANIMAL_STATUS.LONELY);
          animalStatus.push(ANIMAL_STATUS.HUNGRY);
          state.st = animalStatus.join(',');
          state.d = 'MOUNTING';
          state.s = getStatusCode(state.d);
        }
        if (state.o) {
          state.o++;
        }

        setDeviceState(cow.id, toUltraLight(cow.state), true);
      });
    } else if (isThirsty) {
      directedWalk(state, cow.id, 'thirsty').then((result) => {
        state.gps = result.gps;
        state.d = 'GRAZING';
        state.s = getStatusCode(state.d);
        if (result.complete) {
          debug(`${cow.id} not thirsty`);
          animalStatus = animalStatus.filter(
            (e) => e !== ANIMAL_STATUS.THIRSTY
          );
          animalStatus.push(ANIMAL_STATUS.HUNGRY);
          state.st = animalStatus.join(',');
          state.d = 'DRINKING';
          state.s = getStatusCode(state.d);
        }

        if (state.o) {
          state.o++;
        }
        setDeviceState(cow.id, toUltraLight(cow.state), true);
      });
    }
  });

  _.forEach(animals.pig, (pig) => {
    const targetRate =
      PIG_HEART_RATE + 2 * OFFSET_RATE[pig.state.d] + (getRandom() % 4);

    if (targetRate > pig.state.bpm) {
      pig.state.bpm++;
    } else if (targetRate < pig.state.bpm) {
      pig.state.bpm--;
    }
    if (pig.state.d === 'AT_REST') {
      if (getRandom() * getRandom() > 63) {
        pig.state.d = PIG_ACTIVITY[getRandom() % 6];
      }
    } else {
      randomWalk(pig.state, pig.id, 13.35073, 52.51839);
      if (getRandom() > 7) {
        pig.state.d =
          getRandom() > 3 ? PIG_ACTIVITY[getRandom() % 6] : 'AT_REST';
      }
    }
    pig.state.s = getStatusCode(pig.state.d);
    if (pig.state.o) {
      pig.state.o++;
    }
    setDeviceState(pig.id, toUltraLight(pig.state), true);
  });
}

function fireAnimalCollars() {
  myCache.get('barn').then((state) => {
    if (state === 'door-open') {
      getAllAnimalData()
        .then((animals) => {
          return sendAnimalCollarReadings(animals);
        })
        .then(() => {
          return true;
        });
    }
    return false;
  });
}

module.exports = {
  fireAnimalCollars,
};
