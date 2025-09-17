const debug = require('debug')('tutorial:pest');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const Context_EN = Context.replace('.jsonld', '-en.jsonld')
const Context_FR = Context.replace('.jsonld', '-fr.jsonld')

const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';
const LinkHeader_EN = '<' + Context_EN + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';
const LinkHeader_FR = '<' + Context_FR + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';



async function displayPest(req, res) {
    debug('displayPest');

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
 
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        //req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const pest = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(null, UseLinkHeader)
        );
        return res.render('pest', { title: pest.name || pest.nom, pest });
    } catch (error) {
        debug(error);
        // If no pest has been found, display an error screen
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
    display: displayPest
};
