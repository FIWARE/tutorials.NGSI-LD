/* global maplibregl */
const lat = document.getElementById('lat');
const lng = document.getElementById('lng');

function initMap() {
    map.setCenter([-5.274167, 6.816111]);
    map.addControl(new maplibregl.NavigationControl());
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on('load', function () {
        map.resize();
    });

    map.once('load', () => {
        setTimeout(() => {
            map.addControl(
                new maplibregl.ScaleControl({
                    maxWidth: 80,
                    unit: 'metric'
                })
            );
        }, '4500');

        const marker = new maplibregl.Marker({ draggable: true }).setLngLat([-5.274167, 6.816111]).addTo(map);

        function onDragEnd() {
            const lngLat = marker.getLngLat();
            lng.value = `${lngLat.lng}`;
            lat.value = `${lngLat.lat}`;
        }

        marker.on('dragend', onDragEnd);
    });
}

const map = new maplibregl.Map({
    container: 'map', // container id
    style: 'https://api.maptiler.com/maps/streets-v2/style.json?key=foqzh86Jk2Ia9CL7w8ks', // style URL
    center: [-5.274167, 6.816111], // starting position [lng, lat]
    zoom: 6, // starting zoom
    maplibreLogo: true,
    attributionControl: false,
    dragRotate: false
});

initMap();
