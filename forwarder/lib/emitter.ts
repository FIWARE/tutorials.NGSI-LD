import debug from 'debug';

const log = debug('broker:emitter');
const WEB_APP_URL = `http://${process.env.WEB_APP_HOST || 'localhost'}:${
  process.env.WEB_APP_PORT || 3000
}`;

export function emit(subject: string, data: unknown): Promise<Response | void> {
  return fetch(`${WEB_APP_URL}/message/${subject}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  }).catch((e: Error) => {
    log(e);
  });
}
