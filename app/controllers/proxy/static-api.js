//
// This controlller is a proxy for the Static API which responds with random data.
//

const debug = require('debug')('tutorial:proxy');
const Formatter = require('../../lib/formatter');
const monitor = require('../../lib/monitoring');
const _ = require('lodash');

const staticValues = {
    array: ['Arthur', 'Dent'],
    list: [
        'It has great practical value – you can wrap it around you for warmth as you bound across the cold moons of Jaglan Beta;',
        'You can lie on it on the brilliant marble-sanded beaches of Santraginus V, inhaling the heady sea vapours;',
        'You can sleep under it beneath the stars which shine so redly on the desert world of Kakrafoon;',
        'Use it to sail a mini raft down the slow heavy river Moth;',
        'Wet it for use in hand-to-hand-combat;',
        'Wrap it round your head to ward off noxious fumes or to avoid the gaze of the Ravenous Bugblatter Beast of Traal  ' +
            '(a mindboggingly stupid animal, it assumes that if you can’t see it, it can’t see you – daft as a bush, but very, very ravenous);',
        'You can wave your towel in emergencies as a distress signal, and of course dry yourself off with it if it still seems to be clean enough.'
    ],
    boolean: true,
    float: 42.0,
    integer: 42,
    number: 42,
    structuredvalue: {
        somevalue: 'this'
    },
    string: 'I never could get the hang of thursdays',
    text: 'I never could get the hang of thursdays'
};

//
// The Health Check endpoint returns some  canned responses to show it is functioning
//
function healthCheck(req, res) {
    debug('Static API is available - responding with some static values');
    monitor('health', 'Static API is healthy');
    res.status(200).send({
        array: staticValues.array,
        boolean: staticValues.boolean,
        number: staticValues.number,
        structuredValue: staticValues.structuredValue,
        text: staticValues.text
    });
}

//
// The /ngsi-ld/v1/entities/:id endpoint responds with data in the NGSI-LD format
//
function getAsNgsiLD(req, res) {
    const response = Formatter.formatResponse(req, null, (name, type) => {
        return staticValues[type.toLowerCase()];
    });
    if (req.headers.accept === 'application/ld+json') {
        res.set('Content-Type', 'application/ld+json');
    } else {
        res.set('Content-Type', 'application/json');
        delete response['@context'];
    }

    res.send(response);
}

//
// The /ngsi-ld/v1/entities/:id/attrs endpoint updates data received in
// the NGSI-LD format
//
function updateEntity(req, res) {
    monitor('/ngsi-ld/v1/entities', 'Update sent to the Static API', req.body);
    const mappedAttributes = Formatter.parseMapping(req.params.mapping);

    _.forEach(req.body, (value, attribute) => {
        if (mappedAttributes[attribute]) {
            staticValues[req.params.type] = value.value;
        }
    });
    res.statusCode = 204;
    res.send();
}

function updateSingleAttribute(req, res) {
    monitor('/ngsi-ld/v1/entities', 'Update sent to the Static API', req.body);
    staticValues[req.params.type] = req.body.value;
    res.statusCode = 204;
    res.send();
}

module.exports = {
    healthCheck,
    getAsNgsiLD,
    updateEntity,
    updateSingleAttribute
};
