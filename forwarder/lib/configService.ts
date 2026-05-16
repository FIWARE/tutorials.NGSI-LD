import { StatusCodes } from 'http-status-codes';
import debug from 'debug';

const log = debug('broker:config');
const configServiceURL = process.env.CONFIG_SERVICE || 'localhost:8081';

interface OidcConfig {
  oidcScopes: Record<string, unknown>;
  defaultOidcScope: string;
}

export function checkConnectivity(): Promise<Response> {
  log(
    `Connecting to Configuration Service at http://${configServiceURL}/service`,
  );
  return fetch(`http://${configServiceURL}/service`);
}

export async function getConfig(tenant: string | undefined): Promise<unknown> {
  log(`Retrieving config from http://${configServiceURL}/service/${tenant}`);
  const response = await fetch(`http://${configServiceURL}/service/${tenant}`);
  if (response.status === StatusCodes.NOT_FOUND) {
    return {};
  }
  const config = (await response.json()) as OidcConfig;
  return config.oidcScopes[config.defaultOidcScope];
}
