const debug = require('debug')('tutorial:device');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

async function displayAgriDevice(req, res) {
    debug('displayAgriDevice');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        //req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const device = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(null, LinkHeader)
        );
        return res.render('agri-device', { title: device.name, device });
    } catch (error) {
        const errorDetail = error.error | error | {};
        debug(error);
        // If no device has been found, display an error screen
        return res.render('error', {
            title: '',
            message: '',
            error
        });
    }
}

module.exports = {
    display: displayAgriDevice
};
