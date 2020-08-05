const debug = require('debug')('tutorial:ngsi-ld');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');

debug('Context Data is retrieved using NGSI-LD');

const Context = 'http://context:3000/data-models/ngsi-context.jsonld';

const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

// This function receives the details of a person from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=person&options=keyValues'
//
async function displayPerson(req, res) {
    debug('displayPerson');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const person = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        );
        return res.render('person', { title: person.name, person });
    } catch (error) {
        debug(error);
        // If no person has been found, display an error screen
        return res.render('error', {
            title: 'Error',
            error
        });
    }
}

module.exports = {
    display: displayPerson
};
