const express = require('express');
const router = express.Router();
const monitor = require('../lib/monitoring');
const Device = require('../controllers/ngsi-ld/device');
const Farm = require('../controllers/ngsi-ld/farm');
const Animal = require('../controllers/ngsi-ld/animal');
const Land = require('../controllers/ngsi-ld/land');
const Person = require('../controllers/ngsi-ld/person');
const History = require('../controllers/history');
const DeviceListener = require('../controllers/iot/command-listener');
const Security = require('../controllers/security');
const Credentials = require('../controllers/credentials');

const ngsiLD = require('../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

const _ = require('lodash');
const debug = require('debug')('tutorial:ngsi-ld');

const TRANSPORT = process.env.DUMMY_DEVICES_TRANSPORT || 'HTTP';
const DEVICE_PAYLOAD = process.env.DUMMY_DEVICES_PAYLOAD || 'ultralight';
const GIT_COMMIT = process.env.GIT_COMMIT || 'unknown';
const SECURE_ENDPOINTS = process.env.SECURE_ENDPOINTS || false;
const ENTITY_LIMIT = process.env.ENTITY_LIMIT || 200;
//const AUTHZFORCE_ENABLED = process.env.AUTHZFORCE_ENABLED || false;

const NOTIFY_ATTRIBUTES = ['controlledAsset', 'type', 'filling', 'humidity', 'temperature'];

const numberOfPigs = process.env.PIG_COUNT || 5;

/* global SOCKET_IO */

// Error handler for async functions
function catchErrors(fn) {
    return (req, res, next) => {
        return fn(req, res, next).catch(next);
    };
}

// If an subscription is recieved emit socket io events
// using the attribute values from the data received to define
// who to send the event too.
function broadcastEvents(req, item, types) {
    const message = req.params.type + ' received';
    _.forEach(types, (type) => {
        if (item[type]) {
            monitor(item[type], message);
        }
    });
}

// Handles requests to the main page
router.get('/', async function (req, res) {
    const securityEnabled = SECURE_ENDPOINTS;

    const headers = ngsiLD.setHeaders(req.session.access_token, LinkHeader);
    try {
        const buildings = await ngsiLD.listEntities(
            {
                type: 'Building',
                options: 'concise',
                attrs: 'name',
                limit: ENTITY_LIMIT
            },
            headers
        );
        const animals = await ngsiLD.listEntities(
            {
                type: 'Animal',
                options: 'concise',
                attrs: 'name,species',
                limit: ENTITY_LIMIT
            },
            headers
        );
        const parcels = await ngsiLD.listEntities(
            {
                type: 'AgriParcel',
                options: 'concise',
                attrs: 'name',
                limit: ENTITY_LIMIT
            },
            headers
        );

        const devices = await ngsiLD.listEntities(
            {
                type: 'Devices',
                options: 'concise',
                attrs: 'name',
                limit: ENTITY_LIMIT
            },
            headers
        );

        const cows = _.filter(animals, (o) => {
            return o.species === 'dairy cattle';
        });
        const pigs = _.filter(animals, (o) => {
            return o.species === 'pig';
        });

        return res.render('index', {
            success: req.flash('success'),
            errors: req.flash('error'),
            info: req.flash('info'),
            securityEnabled,
            buildings,
            pigs,
            cows,
            parcels,
            devices,
            ngsi: 'ngsi-ld'
        });
    } catch (e) {
        debug(e.error);
        return res.render('index', {
            errors: [e.error],
            buildings: [],
            pigs: [],
            cows: [],
            parcels: [],
            devices: []
        });
    }
});

// Logs users in and out using Keyrock.
router.get('/login', Security.logInCallback);
router.get('/clientCredentials', Security.clientCredentialGrant);
router.get('/implicitGrant', Security.implicitGrant);
router.post('/userCredentials', Security.userCredentialGrant);
router.post('/refreshToken', Security.refreshTokenGrant);
router.get('/authCodeGrant', Security.authCodeGrant);
router.get('/logout', Security.logOut);

router.get('/version', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send({ gitHash: GIT_COMMIT });
});

