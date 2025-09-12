const debug = require('debug')('tutorial:soil');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';
const _ = require('lodash');


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

        const timeseries = await ngsiLD.readTemporalEntity(
            req.params.id,
            { options: 'temporalValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        );
        const data = [];
        const labels = [];
        const color = [];



        _.forEach(timeseries.price.values.reverse(), (element) => {
            const date = new Date(element[1]);
            data.push({ t: element[1], y: element[0] });
            labels.push(date.toISOString().slice(0, 10)) ;
            color.push('#45d3dd');
        });

        const chartData = {data, labels, color}
       
    

        return res.render('soil', { title: soil.name, soil , timeseries,  chartData});
    } catch (error) {
        const errorDetail = error.error;
        debug(errorDetail);
            console.log(error)
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
