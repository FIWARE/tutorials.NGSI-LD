"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const fs_1 = __importDefault(require("fs"));
const csv = __importStar(require("fast-csv"));
const BatchUpdate = __importStar(require("../lib/batchUpdate"));
const debug_1 = __importDefault(require("debug"));
const http_status_codes_1 = require("http-status-codes");
const path_1 = __importDefault(require("path"));
const log = (0, debug_1.default)('tutorial:csv');
/*
 * Delete the temporary file
 */
function removeCsvFile(filePath) {
    fs_1.default.unlink(filePath, (err) => {
        if (err) {
            throw err;
        }
    });
}
/*
 * Read the CSV data from the temporary file.
 * This returns an in memory representation of the raw CSV file
 */
function readCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs_1.default.createReadStream(filePath)
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
    }
    catch (e) {
        return value;
    }
}
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
function createEntitiesFromRows(rows) {
    const allEntities = [];
    const now = new Date();
    const currentTimestamp = now.toISOString();
    rows.forEach((row) => {
        const entity = {
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
                /* eslint-disable no-fallthrough */
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
                    case 'offset':
                        break;
                    default:
                        if (!key.includes('_')) {
                            log('unknown : ' + key);
                        }
                        break;
                    /* eslint-enable no-fallthrough */
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
function createContextRequests(entities, tenant, authHeader) {
    const promises = [];
    entities.forEach((entitiesAtTimeStamp) => {
        promises.push(BatchUpdate.sendAsHTTP(entitiesAtTimeStamp, tenant, authHeader));
    });
    return promises;
}
/**
 * Actions when uploading a CSV file. The CSV file holds an array of
 * measurements each at a given timestamp.
 */
const upload = (req, res) => {
    if (req.file === undefined) {
        return Promise.resolve(res.status(http_status_codes_1.StatusCodes.UNSUPPORTED_MEDIA_TYPE).send('Please upload a CSV file!'));
    }
    const file = path_1.default.join(__dirname, '../resources/', req.file.filename);
    return readCsvFile(file)
        .then((rows) => {
        removeCsvFile(file);
        return createEntitiesFromRows(rows);
    })
        .then((entities) => {
        const batchEntities = [];
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
            ? res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json(errors)
            : res.status(http_status_codes_1.StatusCodes.NO_CONTENT).send();
    })
        .catch((err) => {
        log(err.message);
        return res.status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR).send(err.message);
    });
};
exports.upload = upload;
