const debug = require('debug')('tutorial:device');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

async function displayStockAdvice(req, res) {
    debug('displayStockAdvice');

    const text = req.body.text.toLowerCase();

    try {
        monitor('NGSI', `listEntities ?type=City&${req.body.lat},${req.body.lng}`);
        const cities = await ngsiLD.listEntities(
            {
                type: 'City',
                format: 'simplified',
                geometry: 'Point',
                coordinates: `[${req.body.lng},${req.body.lat}]`,
                georel: 'near;maxDistance==100000',
                local: true
            },
            ngsiLD.setHeaders(null, LinkHeader)
        );

        const ids = [];
        cities.forEach((city) => {
            ids.push(city.id);
        });

        const cities2 =
            (await ngsiLD.listEntities(
                {
                    type: 'City',
                    format: 'simplified',
                    id: ids.join(',')
                },
                ngsiLD.setHeaders(null, LinkHeader)
            )) || null;

        if (cities2 === null) {
            return res.render('agri-device', { title: `Prices for "${text}"`, stocks: [] });
        }

        const stockIds = [];
        cities2.forEach((city) => {
            city.hasStockPrice.forEach((stock) => {
                if (stock.includes(text)) {
                    stockIds.push(stock);
                }
            });
        });

        const stocks = await ngsiLD.listEntities(
            {
                type: 'StockPrice',
                format: 'simplified',
                id: stockIds.join(',')
            },
            ngsiLD.setHeaders(null, LinkHeader)
        );

        console.log(stocks);

        return res.render('agri-device', { title: `Prices for "${text}"`, stocks });
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
    display: displayStockAdvice
};
