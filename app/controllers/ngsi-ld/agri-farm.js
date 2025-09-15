const debug = require('debug')('tutorial:farm');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

async function displayAgriFarm(req, res) {
    debug('displayAgriFarm');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        //req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const farm = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(null, LinkHeader)
        );
        return res.render('agri-farm', { title: farm.name, farm });
    } catch (error) {
        const errorDetail = error.error || error;
        debug(errorDetail);
        // If no farm has been found, display an error screen
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
    display: displayAgriFarm
};
