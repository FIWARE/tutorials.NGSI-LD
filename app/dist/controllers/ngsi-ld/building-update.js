"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateBuildings = duplicateBuildings;
const mongoDB_building_1 = __importDefault(require("../../lib/mongoDB-building"));
const debug_1 = __importDefault(require("debug"));
const log = (0, debug_1.default)('tutorial:ngsi-ld');
// This is a promise to send data to a MongoDB database
// for each individual building.
function upsertToMongoDB(building) {
    return mongoDB_building_1.default.upsert(building.id, building.name, building.address, building.verified);
}
// Function to create address documents in a MongoDB database
// when receiving an NGSI-LD subscription.
async function duplicateBuildings(req, res) {
    log('duplicateBuildings');
    async function copyEntityData(building) {
        await upsertToMongoDB(building);
    }
    try {
        await Promise.all(req.body.data.map(copyEntityData));
    }
    catch (error) {
        log(error);
        return res.status(500).send();
    }
    return res.status(204).send();
}
