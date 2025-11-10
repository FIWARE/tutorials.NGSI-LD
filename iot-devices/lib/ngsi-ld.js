const BASE_PATH =
  process.env.CONTEXT_BROKER || 'http://localhost:1026/ngsi-ld/v1';
const JSON_LD_HEADER = 'application/ld+json';
const Context =
  process.env.IOTA_JSON_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader =
  '<' +
  Context +
  '>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json">';

async function parse(response) {
  let text = '';
  try {
    text = await response.text();
    const data = JSON.parse(text);
    return data;
  } catch (err) {
    return text;
  }
}

function setHeaders(accessToken, link, contentType) {
  const headers = {};
  if (accessToken) {
    // If the system has been secured and we have logged in,
    // add the access token to the request to the PEP Proxy
    headers['X-Auth-Token'] = accessToken;
  }
  if (link) {
    headers.Link = link;
  }
  if (contentType) {
    headers['Content-Type'] = contentType || JSON_LD_HEADER;
  }
  return headers;
}

// This is a promise to make an HTTP GET request to the
// /ngsi-ld/v1/entities/ end point
function listEntities(opts, headers = {}) {
  console.log(`${BASE_PATH}/entities/?${new URLSearchParams(opts)}`);
  return fetch(`${BASE_PATH}/entities/?${new URLSearchParams(opts)}`, {
    method: 'GET',
    headers,
  })
    .then((r) => parse(r).then((data) => ({ status: r.status, body: data })))
    .then((data) => {
      if (data.status !== 200) {
        throw new Error(data.body);
      }
      return data.body;
    });
}

exports.findNeighbour = async function (lat, lng, type, previous) {
  const headers = setHeaders(null, LinkHeader);
  try {
    const entities = await listEntities(
      {
        type,
        pick: 'id',
        limit: 2,
        geometry: 'Point',
        coordinates: `[${lat},${lng}]`,
        georel: 'near;maxDistance==8000',
      },
      headers
    );
    return entities[1].id;
  } catch (error) {
    return previous;
  }
};

exports.findTargetInField = async function (type, locatedAt) {
  const headers = setHeaders(null, LinkHeader);
  const entities = await listEntities(
    {
      type,
      pick: 'id,location',
      limit: 6,
    },
    headers
  );

  console.log(entities);
};
