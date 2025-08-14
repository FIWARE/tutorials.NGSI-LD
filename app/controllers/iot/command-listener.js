//
// This controller is a backdoor which allows a user to directly
// interact with the IoT devices by pressing a button on screen.
// The button press is converted to an NGSI call to the context
// broker.
//

const debug = require('debug')('tutorial:command-listener');
const Security = require('../security');

// Connect to the context broker and use fallback values if necessary
const CONTEXT_BROKER = process.env.CONTEXT_BROKER || 'http://localhost:1026/ngsi-ld/v1';
const DEVICE_BROKER = process.env.DEVICE_BROKER || CONTEXT_BROKER;
const NGSI_LD_TENANT = process.env.NGSI_LD_TENANT !== undefined ? process.env.NGSI_LD_TENANT : 'openiot';
const AUTHZFORCE_ENABLED = process.env.AUTHZFORCE_ENABLED || false;

const port = process.env.WEB_APP_PORT || '3000';
const devicesPort = process.env.DUMMY_DEVICES_PORT || 3001;
const devices = process.env.DUMMY_DEVICES || `http://localhost:${devicesPort}`;
const autoMoveTractors = process.env.MOVE_TRACTOR || 10000;

const dataModelContext =
    process.env.IOTA_JSON_LD_CONTEXT || 'http://localhost:' + port + '/data-models/ngsi-context.jsonld';

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

async function parse(response) {
    let text = '';
    try {
        text = await response.text();
        const data = JSON.parse(text);
        return data;
    } catch (err) {
        return text;
    }
}

// This function allows a Water Sprinkler, Tractor of FillingStation command to be sent to the Dummy IoT devices
// via the Orion Context Broker and an IoT Agent.

// eslint-disable-next-line consistent-return
function sendCommand(req, res) {
    const action = req.body.action;
    const id = (COMMANDS[action] || '') + req.body.id;

    // The barn Door is just a switch for operating the dummy devices
    // Update the status of all devices
    if (id === 'barn') {
        barnDoor();
        return res.status(204).send();
    }

    debug('sendCommand: ' + id + ' ' + action);
    if (!res.locals.authorized) {
        // If the user is not authorized, return an error code.
        res.setHeader('Content-Type', 'application/json');
        return res.status(403).send({ message: 'Forbidden' });
    }

    // The temperature Gauge does not accept commands,
    // Update the state of the device indirectly
    if (action === 'raise' || action === 'lower') {
        alterTemperature(id.replace('temperature', 'targetTemp'), action === 'raise');
        return res.status(204).send();
    }

    // The Weather does not accept commands,
    // Update the state of the weather indirectly to simulate changing conditions
    if (action === 'sunny' || action === 'cloudy' || action === 'raining') {
        alterWeather(action);
        return res.status(204).send();
    }

    if (!Object.keys(COMMANDS).includes(action)) {
        return res.status(404).send();
    }

    const options = createNGSILDRequest(action, id);

    if (req.session.access_token) {
        // If the system has been secured and we have logged in,
        // add the access token to the request to the PEP Proxy
        options.headers['X-Auth-Token'] = req.session.access_token;
    }

    debug(JSON.stringify(options));
    return fetch(options.url, {
        headers: options.headers,
        method: options.method,
        body: JSON.stringify(options.body)
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            return res.status(data.status).send(data.body);
        })
        .catch((e) => {
            debug(e);
            return res.status(400).send();
        });
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

// The barn Door is just a switch for the dummy devices
function barnDoor() {
    return fetch(`${devices}/barndoor`, {
        method: 'PUT',
        body: JSON.stringify({ update: true })
    }).catch((e) => {
        debug(e);
    });
}

// Update the state of the weather to simulate changing conditions
function alterWeather(action) {
    return fetch(`${devices}/weather`, {
        method: 'PUT',
        body: JSON.stringify({ action })
    }).catch((e) => {
        debug(e);
    });
}

function fireDevices() {
    return fetch(`${devices}/devices`, {
        method: 'PUT'
    }).catch((e) => {
        debug(e);
    });
}

function fireAnimalCollars() {
    return fetch(`${devices}/animals`, {
        method: 'PUT'
    }).catch((e) => {
        debug(e);
    });
}

function fireOverallFarmStatus() {
    return fetch(`${devices}/status`, {
        method: 'GET'
    }).catch((e) => {
        debug(e);
    });
}

function fireTractors() {
    return fetch(`${devices}/devices/tractors`, {
        method: 'PUT'
    }).catch((e) => {
        debug(e);
    });
}

setInterval(fireAnimalCollars, 5000);
setInterval(fireDevices, 3000);
setInterval(fireOverallFarmStatus, 10000);

if (autoMoveTractors > 0) {
    setInterval(fireTractors, autoMoveTractors);
}

// The temperature Gauge does not accept commands,
// Update the state of the device indirectly
function alterTemperature(id, raise) {
    return fetch(`${devices}/temperature/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ raise })
    }).catch((e) => {
        debug(e);
    });
}

module.exports = {
    accessControl,
    sendCommand
};
