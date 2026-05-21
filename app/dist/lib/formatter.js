"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatResponse = formatResponse;
exports.toTitleCase = toTitleCase;
exports.parseMapping = parseMapping;
const lodash_1 = __importDefault(require("lodash"));
const parse_links_1 = __importDefault(require("parse-links"));
const moment_1 = __importDefault(require("moment"));
const port = process.env.WEB_APP_PORT || '3000';
const dataModelContext = process.env.IOTA_JSON_LD_CONTEXT || 'http://localhost:' + port + '/data-models/ngsi-context.jsonld';
//
// Entity types are typically title cased following Schema.org
//
function toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1);
    });
}
// NGSI attribute names should follow Data Model Guidelines (e.g. camelCasing)
// Data returned from third-party APIs such as the Weather API will not enforce the same guidelines.
// It is therefore necessary to invoke a mapping to be able to know which value to retieve.
//
// This function assumes that mappings are defined in the path as follows:
//
//   temperature
//      temperature NGSI attribute maps to temperature attribute on the API data
//   temperature:temp_c
//      temperature NGSI attribute maps to temp_c attribute on the API data
//   temperature:temp_c,windSpeed:wind_speed
//      temperature NGSI attribute maps to temp_c attribute on the API data
//      windSpeed NGSI attribute maps to wind_speed attribute on the API data
//
// For the full guidelines see:
//    http://fiware-datamodels.readthedocs.io/en/latest/guidelines/index.html
//
function parseMapping(input) {
    const mappedAttributes = {};
    lodash_1.default.forEach(input.split(','), (element) => {
        if (element.includes(':')) {
            const splitElement = element.split(':');
            mappedAttributes[splitElement[0]] = splitElement[1];
        }
        else {
            mappedAttributes[element] = element;
        }
    });
    return mappedAttributes;
}
//
// Formatting function for an NGSI LD response to a context query.
//
function formatResponse(req, inputData, attributeValueCallback) {
    const mappedAttributes = parseMapping(String(req.params.mapping));
    const regex = /:.*/gi;
    const type = String(req.params.id).replace('urn:ngsi-ld:', '').replace(regex, '');
    const links = req.headers.link ? (0, parse_links_1.default)(String(req.headers.link)) : { context: dataModelContext };
    const attrs = (req.query.attrs || '').split(',');
    const response = {
        '@context': links.context,
        id: req.params.id,
        type
    };
    lodash_1.default.forEach(attrs, (attribute) => {
        if (mappedAttributes[attribute]) {
            const value = attributeValueCallback(attribute, String(req.params.type), mappedAttributes[attribute], inputData);
            if (req.query.options === 'keyValues') {
                response[attribute] = value;
            }
            else {
                response[attribute] = {
                    type: 'Property',
                    value
                };
                const attr = response[attribute];
                if (attribute === 'temperature') {
                    attr.unitCode = 'CEL';
                    attr.observedAt = moment_1.default.utc().format();
                }
                else if (attribute === 'relativeHumidity') {
                    attr.unitCode = 'P1';
                    attr.observedAt = moment_1.default.utc().format();
                }
            }
        }
    });
    return response;
}
