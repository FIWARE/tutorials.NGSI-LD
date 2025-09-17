const fs = require('fs');
const csv = require('fast-csv');
const BatchUpdate = require('../lib/batchUpdate');
const debug = require('debug')('tutorial:csv');
const _ = require('lodash');
const Status = require('http-status-codes');
const path = require('path');

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

function tryParse(value) {
    try {
        return JSON.parse(value);
    } catch (e) {
        return value;
    }
}

function createEntitiesFromRows(rows) {
    const allEntities = [];
    const unitCode = {
        atmosphericPressure: 'PAL',
        illuminance: 'CDL',
        precipitation: 'MMT',
        windSpeed: 'MTS',
        relativeHumidity: 'C68',
        precipitationProbability: 'C68',
        heartRate: '5K',
        humidity: 'P1',
        temperature: 'CEL',
        weight: 'KGM',
        batteryLevel: 'C68'
    };
    const timestamp = new Date().toISOString();

    rows.forEach((row) => {
        const entity = {
            id: row.id,
            type: row.type
        };

        Object.keys(row).forEach((key) => {
            const value = row[key];
            if (value !== '') {
                switch (key) {
                    case 'agroVocConcept':
                    case 'alternateName':
                    case 'birthdate':

                    case 'controlledProperty':
                    case 'dataProvider':
                    case 'dateIssued':
                    case 'dateObserved':
                    case 'dateRetrieved':
                    case 'dayMaximum':
                    case 'dayMinimum':
                    case 'description':
                    case 'deviceState':
                    case 'fedWith':
                    case 'feelsLikeTemperature':
                    case 'givenName':
                    case 'legalId':
                    case 'name':
                    case 'pressureTendency':
                    case 'species':
                    case 'soilTextureType':
                    case 'status':
                    case 'streamGauge':
                    case 'source':
                    case 'supportedProtocol':
                    case 'uVIndexMax':
                    case 'validFrom':
                    case 'validTo':
                    case 'validity':
                    case 'weatherType':
                    case 'windDirection':
                        entity[key] = { value: tryParse(value), type: 'Property' };
                        break;
                    case 'comment':
                        entity[key] = { value: tryParse(value), type: 'Property', observedAt: timestamp };
                        break;

                    case 'atmosphericPressure':
                    case 'illuminance':
                    case 'precipitation':
                    case 'windSpeed':
                    case 'relativeHumidity':
                    case 'precipitationProbability':
                    case 'batteryLevel':
                        entity[key] = {
                            value: Number(value),
                            type: 'Property'
                        };
                        break;
                    case 'heartRate':
                    case 'humidity':
                    case 'temperature':
                    case 'weight':
                        entity[key] = {
                            value: Number(value),
                            type: 'Property',
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
                        entity[key] = { vocab: tryParse(value), type: 'VocabProperty' };
                        break;
                    case 'calvedBy':
                    case 'controlledAsset':
                    case 'deviceModel':
                    case 'cropType':
                    case 'owns':
                    case 'owner':
                    case 'ownedBy':
                    case 'siredBy':
                    case 'hasAgriSoil':
                    case 'hasAgriCrop':
                    case 'hasDevices':
                    case 'hasAgriPest':
                    case 'hasAgriParcel':
                    case 'hasBuilding':
                        entity[key] = { object: tryParse(value), type: 'Relationship' };
                        break;
                    case 'locatedAt':
                    case 'observation':
                    case 'prediction':
                        entity[key] = { object: tryParse(value), type: 'Relationship', observedAt: timestamp };
                        break;
                    case 'id':
                    case 'type':
                    case 'lat':
                    case 'lng':
                    case 'addressLocality':
                    case 'addressRegion':
                    case 'postalCode':
                    case 'providedBy':
                        break;
                    default:
                        if (!key.includes('_')) {
                            debug('unknown : ' + key);
                        }
                        break;
                }
                if (unitCode[key]) {
                    entity[key].unitCode = unitCode[key];
                }
            }
        });

        switch (entity.type) {
            case 'Animal':
                if (row.providedBy) {
                    if (entity.heartRate) {
                        entity.heartRate.providedBy = {
                            type: 'Relationship',
                            object: row.providedBy
                        };
                    }
                    if (entity.location) {
                        entity.location.providedBy = {
                            type: 'Relationship',
                            object: row.providedBy
                        };
                    }
                }
                break;
            case 'AgriParcel':
                if (row.providedBy) {
                    entity.humidity.providedBy = {
                        type: 'Relationship',
                        object: row.providedBy
                    };
                }
        }

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

            const batchEntities = [];
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
                // eslint-disable-next-line no-await-in-loop
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
