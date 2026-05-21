import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import monitor from '../lib/monitoring';
import * as Device from '../controllers/ngsi-ld/device';
import * as Farm from '../controllers/ngsi-ld/farm';
import * as Animal from '../controllers/ngsi-ld/animal';
import * as AgriDevice from '../controllers/ngsi-ld/agri-device';
import * as Person from '../controllers/ngsi-ld/person';
import { displayEntity } from '../controllers/ngsi-ld/display-entity';
import * as History from '../controllers/history';
import * as DeviceListener from '../controllers/iot/command-listener';
import * as Security from '../controllers/security';
import * as Credentials from '../controllers/credentials';
import * as csvController from '../controllers/csv';

import * as ngsiLD from '../lib/ngsi-ld';
const { LinkHeader } = ngsiLD;
import upload from '../lib/upload';

import _ from 'lodash';
import debug from 'debug';

const router = express.Router();
const log = debug('tutorial:ngsi-ld');

const TRANSPORT = process.env.DUMMY_DEVICES_TRANSPORT || 'HTTP';
const DEVICE_PAYLOAD = process.env.DUMMY_DEVICES_PAYLOAD || 'ultralight';
const SECURE_ENDPOINTS = process.env.SECURE_ENDPOINTS || false;
const ENTITY_LIMIT = process.env.ENTITY_LIMIT || 200;

const NOTIFY_ATTRIBUTES = ['controlledAsset', 'type', 'filling', 'humidity', 'temperature'];

const numberOfPigs = process.env.PIG_COUNT || 5;

// Error handler for async functions
function catchErrors(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
        return fn(req, res, next).catch(next);
    };
}

// If an subscription is recieved emit socket io events
// using the attribute values from the data received to define
// who to send the event too.
function broadcastEvents(req: Request, item: Record<string, unknown>, types: string[]): void {
    const message = req.params.type + ' received';
    _.forEach(types, (type) => {
        if (item[type]) {
            monitor(String(item[type]), message);
        }
    });
}

