const express = require('express');
const router = express.Router();
const monitor = require('../lib/monitoring');
const Device = require('../controllers/ngsi-ld/device');
const Farm = require('../controllers/ngsi-ld/farm');
const Animal = require('../controllers/ngsi-ld/animal');
const Crop = require('../controllers/ngsi-ld/crop');
const Soil = require('../controllers/ngsi-ld/soil');
const Pest = require('../controllers/ngsi-ld/pest');
const AgriDevice = require('../controllers/ngsi-ld/agri-device');
const AgriFarm = require('../controllers/ngsi-ld/agri-farm');
const Weather = require('../controllers/ngsi-ld/weather');
const Land = require('../controllers/ngsi-ld/land');
const Person = require('../controllers/ngsi-ld/person');
const Stocks = require('../controllers/ngsi-ld/stocks');

const History = require('../controllers/history');
const DeviceListener = require('../controllers/iot/command-listener');
const Security = require('../controllers/security');
const Credentials = require('../controllers/credentials');
const csvController = require('../controllers/csv');

const ngsiLD = require('../lib/ngsi-ld');
const upload = require('../lib/upload');

const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

const _ = require('lodash');
const debug = require('debug')('tutorial:index');

const TRANSPORT = process.env.DUMMY_DEVICES_TRANSPORT || 'HTTP';
const DEVICE_PAYLOAD = process.env.DUMMY_DEVICES_PAYLOAD || 'ultralight';
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

    console.log(req.params.local);
    const headers = ngsiLD.setHeaders(null, LinkHeader);
    try {
        monitor('NGSI', 'listEntities ?type=City');
        const cities = await ngsiLD.listEntities(
            {
                type: 'https://case-agri.com/City',
                options: 'simplified',
                attrs: 'name',
                limit: ENTITY_LIMIT
            },
            headers
        );

        monitor('NGSI', 'listEntities ?type=Product');
        const products = await ngsiLD.listEntities(
            {
                type: 'https://case-agri.com/Product',
                options: 'concise',
                attrs: 'name',
                limit: ENTITY_LIMIT
            },
            headers
        );

        console.log(cities);
        console.log(products);

        return res.render('index', {
            title: 'Casa Agri Demo',
            success: '',
            errors: '',
            info: '',
            securityEnabled,
            cities,
            products,
            ngsi: 'ngsi-ld'
        });
    } catch (e) {
        debug(e);
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

// Viewing Store information is secured by Keyrock PDP.
// LEVEL 1: AUTHENTICATION ONLY - Users must be logged in to view the store page.

router.get('/app/animals/locations.json', Animal.geojson);
router.get('/app/map', Security.authenticate, Animal.displayMap);
router.get('/app/animal/:id', Security.authenticate, Animal.display);
router.get('/app/agriparcel/:id', Security.authenticate, Land.display);
router.get('/app/crop/:id', Security.authenticate, Crop.display);
router.get('/app/soil/:id', Security.authenticate, Soil.display);
router.get('/app/pest/:id', Security.authenticate, Pest.display);
router.get('/app/weather/:id', Security.authenticate, Weather.display);
router.get('/app/agri-device/:id', Security.authenticate, AgriDevice.display);
router.get('/app/agri-farm/:id', Security.authenticate, AgriFarm.display);

router.get('/app/building/:id', Security.authenticate, Farm.display);
router.get('/app/person/:id', Security.authenticate, Person.display);
router.get('/app/device-details/:id', Security.authenticate, Device.display);

router.post('/app/get-stocks', Stocks.display);

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

router.post(
    '/csv/:type',
    upload.single('file'),
    catchErrors(async (req, res) => {
        await csvController.upload(req, res);
    })
);

module.exports = router;
