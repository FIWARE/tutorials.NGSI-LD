const StatusCodes = require('http-status-codes').StatusCodes;
const configServiceURL = process.env.CONFIG_SERVICE || 'localhost:8081';

/**
 * Check that Keyrock is responding to requests
 */
exports.checkConnectivity = function() {
  return fetch(`http://${configServiceURL}/service`);
};

exports.getConfig = function(tenant) {
  return new Promise(function(resolve, reject) {
    console.log(`http://${configServiceURL}/service/${tenant}`);
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
