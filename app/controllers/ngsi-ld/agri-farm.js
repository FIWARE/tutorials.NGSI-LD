const debug = require('debug')('tutorial:farm');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const { LinkHeader } = ngsiLD;

async function displayAgriFarm(req, res) {
    debug('displayAgriFarm');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const farm = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        );
        return res.render('agri-farm', { title: farm.name, farm });
    } catch (error) {
        const errorDetail = error.cause || error;
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
