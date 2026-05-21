"use strict";
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
const express_1 = __importDefault(require("express"));
const monitoring_1 = __importDefault(require("../lib/monitoring"));
const Device = __importStar(require("../controllers/ngsi-ld/device"));
const Farm = __importStar(require("../controllers/ngsi-ld/farm"));
const Animal = __importStar(require("../controllers/ngsi-ld/animal"));
const Crop = __importStar(require("../controllers/ngsi-ld/crop"));
const Soil = __importStar(require("../controllers/ngsi-ld/soil"));
const Pest = __importStar(require("../controllers/ngsi-ld/pest"));
const AgriDevice = __importStar(require("../controllers/ngsi-ld/agri-device"));
const AgriFarm = __importStar(require("../controllers/ngsi-ld/agri-farm"));
const Weather = __importStar(require("../controllers/ngsi-ld/weather"));
const Land = __importStar(require("../controllers/ngsi-ld/land"));
const Person = __importStar(require("../controllers/ngsi-ld/person"));
const History = __importStar(require("../controllers/history"));
const DeviceListener = __importStar(require("../controllers/iot/command-listener"));
const Security = __importStar(require("../controllers/security"));
const Credentials = __importStar(require("../controllers/credentials"));
const csvController = __importStar(require("../controllers/csv"));
const ngsiLD = __importStar(require("../lib/ngsi-ld"));
const { LinkHeader } = ngsiLD;
const upload_1 = __importDefault(require("../lib/upload"));
const lodash_1 = __importDefault(require("lodash"));
const debug_1 = __importDefault(require("debug"));
const router = express_1.default.Router();
const log = (0, debug_1.default)('tutorial:ngsi-ld');
const TRANSPORT = process.env.DUMMY_DEVICES_TRANSPORT || 'HTTP';
const DEVICE_PAYLOAD = process.env.DUMMY_DEVICES_PAYLOAD || 'ultralight';
const SECURE_ENDPOINTS = process.env.SECURE_ENDPOINTS || false;
const ENTITY_LIMIT = process.env.ENTITY_LIMIT || 200;
const NOTIFY_ATTRIBUTES = ['controlledAsset', 'type', 'filling', 'humidity', 'temperature'];
const numberOfPigs = process.env.PIG_COUNT || 5;
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
    lodash_1.default.forEach(types, (type) => {
        if (item[type]) {
            (0, monitoring_1.default)(String(item[type]), message);
        }
    });
}
// Handles requests to the main page
router.get('/', async function (req, res) {
    const securityEnabled = SECURE_ENDPOINTS;
    const headers = ngsiLD.setHeaders(req.session.access_token, LinkHeader);
    try {
        (0, monitoring_1.default)('NGSI', 'listEntities ?type=Building');
        (0, monitoring_1.default)('NGSI', 'listEntities ?type=Animal');
        (0, monitoring_1.default)('NGSI', 'listEntities ?type=AgriParcel');
        (0, monitoring_1.default)('NGSI', 'listEntities ?type=Device');
        const [getBuildings, animals, getParcels, devices] = await Promise.all([
            ngsiLD.listEntities({ type: 'Building', format: 'keyValues', pick: 'id,name', limit: ENTITY_LIMIT }, headers),
            ngsiLD.listEntities({ type: 'Animal', format: 'keyValues', pick: 'id,name,species,phenologicalCondition', limit: ENTITY_LIMIT }, headers),
            ngsiLD.listEntities({ type: 'AgriParcel', format: 'keyValues', pick: 'id,name', limit: ENTITY_LIMIT }, headers),
            ngsiLD.listEntities({ type: 'Device', format: 'keyValues', pick: 'id,name', limit: ENTITY_LIMIT }, headers)
        ]);
        const buildings = getBuildings.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        const parcels = getParcels.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        const cows = lodash_1.default.filter(animals, (o) => {
            return o.species === 'dairy cattle';
        }).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        const pigs = lodash_1.default.filter(animals, (o) => {
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
    }
    catch (e) {
        const err = e;
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
// LEVEL 1: AUTHENTICATION ONLY -  For most actions, any logged-in user is authorized.
// LEVEL 2: BASIC AUTHORIZATION -  Tractor (start/stop) and water (on/off) commands require a
//                                 supervisor role (equipment-supervisor or livestock-supervisor).
router.post('/device/command', DeviceListener.accessControl, DeviceListener.sendCommand);
// Retrieve Device History from STH-Comet
if (process.env.STH_COMET_SERVICE_URL) {
    router.get('/device/history/:deviceId', catchErrors(History.readCrateDeviceHistory));
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
router.get('/vp/monitor', function (req, res) {
    res.render('trust', { title: 'Trust Monitor' });
});
// Farm data routes secured by Keycloak PDP.
// LEVEL 1: AUTHENTICATION ONLY - Users must be logged in to view farm data.
router.get('/app/animals/locations.json', Animal.geojson);
router.get('/app/animals', Security.authenticate, Animal.displayMap);
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
// Whenever a subscription is received, display it on the monitor
// and notify any interested parties using Socket.io
router.post('/subscription/:type', (req, res) => {
    //log(req.headers)
    (0, monitoring_1.default)('notify', req.params.type + ' received', req.body);
    lodash_1.default.forEach(req.body.data, (item) => {
        broadcastEvents(req, item, NOTIFY_ATTRIBUTES);
    });
    res.status(204).send();
});
router.post('/message/:type', (req, res) => {
    global.SOCKET_IO.emit(String(req.params.type), req.body.data);
    res.status(204).send();
});
router.post('/csv/:type', upload_1.default.single('file'), catchErrors(async (req, res) => {
    await csvController.upload(req, res);
}));
exports.default = router;
