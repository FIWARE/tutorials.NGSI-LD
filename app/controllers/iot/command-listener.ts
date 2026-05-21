//
// This controller is a backdoor which allows a user to directly
// interact with the IoT devices by pressing a button on screen.
// The button press is converted to an NGSI call to the context
// broker.
//

import debug from 'debug';
import * as Security from '../security';
import { BASE_PATH, parse } from '../../lib/ngsi-ld';
import type { Request, Response, NextFunction } from 'express';

const log = debug('tutorial:command-listener');

// Connect to the context broker and use fallback values if necessary
const DEVICE_BROKER = process.env.DEVICE_BROKER || BASE_PATH;
const NGSI_LD_TENANT = process.env.NGSI_LD_TENANT !== undefined ? process.env.NGSI_LD_TENANT : 'openiot';

const port = process.env.WEB_APP_PORT || '3000';
const devicesPort = process.env.DUMMY_DEVICES_PORT || 3001;
const devices = process.env.DUMMY_DEVICES || `http://localhost:${devicesPort}`;
const autoMoveTractors = process.env.MOVE_TRACTOR || 10000;
const devicesOff = process.env.DUMMY_OFF || false;

const dataModelContext =
    process.env.IOTA_JSON_LD_CONTEXT || 'http://localhost:' + port + '/data-models/ngsi-context.jsonld';

const COMMANDS: Record<string, string> = {
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

interface NGSILDRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: { type: string; value: string };
    json: boolean;
}

function createNGSILDRequest(action: string, id: string): NGSILDRequest {
    const method = 'PATCH';
    const body = {
        type: 'Property',
        value: ' '
    };
    const url = DEVICE_BROKER + '/entities/urn:ngsi-ld:Device:' + id + '/attrs/' + action;
    const headers: Record<string, string> = {
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

function sendCommand(req: Request, res: Response): Promise<Response> | Response {
    const action = (req.body as Record<string, string>).action;
    const id = (COMMANDS[action] || '') + (req.body as Record<string, string>).id;

    // The barn Door is just a switch for operating the dummy devices
    // Update the status of all devices
    if (id === 'barn') {
        void barnDoor();
        return res.status(204).send();
    }

    log('sendCommand: ' + id + ' ' + action);
    if (!res.locals.authorized) {
        // If the user is not authorized, return an error code.
        res.setHeader('Content-Type', 'application/json');
        return res.status(403).send({ message: 'Forbidden' });
    }

    // The temperature Gauge does not accept commands,
    // Update the state of the device indirectly
    if (action === 'raise' || action === 'lower') {
        void alterTemperature(id.replace('temperature', 'targetTemp'), action === 'raise');
        return res.status(204).send();
    }

    // The Weather does not accept commands,
    // Update the state of the weather indirectly to simulate changing conditions
    if (action === 'sunny' || action === 'cloudy' || action === 'raining') {
        void alterWeather(action);
        return res.status(204).send();
    }

    if (!Object.keys(COMMANDS).includes(action)) {
        return res.status(404).send();
    }

    const options = createNGSILDRequest(action, id);

    if (req.session.access_token) {
        // If the system has been secured and we have logged in,
        // add the access token to the request to the PEP Proxy
        options.headers.Authorization = `Bearer ${req.session.access_token}`;
    }

    log(JSON.stringify(options));
    return fetch(options.url, {
        headers: options.headers,
        method: options.method,
        body: JSON.stringify(options.body)
    })
        .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
            return res.status(data.status).send(data.body);
        })
        .catch((e: Error) => {
            log(e);
            return res.status(400).send();
        });
}

// Tractor commands (start/stop) require equipment-supervisor; water commands (on/off) require livestock-supervisor.
// All other actions require authentication only.
const SUPERVISED_ACTIONS = new Set(['start', 'stop', 'on', 'off']);

function accessControl(req: Request, res: Response, next: NextFunction): void {
    log('accessControl');
    const action = (req.body as Record<string, string>).action;
    if (SUPERVISED_ACTIONS.has(action)) {
        return Security.authorizeBasicPDP(req, res, next);
    }
    return Security.authenticate(req, res, next);
}

// The barn Door is just a switch for the dummy devices
function barnDoor(): Promise<unknown> {
    return fetch(`${devices}/barndoor`, {
        method: 'PUT',
        body: JSON.stringify({ update: true })
    }).catch((e: Error) => {
        log(e);
    });
}

// Update the state of the weather to simulate changing conditions
function alterWeather(action: string): Promise<unknown> {
    return fetch(`${devices}/weather`, {
        method: 'PUT',
        body: JSON.stringify({ action })
    }).catch((e: Error) => {
        log(e);
    });
}

function fireDevices(type: string): Promise<unknown> {
    return fetch(`${devices}/devices/${type}`, {
        method: 'GET'
    }).catch((e: Error) => {
        log(e);
    });
}

function fireAnimalCollars(): Promise<unknown> {
    return fetch(`${devices}/animals`, {
        method: 'GET'
    }).catch((e: Error) => {
        log(e);
    });
}

function fireOverallFarmStatus(): Promise<unknown> {
    return fetch(`${devices}/status`, {
        method: 'GET'
    }).catch((e: Error) => {
        log(e);
    });
}

function updateTractorStatus(): Promise<unknown> {
    return fetch(`${devices}/devices/tractor`, {
        method: 'PUT'
    }).catch((e: Error) => {
        log(e);
    });
}

const timers: ReturnType<typeof setInterval>[] = [];

if (!devicesOff) {
    log(`Enabling dummy device updates on ${devices}`);
    timers.push(setInterval(() => { void fireDevices('tractor'); }, 3361));
    timers.push(setInterval(() => { void fireAnimalCollars(); }, 5099));
    timers.push(setInterval(() => { void fireDevices('temperature'); }, 7001));
    timers.push(setInterval(() => { void fireOverallFarmStatus(); }, 10000));
    timers.push(setInterval(() => { void fireDevices('humidity'); }, 8009));

    if (Number(autoMoveTractors) > 0) {
        timers.push(setInterval(() => { void updateTractorStatus(); }, Number(autoMoveTractors)));
    }
} else {
    log('Dummy device updates are disabled.');
}

// Stop all polling timers — call this during graceful shutdown or in tests
// to prevent timer handles accumulating across module reloads.
function teardown(): void {
    timers.forEach(clearInterval);
    timers.length = 0;
}

// The temperature Gauge does not accept commands,
// Update the state of the device indirectly
function alterTemperature(id: string, raise: boolean): Promise<unknown> {
    return fetch(`${devices}/temperature/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ raise })
    }).catch((e: Error) => {
        log(e);
    });
}

export { accessControl, sendCommand, teardown };
