const debug = require('debug')('tutorial:ngsi-ld');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

async function displayLand(req, res) {
    debug('displayLand');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const land = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        );
        return res.render('land', { title: land.name, land });
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
    display: displayLand
};
