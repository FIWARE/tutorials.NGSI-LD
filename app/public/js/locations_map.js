function addSource(name, source) {
    map.addSource(name, {
        type: 'geojson',
        data: source,
        cluster: false
    });
}

const isCow = ['==', ['get', 'species'], 'dairy cattle'];
const isPig = ['==', ['get', 'species'], 'pig'];

function addLayer(source) {
    if (map.getLayer('points')) {
        map.removeLayer('points');
    }
    map.addLayer({
        id: 'points',
        type: 'symbol',
        source,
        layout: {
            'icon-image': ['case', isCow, 'cow', isPig, 'pig', 'none'],
            'icon-size': 0.15,
            'icon-overlap': 'always'
        },
        paint: {}
    });
}

let popups = null;
const icons = {
    cow: '/img/cow.svg',
    pig: '/img/pig.svg',
    none: '/img/none.svg'
};

function initMap() {
    map.setCenter([13.404954, 52.520008]);
    map.addControl(new maplibregl.NavigationControl());
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    map.on('mouseenter', 'points', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'points', () => {
        map.getCanvas().style.cursor = '';
    });

    map.on('click', 'points', (e) => {
        const feature = e.features[0];
        const location = feature.geometry.coordinates;

        //const content = html.join("");
        const content = `<h3>${feature.properties.name}</h3>
    <a href="/app/animal/${feature.properties.id}">${feature.properties.id}</a>`;
        map.flyTo({
            center: [location[0], location[1]],
            padding: { top: 100, bottom: 10, left: 25, right: 25 }
        });

        if (popups) {
            popups.remove();
        }
        if (feature.properties.species){
            popups = new maplibregl.Popup()
                .setHTML(`<div class="popup-info"> ${content}</div>`)
                .setLngLat(feature.geometry.coordinates);

            popups.addTo(map);
        }
    });

    map.on('load', function () {
        map.resize();
    });

    map.once('load', () => {
        /* Add sources */
        for (const [key, value] of Object.entries(icons)) {
            const image = new Image();
            image.src = value;
            image.width = 150;
            image.height = 150;
            image.onload = () => {
                map.addImage(key, image);
            };
        }
        setTimeout(async () => {
            addSource('locations', './animals/locations.json');
            addLayer('locations');

            map.fitBounds([
                [13.304, 52.52],
                [13.404, 52.5204]
            ]);
        }, '1000');

        setTimeout(async () => {
            map.addControl(
                new maplibregl.ScaleControl({
                    maxWidth: 80,
                    unit: 'metric'
                })
            );
        }, '4500');
    });
}

const map = new maplibregl.Map({
    container: 'map', // container id
    style: 'https://api.maptiler.com/maps/streets-v2/style.json?key=foqzh86Jk2Ia9CL7w8ks', // style URL
    center: [52.52, 13.404], // starting position [lng, lat]
    zoom: 12, // starting zoom
    maplibreLogo: true,
    attributionControl: false,
    dragRotate: false
});

initMap();
