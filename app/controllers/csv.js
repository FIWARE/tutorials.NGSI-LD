const fs = require('fs');
const csv = require('fast-csv');
const BatchUpdate = require('../lib/batchUpdate');
const debug = require('debug')('tutorial:csv');
const _ = require('lodash');
const Status = require('http-status-codes');
const path = require('path');
const moment = require('moment-timezone');

/*
 * Delete the temporary file
 */
function removeCsvFile(path) {
    fs.unlink(path, (err) => {
        if (err) {
            throw err;
        }
    });
}

/*
 * Read the CSV data from the temporary file.
 * This returns an in memory representation of the raw CSV file
 */
function readCsvFile(path) {
    return new Promise((resolve, reject) => {
        const rows = [];

        fs.createReadStream(path)
            .pipe(csv.parse({ headers: true }))
            .on('error', (error) => {
                reject(error.message);
            })
            .on('data', (row) => {
                rows.push(row);
            })
            .on('end', () => {
                resolve(rows);
            });
    });
}

/*
 *  Strip the id and an key from the header row.
 */
function parseId(input) {
    const regexId = /^[^\s]+/;
    const regexKey = /[\w]+$/;
    const id = regexId.exec(input)[0];
    const key = regexKey.exec(input)[0];

    return { id, key };
}

function createEntitiesFromRows(rows) {
    const allEntities = [];
    const timestamp = new Date().toISOString();

    rows.forEach((row) => {
        const timestamp = moment.tz(row.annee, 'Etc/UTC').toISOString();
        const entity = {
            id: row.id,
            type: row.type
        };

        Object.keys(row).forEach((key, index) => {
            const value = row[key];
            if (value !== '') {
                switch (key) {
                    case 'birthdate':
                    case 'comment':
                    case 'fedWith':
                    case 'giveName':
                    case 'legalId':
                    case 'name':
                    case 'species':
                        entity[key] = { value: value, type: 'Property' };
                        break;

                    case 'temperature':
                        entity[key] = {
                            value: Number(value),
                            type: 'Property',
                            unitCode: 'CEL',
                            observedAt: timestamp
                        };
                        break;
                    case 'heartRate':
                        entity[key] = { value: Number(value), type: 'Property', unitCode: '5K', observedAt: timestamp };
                        break;
                    case 'weight':
                        entity[key] = {
                            value: Number(value),
                            type: 'Property',
                            unitCode: 'KGM',
                            observedAt: timestamp
                        };
                        break;

                    case 'jobTitle_name':
                        entity.jobTitle = {
                            type: 'Property',
                            value: {
                                name: row.jobTitle_name,
                                inDefinedTermSet: row.jobTitle_inDefinedTermSet,
                                termCode: row.jobTitle_termCode,
                                url: row.jobTitle_url
                            }
                        };
                        break;
                    case 'streetAddress':
                        entity.address = {
                            type: 'Property',
                            value: {
                                addressLocality: row.addressLocality,
                                addressRegion: row.addressRegion,
                                postalCode: row.postalCode,
                                streetAddress: row.streetAddress
                            }
                        };
                        break;
                    case 'location_type':
                        entity.location = {
                            type: 'GeoProperty',
                            observedAt: timestamp,
                            value: {
                                type: row.location_type,
                                coordinates: [Number(row.lng), Number(row.lat)]
                            }
                        };
                        break;

                    case 'category':
                    case 'cropStatus':
                    case 'gender':
                    case 'healthCondition':
                    case 'phenologicalCondition':
                    case 'reproductiveCondition':
                    case 'sex':
                        entity[key] = { vocab: value, type: 'VocabProperty' };
                        break;
                    case 'calvedBy':
                    case 'cropType':
                    case 'owns':
                    case 'owner':
                    case 'ownedBy':
                    case 'siredBy':
                        entity[key] = { object: value, type: 'Relationship' };
                        break;
                    case 'locatedAt':
                    case 'observation':
                    case 'prediction':
                        entity[key] = { object: value, type: 'Relationship', observedAt: timestamp };
                        break;
                    case 'id':
                    case 'type':
                        break;
                    default:
                        debug('unknown : ' + key);
                        break;
                }
            }

        });

        allEntities.push(entity);
    });
    return allEntities;
}

/*
 * Create an array of promises to send data to the context broker.
 * Each insert represents a series of readings at a given timestamp
 */
function createContextRequests(entities) {
    const promises = [];
    entities.forEach((entitiesAtTimeStamp) => {
        promises.push(BatchUpdate.sendAsHTTP(entitiesAtTimeStamp));
    });
    return promises;
}

/**
 * Actions when uploading a CSV file. The CSV file holds an array of
 * measurements each at a given timestamp.
 */
const upload = (req, res) => {
    if (req.file === undefined) {
        return res.status(Status.UNSUPPORTED_MEDIA_TYPE).send('Please upload a CSV file!');
    }

    const file = path.join(__dirname, '../resources/', req.file.filename);

    return readCsvFile(file)
        .then((rows) => {
            removeCsvFile(file);
            //console.log(rows[0])
            return createEntitiesFromRows(rows);
        })
        .then((entities) => {
            //console.log(JSON.stringify(entities[0], null, 2))

            batchEntities = [];
            const chunkSize = 10;

            for (let i = 0; i < entities.length; i += chunkSize) {
                const chunk = entities.slice(i, i + chunkSize);
                batchEntities.push(chunk);
            }

            return createContextRequests(batchEntities);
        })
        .then(async (promises) => {
            const results = [];
            for (const promise of promises) {
                const result = await promise;
                results.push(result);
            }
            return results;
        })
        .then((results) => {
            const errors = _.filter(results, function (o) {
                return o.status === 'rejected';
            });
            return errors.length ? res.status(Status.BAD_REQUEST).json(errors) : res.status(Status.NO_CONTENT).send();
        })
        .catch((err) => {
            debug(err.message);
            return res.status(Status.INTERNAL_SERVER_ERROR).send(err.message);
        });
};

module.exports = {
    upload
};
