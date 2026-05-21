const debug = require('debug')('tutorial:soil');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const { LinkHeader } = ngsiLD;

async function displaySoil(req, res) {
    debug('displaySoil');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const soil = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        );
        return res.render('soil', { title: soil.name, soil });
    } catch (error) {
        const errorDetail = error.cause;
        debug(errorDetail);
        // If no soil has been found, display an error screen
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
    display: displaySoil
};
