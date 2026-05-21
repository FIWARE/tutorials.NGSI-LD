import debug from 'debug';
import monitor from '../../lib/monitoring';
import * as ngsiLD from '../../lib/ngsi-ld';
import type { Request, Response } from 'express';

const log = debug('tutorial:animal');
const { LinkHeader } = ngsiLD;

const ENTITY_LIMIT = process.env.ENTITY_LIMIT || 200;

async function getAnimals(req: Request, res: Response): Promise<unknown> {
    log('getAnimals');
    try {
        const headers = ngsiLD.setHeaders(req.session.access_token, LinkHeader);
        headers.Accept = 'application/geo+json';
        monitor('NGSI', 'listEntities ?type=Animal');
        const animals = await ngsiLD.listEntities(
            {
                type: 'Animal',
                format: 'simplified',
                limit: ENTITY_LIMIT
            },
            headers
        ) as Record<string, unknown>;
        if (animals && animals.features) {
            (animals.features as Array<{ id: string; properties: Record<string, unknown> }>).forEach((animal) => {
                animal.properties.id = animal.id;
            });
            delete animals['@context'];
        }
        return res.send(animals);
    } catch (error) {
        log(error);
        return res.status(500).send();
    }
}

function displayMap(req: Request, res: Response): void {
    log('displayMap');
    res.render('animalMap', { title: 'Animal Locations' });
}

// This function receives the details of a person from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=person&options=keyValues'
//
async function displayAnimal(req: Request, res: Response): Promise<void> {
    log('displayAnimal');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + String(req.params.id));
        const animal = await ngsiLD.readEntity(
            String(req.params.id),
            { format: 'normalized' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        ) as Record<string, unknown>;

        const imgId = (animal.id as string).slice(-3);
        return res.render('animal', { title: (animal.name as { value: string }).value, animal, imgId });
    } catch (error) {
        const err = error as { cause: { title: string; detail: string } };
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

export { displayAnimal as display, displayMap, getAnimals as geojson };
