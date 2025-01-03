const request = require('request');
const debug = require('debug')('devices:emitter');
const port = process.env.WEB_APP_PORT || '3000';
const RECEIVER = process.env.WEB_APP || `http://localhost:${port}`;
	
exports.emit = function (subject, data){
	const options = {
        method: 'POST',
        url: `${RECEIVER}/message/${subject}`,
        json: {data}
    };

    request(options, (error) => {
        if (error) {
            debug(error);
            console.log(error)
        }
    });

}