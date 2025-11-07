const debug = require('debug')('devices:writer');
const JSONMeasure = require('../models/measure/json');
const fs = require('fs');

const HISTORY_LOG = process.env.HISTORY_LOG;
const json = new JSONMeasure({});
const stream = HISTORY_LOG
  ? fs.createWriteStream(HISTORY_LOG, { flags: 'a' })
  : null;

exports.write = function (deviceId, state, offset) {
  if (!stream) {
    console.log(HISTORY_LOG);
    return;
  }
  if (!deviceId.startsWith('cow')) {
    return;
  }
  const data = JSON.parse(json.format(state, false));
  const animal = `urn:ngsi-ld:Animal:${deviceId}`;
  const device = `urn:ngsi-ld:Device:${deviceId}`;
  const line = `${animal},Device,${data.bpm},Point,${data.gps},${device},${data.d},${data.o}`;

  stream.write(line + '\n');
};
