const debug = require('debug')('tutorial:animal');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

const ENTITY_LIMIT = process.env.ENTITY_LIMIT || 200;

async function getAnimals(req, res) {
    debug('getAnimals');

    const headers = ngsiLD.setHeaders(req.session.access_token, LinkHeader);
    headers.Accept = 'application/geo+json';
    monitor('NGSI', 'listEntities ?type=Animal');
    const animals = await ngsiLD.listEntities(
        {
            type: 'Animal',
            options: 'concise',
            limit: ENTITY_LIMIT
        },
        headers
    );

    animals.features.forEach((animal) => {
        animal.properties.id = animal.id;
    });

    delete animals['@context'];
    return res.send(animals);
}

function displayMap(req, res) {
    debug('displayMap');
    return res.render('animalMap', {title: 'Animal Locations'});
}

// This function receives the details of a person from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=person&options=keyValues'
//
async function displayAnimal(req, res) {
    debug('displayAnimal');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        //req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const animal = await ngsiLD.readEntity(
            req.params.id,
            { options: 'concise' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        );

        let imgId = animal.id.substring(animal.id.length - 3);

        if (imgId < 100) {
            imgId = `00${imgId % 10}`;
        }
        return res.render('animal', { title: animal.name, animal, imgId });
    } catch (error) {
        // If no animal has been found, display an error screen
        return res.render('error', {
            title: `Error: ${error.cause.title}`,
            message: error.cause.detail,
            error: {
                stack: error.cause.title
            }
        });
    }
}

module.exports = {
    display: displayAnimal,
    displayMap,
    geojson: getAnimals
};
