//
// This controller is an example of accessing and amending the Context Data
// programmatically. The code uses a nodejs library to envelop all the
// necessary HTTP calls and responds with success or failure.
//

const debug = require('debug')('tutorial:farm');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const Context_EN = Context.replace('.jsonld', '-en.jsonld')
const Context_FR = Context.replace('.jsonld', '-fr.jsonld')
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';
const LinkHeader_EN = '<' + Context_EN + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';
const LinkHeader_FR = '<' + Context_FR + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

// This function receives the details of a building from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=Building&options=keyValues'
//
async function displayFarm(req, res) {
    debug('displayFarm');
    // If the user is not authorized, display the main page.

    let UseLinkHeader = LinkHeader;

    if (req.query.lang === 'en'){
        UseLinkHeader = LinkHeader_EN;
    }
    if (req.query.lang === 'fr'){
        UseLinkHeader = LinkHeader_FR;
    }
    if (req.query.lang === 'none'){
        UseLinkHeader = null;
    }

    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const building = await ngsiLD.readEntity(
            req.params.id,
            { options: 'normalized', local: req.query.local },
            ngsiLD.setHeaders(null, UseLinkHeader)
        );
        const title = building.name ? building.name.value : building.nom.value;
        return res.render('building', { title, building });
    } catch (error) {
        // If no farm has been found, display an error screen
        console.log(error);
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
    display: displayFarm
};
