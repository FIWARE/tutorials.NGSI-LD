/* global $ */

$('#claim').change(function () {
    const selected = $('#claim').find(':selected');

    $('#claim-by').text(selected.data('by'));
    $('#issuer').text(selected.data('issuer'));
    $('#claim-for').text(selected.data('for'));
    $('#subject').text(selected.data('subject'));

    $('#iss').val(selected.data('issuer'));
    $('#sub').val(selected.data('subject'));
    $('#claim-type').val(selected.data('type'));

    getClaim(selected.data('claim'));
});

$('#presentation-issuer').change(function () {
    const selected = $('#presentation-issuer').find(':selected');
    $('#wallet-holder').text(selected.data('issuer'));
    $('#presented-by').text(selected.val());
    $('#presentationIssuer').val(selected.data('issuer'));
});

$('#datepicker').change(function () {
    const date = Date.parse(this.value);
    const unixtime = Math.floor(date / 1000);
    $('#not-before').text(unixtime);
    $('#nbf').val(unixtime);
});

function getClaim(claim) {
    // Make a GET request
    fetch(claim)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            return response.json();
        })
        .then((data) => {
            $('#payload').text(JSON.stringify(data, null, 2));
            $('#vc').val(JSON.stringify(data));
        })
        .catch((error) => {
            console.log('Error:', error);
        });
}

$('form.credential').submit(function (event) {
    event.preventDefault();
    if ($('#vc').val() !== '') {
        const serializedData = $(this).serialize();
        $.ajax({
            url: '/vc/generate',
            type: 'post',
            data: serializedData,
            error(xhr) {
                // eslint-disable-next-line no-alert
                alert(xhr.responseText);
            }
        }).then(function (response) {
            const json = response;
            $('#credential').text(json.jwt);
            $('#vcType').val(`Add ${json.type} VC to presentation`);
        });
    }
});

$('form.addJWT').submit(function (event) {
    event.preventDefault();
    let payload = $('#presentationPayload').val();
    if (payload === '') {
        payload = {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiablePresentation'],
            verifiableCredential: []
        };
    } else {
        payload = JSON.parse(payload);
    }
    const credential = $('#credential').text();
    if (credential !== '') {
        payload.verifiableCredential.push($('#credential').text());
    }
    $('#presentationPayload').val(JSON.stringify(payload));
    $('#presentation').text(JSON.stringify(payload, null, 2));
});

$('form.presentation').submit(function (event) {
    event.preventDefault();
    if ($('#presentationPayload').val() !== '') {
        const serializedData = $(this).serialize();
        $.ajax({
            url: '/vp/generate',
            type: 'post',
            data: serializedData,
            error(xhr) {
                // eslint-disable-next-line no-alert
                alert(xhr.responseText);
            }
        }).then(function (response) {
            const json = response;
            console.log(json);
            $('#presentationJWT').text(json.jwt);
            $('#encodedPresentation').val(json.jwt);
        });
    }
});

$('form.verify').submit(function (event) {
    event.preventDefault();
    if ($('#encodedPresentation').val() !== '') {
        const serializedData = $(this).serialize();
        $.ajax({
            url: '/vp/verify',
            type: 'post',
            data: serializedData,
            error(xhr) {
                // eslint-disable-next-line no-alert
                alert(xhr.responseText);
            }
        }).then(function (response) {
            $('#decodedPresentation').text(JSON.stringify(response, null, 2));
        });
    }
});