// Render the monitoring page
router.get('/device/monitor', function (req, res) {
    const traffic = TRANSPORT === 'HTTP' ? 'Northbound Traffic' : 'MQTT Messages';
    const title = 'IoT Devices (' + DEVICE_PAYLOAD + ' over ' + TRANSPORT + ')';
    const securityEnabled = SECURE_ENDPOINTS;
    res.render('device-monitor', {
        title,
        traffic,
        securityEnabled
    });
});

// Access to IoT devices is secured by a Policy Decision Point (PDP).
// LEVEL 1: AUTHENTICATION ONLY -  For most actions, any user is authorized, just ensure the user exists.
// LEVEL 2: BASIC AUTHORIZATION -  Ringing the alarm bell and unlocking the Door are restricted to certain
//                                 users.
// LEVEL 3: XACML AUTHORIZATION -  Ringing the alarm bell and unlocking the Door are restricted via XACML
//                                 rules to certain users at certain times of day.
router.post('/device/command', DeviceListener.accessControl, DeviceListener.sendCommand);

// Retrieve Device History from STH-Comet
if (process.env.STH_COMET_SERVICE_URL) {
    router.get('/device/history/:deviceId', catchErrors(History.readCometDeviceHistory));
}
// Retrieve Device History from Crate-DB
if (process.env.CRATE_DB_SERVICE_URL) {
    router.get('/device/history/:deviceId', catchErrors(History.readCrateDeviceHistory));
}

// Display the app monitor page
router.get('/app/monitor', function (req, res) {
    res.render('monitor', { title: 'Event Monitor' });
});

// Display the app monitor page
router.get('/device/history', function (req, res) {
    const stores = [];
    if (process.env.CRATE_DB_SERVICE_URL || process.env.STH_COMET_SERVICE_URL) {
        for (let i = 1; i <= numberOfPigs; i++) {
            stores.push({
                name: 'Device' + i.toString().padStart(3, '0'),
                href: 'history/' + i.toString().padStart(3, '0')
            });
        }
    }
    res.render('history-index', {
        title: 'Short-Term History',
        stores
    });
});

router.get('/credentials', Credentials.init);
router.post('/vc/generate', Credentials.catchErrors(Credentials.generateCredential));
router.post('/vc/verify', Credentials.catchErrors(Credentials.verifyCredential));
router.post('/vp/generate', Credentials.catchErrors(Credentials.generatePresentation));
router.post('/vp/verify', Credentials.catchErrors(Credentials.verifyPresentation));
router.get('/vp/monitor', function (req, res) {
    res.render('trust', { title: 'Trust Monitor' });
});

// Viewing Store information is secured by Keyrock PDP.
// LEVEL 1: AUTHENTICATION ONLY - Users must be logged in to view the store page.
router.get('/app/animal/:id', Security.authenticate, Animal.display);
router.get('/app/agriparcel/:id', Security.authenticate, Land.display);

router.get('/app/building/:id', Security.authenticate, Farm.display);
router.get('/app/person/:id', Security.authenticate, Person.display);
router.get('/app/device-details/:id', Security.authenticate, Device.display);

// Whenever a subscription is received, display it on the monitor
// and notify any interested parties using Socket.io
router.post('/subscription/:type', (req, res) => {
    //debug(req.headers)
    monitor('notify', req.params.type + ' received', req.body);
    _.forEach(req.body.data, (item) => {
        broadcastEvents(req, item, NOTIFY_ATTRIBUTES);
    });
    res.status(204).send();
});

router.post('/message/:type', (req, res) => {
    SOCKET_IO.emit(req.params.type, req.body.data);
    res.status(204).send();
});

module.exports = router;
