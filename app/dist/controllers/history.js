"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCrateDeviceHistory = readCrateDeviceHistory;
const moment_1 = __importDefault(require("moment"));
const lodash_1 = __importDefault(require("lodash"));
const debug_1 = __importDefault(require("debug"));
const log = (0, debug_1.default)('tutorial:history');
const crateUrl = process.env.CRATE_DB_SERVICE_URL || 'http://localhost:4200/_sql';
// TODO: readCrateMotionCount and readCrateLampLuminosity share the same fetch/Promise
// structure and differ only in table name, column name, and entity-id prefix.
// Merge into a single queryCrate(id, aggMethod, table, column, entityPrefix) helper
// once the surrounding SQL and schema are finalised.
function readCrateMotionCount(id, aggMethod) {
    log('readCrateMotionCount');
    return new Promise(function (resolve, reject) {
        const sqlStatement = "SELECT DATE_FORMAT (DATE_TRUNC ('minute', time_index)) AS minute, " +
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
    log('readCrateLampLuminosity');
    return new Promise(function (resolve, reject) {
        const sqlStatement = "SELECT DATE_FORMAT (DATE_TRUNC ('minute', time_index)) AS minute, " +
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
    log('crateToTimeSeries');
    const data = [];
    const labels = [];
    const color = [];
    const rows = crateResponse && crateResponse.rows;
    if (rows && rows.length > 0) {
        lodash_1.default.forEach(rows, (element) => {
            const date = (0, moment_1.default)(element[0]);
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
    log('readCrateDeviceHistory');
    const id = String(req.params.deviceId).split(':').pop();
    const [crateMotionData, crateLampMinData, crateLampMaxData] = await Promise.all([
        readCrateMotionCount(id, 'sum'),
        readCrateLampLuminosity(id, 'min'),
        readCrateLampLuminosity(id, 'max')
    ]);
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
