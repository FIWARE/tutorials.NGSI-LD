//
// This controller is a backdoor which allows a user to directly
// interact with the IoT devices by pressing a button on screen.
// The button press is converted to an NGSI call to the context
// broker.
//

const request = require('request');
const debug = require('debug')('tutorial:command-listener');
const Security = require('../security');
const IoTDevices = require('../../models/devices');

// Connect to the context broker and use fallback values if necessary
const CONTEXT_BROKER = process.env.CONTEXT_BROKER || 'http://localhost:1026/ngsi-ld/v1';
const DEVICE_BROKER = process.env.DEVICE_BROKER || CONTEXT_BROKER;
const NGSI_LD_TENANT = process.env.NGSI_LD_TENANT !== undefined ? process.env.NGSI_LD_TENANT : 'openiot';
const AUTHZFORCE_ENABLED = process.env.AUTHZFORCE_ENABLED || false;

const dataModelContext = process.env.IOTA_JSON_LD_CONTEXT || 'http://localhost:3000/data-models/ngsi-context.jsonld';

const COMMANDS = {
    on: 'water',
    off: 'water',
    start: 'tractor',
    stop: 'tractor',
    add: 'filling',
    remove: 'filling',
    refill: 'filling',
    raise: 'temperature',
    lower: 'temperature'
};

function createNGSILDRequest(action, id) {
    const method = 'PATCH';
    const body = {
        type: 'Property',
        value: ' '
    };
    const url = DEVICE_BROKER + '/entities/urn:ngsi-ld:Device:' + id + '/attrs/' + action;
    const headers = {
        'Content-Type': 'application/json',
        'NGSILD-Tenant': NGSI_LD_TENANT,
        'NGSILD-Path': '/',
        'fiware-service': NGSI_LD_TENANT,
        'fiware-servicepath': '/',
        Link: '<' + dataModelContext + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
    };

    return { method, url, headers, body, json: true };
}

// This function allows a Water Sprinkler, Tractor of FillingStation command to be sent to the Dummy IoT devices
// via the Orion Context Broker and an IoT Agent.
function sendCommand(req, res) {
    const action = req.body.action;
    const id = (COMMANDS[action] || '') + req.body.id;
    debug('sendCommand: ' + id + ' ' + action);
    if (!res.locals.authorized) {
        // If the user is not authorized, return an error code.
        res.setHeader('Content-Type', 'application/json');
        return res.status(403).send({ message: 'Forbidden' });
    }

    if (!Object.keys(COMMANDS).includes(action)) {
        return res.status(404).send();
    }

    // The temperature Gauge does not accept commands,
    // Update the state of the device directly
    if (action === 'raise' || action === 'lower') {
        IoTDevices.alterTemperature('targetTemp' + id, action === 'raise');
        return res.status(204).send();
    }

    const options = createNGSILDRequest(action, id);

    if (req.session.access_token) {
        // If the system has been secured and we have logged in,
        // add the access token to the request to the PEP Proxy
        options.headers['X-Auth-Token'] = req.session.access_token;
    }

    request(options, (error) => {
        if (error) {
            debug(error);
        }
    });

    // Return a success code.
    return res.status(204).send();
}

// Ringing the bell and unlocking the door are restricted actions, everything else
// can be done by any user. This is a simple access control function to ensure
// only users who are authorized can do certain things.
function accessControl(req, res, next) {
    debug('accessControl');
    const action = req.body.action;
    if (action === 'ring') {
        // LEVEL 2: BASIC AUTHORIZATION - Resources are accessible on a User/Verb/Resource basis
        // LEVEL 3: ADVANCED AUTHORIZATION - Resources are accessible on XACML Rules
        return AUTHZFORCE_ENABLED
            ? Security.authorizeAdvancedXACML(req, res, next, '/bell/ring')
            : Security.authorizeBasicPDP(req, res, next, '/bell/ring');
    } else if (action === 'unlock') {
        // LEVEL 2: BASIC AUTHORIZATION - Resources are accessible on a User/Verb/Resource basis
        // LEVEL 3: ADVANCED AUTHORIZATION - Resources are accessible on XACML Rules
        return AUTHZFORCE_ENABLED
            ? Security.authorizeAdvancedXACML(req, res, next, '/door/unlock')
            : Security.authorizeBasicPDP(req, res, next, '/door/unlock');
    }
    // LEVEL 1: AUTHENTICATION ONLY - Every user is authorized, just ensure the user exists.
    return Security.authenticate(req, res, next);
}

module.exports = {
    accessControl,
    sendCommand
};
