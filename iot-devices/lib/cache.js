const debug = require('debug')('devices:cache');

const redis = require('redis');
const keys = [];
let client;

const REDIS_URL =
  'redis://' +
  (process.env.REDIS_HOST || 'localhost') +
  ':' +
  (process.env.REDIS_PORT || 6379);

exports.init = async function () {
  client = await redis
    .createClient({
      url: REDIS_URL,
    })
    .on('error', (err) => debug('Redis Client Error', err))
    .connect();
};

exports.get = async function (key) {
  const value = await client.get(key);
  return value;
};

exports.set = async function (key, value) {
  if (keys.includes(key) === false) {
    keys.push(key);
  }
  return await client.set(key, value);
};

exports.setCacheValues = function (data) {
  Object.keys(data).forEach(async (key) => {
    if (keys.includes(key) === false) {
      keys.push(key);
    }
    await client.set(key, data[key]);
  });
};

exports.keys = function () {
  return keys;
};

exports.exists = function (key) {
  return client.exists(key, (err, reply) => {
    if (err) {
      debug(err);
      return false;
    } else {
      return reply === 1;
    }
  });
};
