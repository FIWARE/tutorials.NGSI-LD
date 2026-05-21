"use strict";
//
// This controller is a backdoor which allows a user to directly
// interact with the IoT devices by pressing a button on screen.
// The button press is converted to an NGSI call to the context
// broker.
//
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
exports.accessControl = accessControl;
exports.sendCommand = sendCommand;
exports.teardown = teardown;
const debug_1 = __importDefault(require("debug"));
const Security = __importStar(require("../security"));
const ngsi_ld_1 = require("../../lib/ngsi-ld");
const log = (0, debug_1.default)('tutorial:command-listener');
// Connect to the context broker and use fallback values if necessary
const DEVICE_BROKER = process.env.DEVICE_BROKER || ngsi_ld_1.BASE_PATH;
const NGSI_LD_TENANT = process.env.NGSI_LD_TENANT !== undefined ? process.env.NGSI_LD_TENANT : 'openiot';
const port = process.env.WEB_APP_PORT || '3000';
const devicesPort = process.env.DUMMY_DEVICES_PORT || 3001;
const devices = process.env.DUMMY_DEVICES || `http://localhost:${devicesPort}`;
const autoMoveTractors = process.env.MOVE_TRACTOR || 10000;
const devicesOff = process.env.DUMMY_OFF || false;
const dataModelContext = process.env.IOTA_JSON_LD_CONTEXT || 'http://localhost:' + port + '/data-models/ngsi-context.jsonld';
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
// eslint-disable-next-line consistent-return
function sendCommand(req, res) {
    const action = req.body.action;
    const id = (COMMANDS[action] || '') + req.body.id;
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
        .then((r) => (0, ngsi_ld_1.parse)(r).then((data) => ({ status: r.status, body: data })))
        .then((data) => {
        return res.status(data.status).send(data.body);
    })
        .catch((e) => {
        log(e);
        return res.status(400).send();
    });
}
// Tractor commands (start/stop) require equipment-supervisor; water commands (on/off) require livestock-supervisor.
// All other actions require authentication only.
const SUPERVISED_ACTIONS = new Set(['start', 'stop', 'on', 'off']);
function accessControl(req, res, next) {
    log('accessControl');
    const action = req.body.action;
    if (SUPERVISED_ACTIONS.has(action)) {
        return Security.authorizeBasicPDP(req, res, next);
    }
    return Security.authenticate(req, res, next);
}
// The barn Door is just a switch for the dummy devices
function barnDoor() {
    return fetch(`${devices}/barndoor`, {
        method: 'PUT',
        body: JSON.stringify({ update: true })
    }).catch((e) => {
        log(e);
    });
}
// Update the state of the weather to simulate changing conditions
function alterWeather(action) {
    return fetch(`${devices}/weather`, {
        method: 'PUT',
        body: JSON.stringify({ action })
    }).catch((e) => {
        log(e);
    });
}
function fireDevices(type) {
    return fetch(`${devices}/devices/${type}`, {
        method: 'GET'
    }).catch((e) => {
        log(e);
    });
}
function fireAnimalCollars() {
    return fetch(`${devices}/animals`, {
        method: 'GET'
    }).catch((e) => {
        log(e);
    });
}
function fireOverallFarmStatus() {
    return fetch(`${devices}/status`, {
        method: 'GET'
    }).catch((e) => {
        log(e);
    });
}
function updateTractorStatus() {
    return fetch(`${devices}/devices/tractor`, {
        method: 'PUT'
    }).catch((e) => {
        log(e);
    });
}
const timers = [];
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
}
else {
    log('Dummy device updates are disabled.');
}
// Stop all polling timers — call this during graceful shutdown or in tests
// to prevent timer handles accumulating across module reloads.
function teardown() {
    timers.forEach(clearInterval);
    timers.length = 0;
}
// The temperature Gauge does not accept commands,
// Update the state of the device indirectly
function alterTemperature(id, raise) {
    return fetch(`${devices}/temperature/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ raise })
    }).catch((e) => {
        log(e);
    });
}
