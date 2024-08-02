/* global $ */
/* global io */
/* global moment */

$(function () {
    const socket = io();
    let waterAudio;

    async function downloadFile() {
        const response = await fetch('/js/water.txt');

        if (response.status !== 200) {
            throw new Error('Server Error');
        }
        const data = await response.text();
        waterAudio = new Audio(data);
    }

    socket.on('weather', function (msg) {
        $('#weathericon').css('background-image', "url('/img/" + msg + ".svg')");
    });

    socket.on('barn', function (msg) {
        $('#barnicon').attr('src', `/img/${msg}.svg`);
        $('#barntext').val(msg === 'door-locked' ? 'Open' : 'Shut');
    });

    // eslint-disable-next-line no-unused-vars
    $('span').each(function (index, value) {
        const device = $(this).attr('id');
        socket.on(device, function (msg) {
            $('#' + device).text(msg);
            let measure;
            const li = $('#' + device)
                .parent()
                .parent();
            switch (device.replace(/\d/g, '')) {
                case 'humidity':
                    measure = parseInt(msg.replace(/[^(\d.)]/g, ''));
                    if (measure > 60) {
                        li.css('background-image', "url('/img/soil-humidity-high.svg')");
                    } else if (measure > 50) {
                        li.css('background-image', "url('/img/soil-humidity.svg')");
                    } else if (measure > 35) {
                        li.css('background-image', "url('/img/soil-humidity-low.svg')");
                    } else {
                        li.css('background-image', "url('/img/soil-humidity-none.svg')");
                    }
                    break;

                case 'water':
                    if (msg === 's|ON') {
                        li.css('background-image', "url('/img/water-on.svg')");
                        $('#' + device).data('running', true);
                    } else {
                        li.css('background-image', "url('/img/water-off.svg')");
                        $('#' + device).data('running', false);
                    }

                    if (waterAudio) {
                        if (
                            $('#water001').data('running') ||
                            $('#water002').data('running') ||
                            $('#water003').data('running') ||
                            $('#water004').data('running')
                        ) {
                            if (waterAudio.paused) {
                                waterAudio.play();
                            }
                        } else {
                            waterAudio.pause();
                        }
                    }

                    break;
                case 'tractor':
                    if (msg.startsWith('d|MOVING')) {
                        li.css('background-image', "url('/img/tractor-moving.svg')");
                    } else if (msg.startsWith('d|SOWING')) {
                        li.css('background-image', "url('/img/tractor-sowing.svg')");
                    } else {
                        li.css('background-image', "url('/img/tractor-idle.svg')");
                    }
                    break;

                case 'temperature':
                    measure = parseFloat(msg.replace(/[^(\d.)]/g, ''));
                    if (measure > 28) {
                        li.css('background-image', "url('/img/temperature-high.svg')");
                    } else if (measure < 23) {
                        li.css('background-image', "url('/img/temperature-low.svg')");
                    } else {
                        li.css('background-image', "url('/img/temperature.svg')");
                    }

                    break;

                case 'filling':
                    measure = Math.round(parseFloat(msg.replace(/[^(\d.)]/g, '')) * 10);
                    if (measure >= 10) {
                        li.css('background-image', "url('/img/warehouse-full.svg')");
                    } else if (measure === 0) {
                        li.css('background-image', "url('/img/warehouse-empty.svg')");
                    } else {
                        li.css('background-image', "url('/img/warehouse-" + measure + ".svg')");
                    }
                    break;

                case 'lamp':
                    if (msg.includes('s|ON')) {
                        li.css('background-image', "url('/img/lamp-on.svg')");
                    } else {
                        li.css('background-image', "url('/img/lamp-off.svg')");
                    }
                    break;
            }
        });
    });

    socket.on('http', function (msg) {
        // If we receive a northbound notification, list it on screen
        const htmlString = '<li>' + moment().format('LTS') + ' <b>HTTP</b> <code>' + msg + '</code>';
        $('#northbound').append(htmlString);
        if ($('#northbound li').size() > 5) {
            $('#northbound li').first().remove();
        }
    });

    socket.on('mqtt', function (msg) {
        moment().format('LTS');
        // If we receive a northbound notification, list it on screen
        const htmlString = '<li>' + moment().format('LTS') + ' <b>MQTT</b> <code>' + msg + '</code>';
        $('#northbound').append(htmlString);
        if ($('#northbound li').size() > 5) {
            $('#northbound li').first().remove();
        }
    });

    $('body').click(async function () {
        $('#audio').text('Audio ON');
        await downloadFile();
    });

    $('form.device').submit(function (event) {
        event.preventDefault();
        const serializedData = $(this).serialize();
        $.ajax({
            url: '/device/command',
            type: 'post',
            data: serializedData,
            // eslint-disable-next-line no-unused-vars
            error(xhr, ajaxOptions, thrownError) {
                // eslint-disable-next-line no-alert
                alert(thrownError);
            }
        });
    });
});
