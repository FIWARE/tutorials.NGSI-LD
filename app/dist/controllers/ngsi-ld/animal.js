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
exports.display = displayAnimal;
exports.displayMap = displayMap;
exports.geojson = getAnimals;
const debug_1 = __importDefault(require("debug"));
const monitoring_1 = __importDefault(require("../../lib/monitoring"));
const ngsiLD = __importStar(require("../../lib/ngsi-ld"));
const log = (0, debug_1.default)('tutorial:animal');
const { LinkHeader } = ngsiLD;
const ENTITY_LIMIT = process.env.ENTITY_LIMIT || 200;
async function getAnimals(req, res) {
    log('getAnimals');
    try {
        const headers = ngsiLD.setHeaders(req.session.access_token, LinkHeader);
        headers.Accept = 'application/geo+json';
        (0, monitoring_1.default)('NGSI', 'listEntities ?type=Animal');
        const animals = await ngsiLD.listEntities({
            type: 'Animal',
            format: 'simplified',
            limit: ENTITY_LIMIT
        }, headers);
        if (animals && animals.features) {
            animals.features.forEach((animal) => {
                animal.properties.id = animal.id;
            });
            delete animals['@context'];
        }
        return res.send(animals);
    }
    catch (error) {
        log(error);
        return res.status(500).send();
    }
}
function displayMap(req, res) {
    log('displayMap');
    res.render('animalMap', { title: 'Animal Locations' });
}
// This function receives the details of a person from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=person&options=keyValues'
//
async function displayAnimal(req, res) {
    log('displayAnimal');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        (0, monitoring_1.default)('NGSI', 'readEntity ' + String(req.params.id));
        const animal = await ngsiLD.readEntity(String(req.params.id), { format: 'normalized' }, ngsiLD.setHeaders(req.session.access_token, LinkHeader));
        let imgId = animal.id.substring(animal.id.length - 3);
        if (Number(imgId) < 100) {
            imgId = `00${Number(imgId) % 10}`;
        }
        return res.render('animal', { title: animal.name.value, animal, imgId });
    }
    catch (error) {
        const err = error;
        // If no animal has been found, display an error screen
        return res.render('error', {
            title: `Error: ${err.cause.title}`,
            message: err.cause.detail,
            error: {
                stack: err.cause.title
            }
        });
    }
}
