import mongoDB from '../../lib/mongoDB-building';
import debug from 'debug';
import type { Request, Response } from 'express';

const log = debug('tutorial:ngsi-ld');

interface BuildingData {
    id: string;
    name: string;
    address: object;
    verified: boolean;
}

// This is a promise to send data to a MongoDB database
// for each individual building.
function upsertToMongoDB(building: BuildingData): ReturnType<typeof mongoDB.upsert> {
    return mongoDB.upsert(building.id, building.name, building.address, building.verified);
}

// Function to create address documents in a MongoDB database
// when receiving an NGSI-LD subscription.
async function duplicateBuildings(req: Request, res: Response): Promise<unknown> {
    log('duplicateBuildings');
    async function copyEntityData(building: BuildingData): Promise<void> {
        await upsertToMongoDB(building);
    }
    try {
        await Promise.all((req.body as { data: BuildingData[] }).data.map(copyEntityData));
    } catch (error) {
        log(error);
        return res.status(500).send();
    }
    return res.status(204).send();
}

export { duplicateBuildings };
