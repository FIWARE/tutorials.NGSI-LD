const JSONMeasure = require('../models/measure/json');
const fs = require('fs');

const HISTORY_LOG = process.env.HISTORY_LOG;
const json = new JSONMeasure({});
const stream = HISTORY_LOG
  ? fs.createWriteStream(HISTORY_LOG, { flags: 'a' })
  : null;

exports.write = function (deviceId, state) {
  if (!stream) {
    return;
  }
  if (!deviceId.startsWith('cow')) {
    return;
  }

  const data = JSON.parse(json.format(state, false));
  let line = `${data.o},${deviceId},${data.bpm},${data.gps},${data.d},`;
  line = line + `${data.accel_x},${data.accel_y},${data.bmp},${data.body_temp},${data.step_count},${data.by}`;
  stream.write(line + '\n');
};
