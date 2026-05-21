const mongoDB = require('../../lib/mongoDB-building');
const debug = require('debug')('tutorial:ngsi-ld');

// This is a promise to send data to a MongoDB database
// for each individual building.
function upsertToMongoDB(building) {
    return mongoDB.upsert(building.id, building.name, building.address, building.verified);
}

// Function to create address documents in a MongoDB database
// when receiving an NGSI-LD subscription.
async function duplicateBuildings(req, res) {
    debug('duplicateBuildings');
    async function copyEntityData(building) {
        await upsertToMongoDB(building);
    }
    try {
        await Promise.all(req.body.data.map(copyEntityData));
    } catch (error) {
        debug(error);
        return res.status(500).send();
    }
    res.status(204).send();
}

module.exports = {
    duplicateBuildings
};
