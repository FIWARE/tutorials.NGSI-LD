import fs from 'fs';
import * as csv from 'fast-csv';
import * as BatchUpdate from '../lib/batchUpdate';
import debug from 'debug';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import type { Request, Response } from 'express';

const log = debug('tutorial:csv');

/*
 * Delete the temporary file
 */
function removeCsvFile(filePath: string): void {
    fs.unlink(filePath, (err) => {
        if (err) {
            throw err;
        }
    });
}

/*
 * Read the CSV data from the temporary file.
 * This returns an in memory representation of the raw CSV file
 */
function readCsvFile(filePath: string): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
        const rows: Record<string, string>[] = [];

        fs.createReadStream(filePath)
            .pipe(csv.parse({ headers: true }))
            .on('error', (error: Error) => {
                reject(error.message);
            })
            .on('data', (row: Record<string, string>) => {
                rows.push(row);
            })
            .on('end', () => {
                resolve(rows);
            });
    });
}

function tryParse(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

// CSV birthdates are authored relative to this baseline date. Shift each one
// forward by (now - baseline) so imported animals keep the age they had then.
const BIRTHDATE_BASELINE = new Date('2025-08-01T00:00:00.000Z');

function rebaseBirthdate(value: string, now: Date): string {
    const offset = now.getTime() - BIRTHDATE_BASELINE.getTime();
    return new Date(new Date(value).getTime() + offset).toISOString();
}

interface EntityAttribute {
    type: string;
    value?: unknown;
    vocab?: unknown;
    object?: unknown;
    unitCode?: string;
    observedAt?: string;
    providedBy?: { type: string; object: string };
}

interface Entity {
    id: string;
    type: string;
    [key: string]: unknown;
}

const unitCode: Record<string, string> = {
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

function createEntitiesFromRows(rows: Record<string, string>[]): Entity[] {
    const allEntities: Entity[] = [];
    const now = new Date();
    const currentTimestamp = now.toISOString();

    rows.forEach((row) => {
        const entity: Entity = {
            id: row.id,
            type: row.type
        };

        let timestamp = currentTimestamp;
        if (row.offset) {
            timestamp = new Date(now.getTime() + Number(row.offset) * 60000).toISOString();
        }

        Object.keys(row).forEach((key) => {
            const value = row[key];
            if (value !== '') {
                switch (key) {
                    case 'agroVocConcept':
                    case 'alternateName':
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
                    case 'birthdate':
                        entity[key] = { value: rebaseBirthdate(value, now), type: 'Property' };
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
                    case 'offset':
                        break;

                    default:
                        if (!key.includes('_')) {
                            log('unknown : ' + key);
                        }
                        break;

                }
                if (unitCode[key]) {
                    (entity[key] as EntityAttribute).unitCode = unitCode[key];
                }
            }
        });

        switch (entity.type) {
            case 'Animal':
                if (row.providedBy) {
                    if (entity.heartRate) {
                        (entity.heartRate as EntityAttribute).providedBy = {
                            type: 'Relationship',
                            object: row.providedBy
                        };
                    }
                    if (entity.location) {
                        (entity.location as EntityAttribute).providedBy = {
                            type: 'Relationship',
                            object: row.providedBy
                        };
                    }
                }
                break;
            case 'AgriParcel':
                if (row.providedBy) {
                    (entity.humidity as EntityAttribute).providedBy = {
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
function createContextRequests(
    entities: Entity[][],
    tenant: string | undefined,
    authHeader: string | undefined
): Promise<unknown>[] {
    const promises: Promise<unknown>[] = [];
    entities.forEach((entitiesAtTimeStamp) => {
        promises.push(BatchUpdate.sendAsHTTP(entitiesAtTimeStamp, tenant, authHeader));
    });
    return promises;
}

/**
 * Actions when uploading a CSV file. The CSV file holds an array of
 * measurements each at a given timestamp.
 */
const upload = (req: Request, res: Response): Promise<Response> => {
    if (req.file === undefined) {
        return Promise.resolve(res.status(StatusCodes.UNSUPPORTED_MEDIA_TYPE).send('Please upload a CSV file!'));
    }

    const file = path.join(__dirname, '../resources/', req.file.filename);

    return readCsvFile(file)
        .then((rows) => {
            removeCsvFile(file);
            return createEntitiesFromRows(rows);
        })
        .then((entities) => {
            const batchEntities: Entity[][] = [];
            const chunkSize = 10;

            for (let i = 0; i < entities.length; i += chunkSize) {
                const chunk = entities.slice(i, i + chunkSize);
                batchEntities.push(chunk);
            }

            return createContextRequests(batchEntities, req.get('NGSILD-Tenant'), req.get('Authorization'));
        })
        .then((promises) => Promise.allSettled(promises))
        .then((results) => {
            const errors = results.filter((o) => o.status === 'rejected');
            return errors.length
                ? res.status(StatusCodes.BAD_REQUEST).json(errors)
                : res.status(StatusCodes.NO_CONTENT).send();
        })
        .catch((err: Error) => {
            log(err.message);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(err.message);
        });
};

export { upload };
