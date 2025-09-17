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
        //req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const soil = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(null, LinkHeader)
        );
        let timeseries = {};
        let chartData = {};
        try {
            const timeseries = await ngsiLD.readTemporalEntity(
                req.params.id,
                { options: 'temporalValues' },
                ngsiLD.setHeaders(null, LinkHeader)
            );
            const data = [];
            const labels = [];
            const color = [];

            if (timeseries.price.values) {
                _.forEach(timeseries.price.values.reverse(), (element) => {
                    const date = new Date(element[1]);
                    data.push({ t: element[1], y: element[0] });
                    labels.push(date.toISOString().slice(0, 10));
                    color.push('#198754');
                });
            }

            chartData = { data, labels, color };
        } catch (e) {
            /// Nowt
        }

        return res.render('soil', { title: soil.name, soil, timeseries, chartData });
    } catch (error) {
        const errorDetail = error.error || error;
        debug(errorDetail);
        // If no soil has been found, display an error screen
        return res.render('error', {
            title: `Error: ${errorDetail.title || 'Not Found'}`,
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
