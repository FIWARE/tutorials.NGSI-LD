//
// This controller is an example of accessing and amending the Context Data
// programmatically. The code uses a nodejs library to envelop all the
// necessary HTTP calls and responds with success or failure.
//

const debug = require('debug')('tutorial:ngsi-ld');
const monitor = require('../../lib/monitoring');
const ngsiLD = require('../../lib/ngsi-ld');
const _ = require('lodash');
const Port = process.env.WEB_APP_PORT || '3000';
const Context = process.env.IOTA_JSON_LD_CONTEXT || 'http://context:' + Port + '/data-models/ngsi-context.jsonld';
const LinkHeader = '<' + Context + '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

function mapTileUrl(zoom, location) {
    const tilesPerRow = Math.pow(2, zoom);
    let longitude = location.coordinates[0];
    let latitude = location.coordinates[1];

    longitude /= 360;
    longitude += 0.5;
    latitude = 0.5 - Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) / Math.PI / 2.0;

    return (
        'https://a.tile.openstreetmap.org/' +
        zoom +
        '/' +
        Math.floor(longitude * tilesPerRow) +
        '/' +
        Math.floor(latitude * tilesPerRow) +
        '.png'
    );
}

// This function receives the details of a building from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=Building&options=keyValues'
//
async function displayFarm(req, res) {
    debug('displayFarm');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + req.params.id);
        const building = await ngsiLD.readEntity(
            req.params.id,
            { options: 'keyValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        );
        // If a building has been found display it on screen
        building.mapUrl = mapTileUrl(15, building.location);
        return res.render('building', { title: building.name, building });
    } catch (error) {
        debug(error);
        // If no building has been found, display an error screen
        return res.render('error', {
            title: 'Error',
            error
        });
    }
}

// This function receives all products and a set of inventory items
//  from the context
//
// It is effectively processing the following cUrl commands:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=Product&options=keyValues'
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=InventoryItem&options=keyValues&q=refbuilding==<entity-id>'
//
async function displayTillInfo(req, res) {
    debug('displayTillInfo');
    try {
        const stockedProducts = [];
        const inventory = [];
        const headers = ngsiLD.setHeaders(req.session.access_token, LinkHeader);

        monitor('NGSI', 'readEntity type=Building id=' + req.params.id);
        const building = await ngsiLD.readEntity(
            req.params.id,
            {
                type: 'Building',
                options: 'keyValues',
                attrs: 'furniture'
            },
            headers
        );

        const furniture = Array.isArray(building.furniture) ? building.furniture : [building.furniture];

        monitor('NGSI', 'listEntities type=Shelf id=' + furniture.join(','));
        let productsList = await ngsiLD.listEntities(
            {
                type: 'Shelf',
                options: 'keyValues',
                attrs: 'stocks,numberOfItems',
                id: furniture.join(',')
            },
            headers
        );

        productsList = Array.isArray(productsList) ? productsList : [productsList];
        productsList = _.groupBy(productsList, (e) => {
            return e.stocks;
        });

        _.forEach(productsList, (value, key) => {
            stockedProducts.push(key);
            inventory.push({
                refProduct: key,
                shelfCount: _.reduce(
                    value,
                    function (sum, shelf) {
                        return sum + shelf.numberOfItems;
                    },
                    0
                )
            });
        });

        monitor('NGSI', 'listEntities type=Product id=' + stockedProducts.join(','));
        let productsInbuilding = await ngsiLD.listEntities(
            {
                type: 'Product',
                options: 'keyValues',
                attrs: 'name,price',
                id: stockedProducts.join(',')
            },
            headers
        );

        productsInbuilding = Array.isArray(productsInbuilding) ? productsInbuilding : [productsInbuilding];
        productsInbuilding = _.mapValues(productsInbuilding, (e) => {
            e.price = e.price * 100;
            return e;
        });

        return res.render('till', {
            products: productsInbuilding,
            inventory,
            ngsiLd: true,
            id: req.params.id
        });
    } catch (error) {
        debug(error);
        // An error occurred, return with no results
        return res.render('till', {
            products: {},
            inventory: {},
            ngsiLd: true,
            id: req.params.id
        });
    }
}

// This asynchronous function retrieves and updates an inventory item from the context
//
async function buyItem(req, res) {
    debug('buyItem');
    monitor('NGSI', 'listEntities ' + req.body.productId);

    const headers = ngsiLD.setHeaders(req.session.access_token, LinkHeader);
    const shelf = await ngsiLD.listEntities(
        {
            type: 'Shelf',
            options: 'keyValues',
            attrs: 'stocks,numberOfItems',
            q: 'numberOfItems>0;locatedIn=="' + req.body.id + '";stocks=="' + req.body.productId + '"',
            limit: 1
        },
        headers
    );

    const count = shelf[0].numberOfItems - 1;

    monitor('NGSI', 'updateAttribute ' + shelf[0].id, {
        numberOfItems: { type: 'Property', value: count }
    });
    await ngsiLD.updateAttribute(shelf[0].id, { numberOfItems: { type: 'Property', value: count } }, headers);
    res.redirect(`/app/building/${req.body.id}/till`);
}

// This function renders information for the warehouse of a building
// It is used to display alerts based on any low stock subscriptions received
//
function displayWarehouseInfo(req, res) {
    debug('displayWarehouseInfo');
    res.render('warehouse', { id: req.params.id });
}

function priceChange(req, res) {
    debug('priceChange');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    // Render the price page (Managers only)
    return res.render('price-change', { title: 'Price Change' });
}

function orderStock(req, res) {
    debug('orderStock');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    // Render the stock taking page (Managers only)
    return res.render('order-stock', { title: 'Order Stock' });
}

module.exports = {
    buyItem,
    display: displayFarm,
    displayTillInfo,
    displayWarehouseInfo,
    priceChange,
    orderStock
};
