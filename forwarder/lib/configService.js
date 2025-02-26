const StatusCodes = require('http-status-codes').StatusCodes;
const configServiceURL = process.env.CONFIG_SERVICE || 'localhost:8081';
const debug = require('debug')('broker:config');

/**
 * Check that Keyrock is responding to requests
 */
exports.checkConnectivity = function() {
  debug( `Connecting to Configuration Service at http://${configServiceURL}/service`);
  return fetch(`http://${configServiceURL}/service`);
};

exports.getConfig = function(tenant) {
  return new Promise(function(resolve, reject) {
    debug(
      `Retrieving config from http://${configServiceURL}/service/${tenant}`
    );
    const fetchPromise = fetch(`http://${configServiceURL}/service/${tenant}`);
    fetchPromise
      .then(response => {
        if (response.status === StatusCodes.NOT_FOUND) {
          resolve({});
        }
        return response.json();
      })
      .then(config => {
        resolve(config.oidcScopes[config.defaultOidcScope]);
      })
      .catch(error => {
        return reject(error);
      });
  });
};
