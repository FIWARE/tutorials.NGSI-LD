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
async function displayAnimal(req, res) {
    debug('displayAnimal');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
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

        console.log(imgId);
        //animal.img=)

        return res.render('animal', { title: animal.name, animal, imgId });
    } catch (error) {
        const errorDetail = error.error;
        debug(errorDetail);
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
                : {}
        );
    }
}

module.exports = {
    display: displayAnimal
};
