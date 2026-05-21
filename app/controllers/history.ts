import moment from 'moment';
import _ from 'lodash';
import debug from 'debug';
import type { Request, Response } from 'express';

const log = debug('tutorial:history');

const crateUrl = process.env.CRATE_DB_SERVICE_URL || 'http://localhost:4200/_sql';

// TODO: readCrateMotionCount and readCrateLampLuminosity share the same fetch/Promise
// structure and differ only in table name, column name, and entity-id prefix.
// Merge into a single queryCrate(id, aggMethod, table, column, entityPrefix) helper
// once the surrounding SQL and schema are finalised.
function readCrateMotionCount(id: string, aggMethod: string): Promise<Record<string, unknown>> {
    log('readCrateMotionCount');
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
            .then((r) => r.json().then((data) => ({ status: r.status, body: data as Record<string, unknown> })))
            .then((data) => {
                return resolve(data.body);
            })
            .catch((e: Error) => {
                return reject(e);
            });
    });
}

function readCrateLampLuminosity(id: string, aggMethod: string): Promise<Record<string, unknown>> {
    log('readCrateLampLuminosity');
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
            .then((r) => r.json().then((data) => ({ status: r.status, body: data as Record<string, unknown> })))
            .then((data) => {
                return resolve(data.body);
            })
            .catch((e: Error) => {
                return reject(e);
            });
    });
}

interface TimeSeriesResult {
    labels: string[];
    data: { t: moment.Moment; y: unknown }[];
    color: string[];
}

function crateToTimeSeries(
    crateResponse: Record<string, unknown>,
    aggMethod: string,
    hexColor: string
): TimeSeriesResult {
    log('crateToTimeSeries');

    const data: { t: moment.Moment; y: unknown }[] = [];
    const labels: string[] = [];
    const color: string[] = [];

    const rows = crateResponse && (crateResponse.rows as unknown[][]);
    if (rows && rows.length > 0) {
        _.forEach(rows, (element) => {
            const date = moment(element[0] as string);
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

async function readCrateDeviceHistory(req: Request, res: Response): Promise<void> {
    log('readCrateDeviceHistory');
    const id = String(req.params.deviceId).split(':').pop() as string;

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

export { readCrateDeviceHistory };
