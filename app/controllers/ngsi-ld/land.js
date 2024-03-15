const debug = require('debug')('tutorial:ngsi-ld');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

// This function receives the details of a person from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=person&options=keyValues'
//
async function displayLands(req, res) {
    debug('displayLands');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'listEntities ' + req.params.id);
        const lands = await ngsiLD.listEntities(
            {
                type: 'Agriparcel',
                options: 'concise'
            },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        );
        debug(lands);
        return res.render('lands', { title: 'Fields', lands });
    } catch (error) {
        const errorDetail = error.error;
        debug(error);
        // If no animal has been found, display an error screen
        return res.render(
            'error',
            errorDetail
                ? {
                      title: `Error: ${errorDetail.title}`,
                      message: errorDetail.detail,
                      error: {
                          stack: errorDetail.title
                      }
                  }
                : { title: 'Error', error }
        );
    }
}

module.exports = {
    display: displayLands
};
