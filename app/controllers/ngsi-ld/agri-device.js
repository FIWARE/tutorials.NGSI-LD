const debug = require('debug')('tutorial:device');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

async function displayAgriDevice(req, res) {
    debug('displayAgriDevice');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const device = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        );

        const controlledProperties = device.controlledProperty;
        const chartData = {};
        let timeseries = null;

        try {
            timeseries = await ngsiLD.readTemporalEntity(
                req.params.id,
                {
                    options: 'temporalValues',
                    attrs: device.controlledProperty.join(',')
                },
                ngsiLD.setHeaders(req.session.access_token, LinkHeader)
            );

            controlledProperties.forEach((key) => {
                let addData = false;

                if (Array.isArray(timeseries[key].values)) {
                    addData = timeseries[key].values[0].length === 2;
                }

                if (addData) {
                    const data = [];
                    const labels = [];
                    const color = [];

                    const values = timeseries[key].values.reverse();
                    values.forEach((element) => {
                        const date = new Date(element[1]);
                        data.push({ t: element[1], y: element[0] });
                        labels.push(date.toISOString().slice(11, 16));
                        color.push('#45d3dd');
                    });

                    chartData[key] = { data, labels, color };
                }
            });
        } catch (e) {
            debug(e);
        }
        return res.render('agri-device', { title: device.name, device, timeseries, chartData });
    } catch (error) {
        const errorDetail = error.error | error;
        debug(errorDetail);
        // If no device has been found, display an error screen
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
    display: displayAgriDevice
};
