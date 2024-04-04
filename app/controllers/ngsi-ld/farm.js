//
// This controller is an example of accessing and amending the Context Data
// programmatically. The code uses a nodejs library to envelop all the
// necessary HTTP calls and responds with success or failure.
//

const debug = require('debug')('tutorial:ngsi-ld');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

function mapTileUrl(zoom, location) {
    const tilesPerRow = Math.pow(2, zoom);
    let longitude = location.coordinates[0];
    let latitude = location.coordinates[1];

    longitude /= 360;
    longitude += 0.5;
    latitude = 0.5 - Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) / Math.PI / 2.0;

    return (
        'https://a.tile.openstreetmap.org/' +
        zoom +
        '/' +
        Math.floor(longitude * tilesPerRow) +
        '/' +
        Math.floor(latitude * tilesPerRow) +
        '.png'
    );
}

// This function receives the details of a building from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=Building&options=keyValues'
//
async function displayFarm(req, res) {
    debug('displayFarm');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const building = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        );
        // If a building has been found display it on screen
        building.mapUrl = mapTileUrl(15, building.location);
        return res.render('building', { title: building.name, building });
    } catch (error) {
        const errorDetail = error.error;
        debug(errorDetail);
        // If no animal has been found, display an error screen
        return res.render('error', {
            title: `Error: ${errorDetail.title}`,
            message: errorDetail.detail,
            error: {
                stack: errorDetail.title
            }
        });
    }
}

module.exports = {
    display: displayFarm
};
