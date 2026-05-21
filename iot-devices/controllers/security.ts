import { OAuth2 } from '../lib/oauth2';

const keyrockPort = process.env.KEYROCK_PORT || '3005';
const keyrockUrl = `${process.env.KEYROCK_URL || 'http://localhost'}:${keyrockPort}`;
const keyrockIPAddress = `${process.env.KEYROCK_IP_ADDRESS || 'http://127.0.0.1'}:${keyrockPort}`;
const clientId = process.env.KEYROCK_CLIENT_ID || 'tutorial-dckr-site-0000-xpresswebapp';
const clientSecret = process.env.KEYROCK_CLIENT_SECRET || 'tutorial-dkcr-site-0000-clientsecret';
const port = process.env.WEB_APP_PORT || '3000';
const callbackURL = process.env.CALLBACK_URL || `http://localhost:${port}/login`;

export const oa = new OAuth2(
    clientId,
    clientSecret,
    keyrockUrl,
    keyrockIPAddress,
    '/oauth2/authorize',
    '/oauth2/token',
    callbackURL
);
