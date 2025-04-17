const request = require('request');
const debug = require('debug')('devices:emitter');
const WEB_APP_URL = 'http://' + (process.env.WEB_APP_HOST || 'localhost') + ':' + (process.env.WEB_APP_PORT || 3000);

exports.emit = function (subject, data) {
    const options = {
        method: 'POST',
        url: `${WEB_APP_URL}/message/${subject}`,
        json: { data }
    };

    request(options, (error) => {
        if (error) {
            debug(error);
            console.log(error);
        }
    });
};
