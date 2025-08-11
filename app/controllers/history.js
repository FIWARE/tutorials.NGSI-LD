const moment = require('moment');
const _ = require('lodash');
const debug = require('debug')('tutorial:history');

const crateUrl = process.env.CRATE_DB_SERVICE_URL || 'http://localhost:4200/_sql';

function readCrateMotionCount(id, aggMethod) {
    debug('readCrateMotionCount');
    return new Promise(function (resolve, reject) {
        const sqlStatement =
            "SELECT DATE_FORMAT (DATE_TRUNC ('minute', time_index)) AS minute, " +
            aggMethod +
            '(heartRate) AS ' +
            aggMethod +
            " FROM mtopeniot.etdevice WHERE entity_id = 'urn:ngsi-ld:Device:pig" +
            id +
            "' GROUP BY minute ORDER BY minute";
        return fetch(crateUrl, {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            body: JSON.stringify({ stmt: sqlStatement })
        })
            .then((r) => r.json().then((data) => ({ status: r.status, body: data })))
            .then((data) => {
                return resolve(data.body);
            })
            .catch((e) => {
                return reject(e);
            });
    });
}

function readCrateLampLuminosity(id, aggMethod) {
    debug('readCrateLampLuminosity');
    return new Promise(function (resolve, reject) {
        const sqlStatement =
            "SELECT DATE_FORMAT (DATE_TRUNC ('minute', time_index)) AS minute, " +
            aggMethod +
            '(filling) AS ' +
            aggMethod +
            " FROM mtopeniot.etfillinglevelsensor WHERE entity_id = 'urn:ngsi-ld:Device:filling" +
            id +
            "' GROUP BY minute ORDER BY minute";
        return fetch(crateUrl, {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            body: JSON.stringify({ stmt: sqlStatement })
        })
            .then((r) => r.json().then((data) => ({ status: r.status, body: data })))
            .then((data) => {
                return resolve(data.body);
            })
            .catch((e) => {
                return reject(e);
            });
    });
}

function crateToTimeSeries(crateResponse, aggMethod, hexColor) {
    debug('crateToTimeSeries');

    const data = [];
    const labels = [];
    const color = [];

    if (crateResponse && crateResponse.rows && crateResponse.rows.length > 0) {
        _.forEach(crateResponse.rows, (element) => {
            const date = moment(element[0]);
            data.push({ t: date, y: element[1] });
            labels.push(date.format('HH:mm'));
            color.push(hexColor);
        });
    }

    return {
        labels,
        data,
        color
    };
}

async function readCrateDeviceHistory(req, res) {
    debug('readCrateDeviceHistory');
    const id = req.params.deviceId.split(':').pop();

    const crateMotionData = await readCrateMotionCount(id, 'sum');
    const crateLampMinData = await readCrateLampLuminosity(id, 'min');
    const crateLampMaxData = await readCrateLampLuminosity(id, 'max');

    const sumMotionData = crateToTimeSeries(crateMotionData, 'sum', '#45d3dd');
    const minLampData = crateToTimeSeries(crateLampMinData, 'min', '#45d3dd');
    const maxLampData = crateToTimeSeries(crateLampMaxData, 'max', '#45d3dd');

    res.render('history', {
        title: 'IoT Device History',
        id,
        sumMotionData,
        minLampData,
        maxLampData
    });
}

module.exports = {
    readCrateDeviceHistory
};