// Handles requests to the main page
router.get('/', async function (req: Request, res: Response) {
    const securityEnabled = SECURE_ENDPOINTS;

    const headers = ngsiLD.setHeaders(req.session.access_token, LinkHeader);
    try {
        monitor('NGSI', 'listEntities ?type=Building');
        monitor('NGSI', 'listEntities ?type=Animal');
        monitor('NGSI', 'listEntities ?type=AgriParcel');
        monitor('NGSI', 'listEntities ?type=Device');
        const [getBuildings, animals, getParcels, devices] = await Promise.all([
            ngsiLD.listEntities({ type: 'Building', format: 'keyValues', pick: 'id,name', limit: ENTITY_LIMIT }, headers),
            ngsiLD.listEntities(
                { type: 'Animal', format: 'keyValues', pick: 'id,name,species,phenologicalCondition', limit: ENTITY_LIMIT },
                headers
            ),
            ngsiLD.listEntities({ type: 'AgriParcel', format: 'keyValues', pick: 'id,name', limit: ENTITY_LIMIT }, headers),
            ngsiLD.listEntities({ type: 'Device', format: 'keyValues', pick: 'id,name', limit: ENTITY_LIMIT }, headers)
        ]);
        const buildings = (getBuildings as Array<{ name: string }>).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        const parcels = (getParcels as Array<{ name: string }>).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        const cows = _.filter(animals as Array<{ species: string; name: string }>, (o) => {
            return o.species === 'dairy cattle';
        }).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        const pigs = _.filter(animals as Array<{ species: string; name: string }>, (o) => {
            return o.species === 'pig';
        }).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        return res.render('index', {
            title: 'NGSI-LD Smart Farm',
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
        const err = e as { error?: unknown };
        const errorDetail = err.error || e;
        log(errorDetail);
        return res.render('index', {
            errors: [errorDetail],
            securityEnabled,
            buildings: [],
            pigs: [],
            cows: [],
            parcels: [],
            devices: []
        });
    }
});

// Keycloak OIDC flows
router.get('/login', Security.authCodeGrant);
router.get('/login/callback', Security.authCodeGrantCallback);
router.post('/login/callback', Security.authCodeGrantCallback);
router.get('/authCodeGrant', Security.authCodeGrant);
router.get('/implicitGrant', Security.implicitGrant);
router.get('/clientCredentials', Security.clientCredentialGrant);
router.post('/userCredentials', Security.userCredentialGrant);
router.post('/refreshToken', Security.refreshTokenGrant);
router.get('/logout', Security.logOut);

// Render the monitoring page
router.get('/device/monitor', function (req: Request, res: Response) {
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
// LEVEL 1: AUTHENTICATION ONLY -  For most actions, any logged-in user is authorized.
// LEVEL 2: BASIC AUTHORIZATION -  Tractor (start/stop) and water (on/off) commands require a
//                                 supervisor role (equipment-supervisor or livestock-supervisor).
router.post('/device/command', DeviceListener.accessControl, DeviceListener.sendCommand);

// Retrieve Device History from Crate-DB
if (process.env.CRATE_DB_SERVICE_URL) {
    router.get('/device/history/:deviceId', catchErrors(History.readCrateDeviceHistory));
}

// Display the app monitor page
router.get('/app/monitor', function (req: Request, res: Response) {
    res.render('monitor', { title: 'Event Monitor' });
});

// Display the app monitor page
router.get('/device/history', function (req: Request, res: Response) {
    const stores: { name: string; href: string }[] = [];
    if (process.env.CRATE_DB_SERVICE_URL || process.env.STH_COMET_SERVICE_URL) {
        for (let i = 1; i <= Number(numberOfPigs); i++) {
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
router.get('/vp/monitor', function (req: Request, res: Response) {
    res.render('trust', { title: 'Trust Monitor' });
});

// Farm data routes secured by Keycloak PDP.
// LEVEL 1: AUTHENTICATION ONLY - Users must be logged in to view farm data.

router.get('/app/animals/locations.json', Animal.geojson);
router.get('/app/animals', Security.authenticate, Animal.displayMap);
router.get('/app/animal/:id', Security.authenticate, Animal.display);
router.get('/app/agriparcel/:id', Security.authenticate, displayEntity('land', 'land'));
router.get('/app/crop/:id', Security.authenticate, displayEntity('crop', 'crop'));
router.get('/app/soil/:id', Security.authenticate, displayEntity('soil', 'soil'));
router.get('/app/pest/:id', Security.authenticate, displayEntity('pest', 'pest'));
router.get('/app/weather/:id', Security.authenticate, displayEntity('weather', 'weather'));
router.get('/app/agri-device/:id', Security.authenticate, AgriDevice.display);
router.get('/app/agri-farm/:id', Security.authenticate, displayEntity('agri-farm', 'farm'));

router.get('/app/building/:id', Security.authenticate, Farm.display);
router.get('/app/person/:id', Security.authenticate, Person.display);
router.get('/app/device-details/:id', Security.authenticate, Device.display);

// Whenever a subscription is received, display it on the monitor
// and notify any interested parties using Socket.io
router.post('/subscription/:type', (req: Request, res: Response) => {
    //log(req.headers)
    monitor('notify', req.params.type + ' received', req.body as Record<string, unknown>);
    _.forEach((req.body as { data: Record<string, unknown>[] }).data, (item) => {
        broadcastEvents(req, item, NOTIFY_ATTRIBUTES);
    });
    res.status(204).send();
});

router.post('/message/:type', (req: Request, res: Response) => {
    global.SOCKET_IO.emit(String(req.params.type), (req.body as { data: unknown }).data);
    res.status(204).send();
});

router.post(
    '/csv/:type',
    upload.single('file'),
    catchErrors(async (req: Request, res: Response) => {
        await csvController.upload(req, res);
    })
);

export default router;
