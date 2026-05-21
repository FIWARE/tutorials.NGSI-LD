import _ from 'lodash';
import parseLinks from 'parse-links';
import moment from 'moment';
import { Request } from 'express';

const port = process.env.WEB_APP_PORT || '3000';
const dataModelContext =
    process.env.IOTA_JSON_LD_CONTEXT || 'http://localhost:' + port + '/data-models/ngsi-context.jsonld';

//
// Entity types are typically title cased following Schema.org
//
function toTitleCase(str: string): string {
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
function parseMapping(input: string): Record<string, string> {
    const mappedAttributes: Record<string, string> = {};

    _.forEach(input.split(','), (element) => {
        if (element.includes(':')) {
            const splitElement = element.split(':');
            mappedAttributes[splitElement[0]] = splitElement[1];
        } else {
            mappedAttributes[element] = element;
        }
    });

    return mappedAttributes;
}

type AttributeValueCallback = (attribute: string, type: string, mapped: string, data: unknown) => unknown;

//
// Formatting function for an NGSI LD response to a context query.
//
function formatResponse(req: Request, inputData: unknown, attributeValueCallback: AttributeValueCallback): Record<string, unknown> {
    const mappedAttributes = parseMapping(String(req.params.mapping));
    const regex = /:.*/gi;
    const type = String(req.params.id).replace('urn:ngsi-ld:', '').replace(regex, '');
    const links = req.headers.link ? parseLinks(String(req.headers.link)) : { context: dataModelContext };
    const attrs = (req.query.attrs as string || '').split(',');

    const response: Record<string, unknown> = {
        '@context': links.context,
        id: req.params.id,
        type
    };

    _.forEach(attrs, (attribute) => {
        if (mappedAttributes[attribute]) {
            const value = attributeValueCallback(attribute, String(req.params.type), mappedAttributes[attribute], inputData);
            if (req.query.options === 'keyValues') {
                response[attribute] = value;
            } else {
                response[attribute] = {
                    type: 'Property',
                    value
                };
                const attr = response[attribute] as Record<string, unknown>;
                if (attribute === 'temperature') {
                    attr.unitCode = 'CEL';
                    attr.observedAt = moment.utc().format();
                } else if (attribute === 'relativeHumidity') {
                    attr.unitCode = 'P1';
                    attr.observedAt = moment.utc().format();
                }
            }
        }
    });
    return response;
}

export { formatResponse, toTitleCase, parseMapping };
