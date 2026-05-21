import querystring from 'querystring';
import https from 'https';
import http from 'http';
import url from 'url';
import type { IncomingMessage, OutgoingHttpHeaders, RequestOptions } from 'http';

type OAuthCallback = (err?: unknown, data?: string, response?: IncomingMessage) => void;

export class OAuth2 {
    private _clientId: string;
    private _clientSecret: string;
    private _baseSite: string;
    private _baseIPAddress: string;
    private _authorizeUrl: string;
    private _accessTokenUrl: string;
    private _callbackURL: string;
    private _accessTokenName: string;
    private _authMethod: string;
    private _customHeaders: Record<string, string>;

    constructor(
        clientId: string,
        clientSecret: string,
        baseSite: string,
        baseIPAddress: string | undefined,
        authorizePath: string,
        accessTokenPath: string,
        callbackURL: string,
        customHeaders?: Record<string, string>
    ) {
        this._clientId = clientId;
        this._clientSecret = clientSecret;
        this._baseSite = baseSite;
        this._baseIPAddress = baseIPAddress || baseSite;
        this._authorizeUrl = authorizePath || '/oauth/authorize';
        this._accessTokenUrl = accessTokenPath || '/oauth/access_token';
        this._callbackURL = callbackURL;
        this._accessTokenName = 'access_token';
        this._authMethod = 'Basic';
        this._customHeaders = customHeaders || {};
    }

    setAccessTokenName(name: string): void {
        this._accessTokenName = name;
    }

    private _getAccessTokenUrl(): string {
        return this._baseIPAddress + this._accessTokenUrl;
    }

    buildAuthHeader(): string {
        const key = `${this._clientId}:${this._clientSecret}`;
        const base64 = Buffer.from(key).toString('base64');
        return `${this._authMethod} ${base64}`;
    }

    private _request(
        method: string,
        urlStr: string,
        headers: OutgoingHttpHeaders,
        postBody: string | null,
        accessToken: string | null,
        callback: OAuthCallback
    ): void {
        let httpLibrary: typeof https | typeof http = https;
        const parsedUrl = url.parse(urlStr, true);

        if (parsedUrl.protocol === 'https:' && !parsedUrl.port) {
            parsedUrl.port = '443';
        }
        if (parsedUrl.protocol !== 'https:') {
            httpLibrary = http;
        }

        const realHeaders: OutgoingHttpHeaders = {};
        for (const key in this._customHeaders) {
            realHeaders[key] = this._customHeaders[key];
        }
        for (const key in headers) {
            realHeaders[key] = headers[key];
        }
        realHeaders.Host = parsedUrl.host ?? undefined;

        if (accessToken && !('Authorization' in realHeaders)) {
            if (!parsedUrl.query) {
                parsedUrl.query = {};
            }
            (parsedUrl.query as Record<string, string>)[this._accessTokenName] = accessToken;
        }

        let queryStr = querystring.stringify(parsedUrl.query as Record<string, string>);
        if (queryStr) {
            queryStr = '?' + queryStr;
        }

        const options: RequestOptions = {
            host: parsedUrl.hostname ?? undefined,
            port: parsedUrl.port ?? undefined,
            path: (parsedUrl.pathname ?? '') + queryStr,
            method,
            headers: realHeaders,
        };

        this._executeRequest(httpLibrary, options, postBody, callback);
    }

    private _executeRequest(
        httpLibrary: typeof https | typeof http,
        options: RequestOptions,
        postBody: string | null,
        callback: OAuthCallback
    ): void {
        const allowEarlyClose = options.host?.match('.*google(apis)?.com$');
        let callbackCalled = false;

        function passBackControl(response: IncomingMessage, result: string, err?: unknown): void {
            if (!callbackCalled) {
                callbackCalled = true;
                const status = response.statusCode;
                if (status !== 200 && status !== 201 && status !== 301 && status !== 302) {
                    callback({ statusCode: status, data: result });
                } else {
                    callback(err, result, response);
                }
            }
        }

        let result = '';
        const request = httpLibrary.request(options, (response) => {
            response.on('data', (chunk: Buffer) => {
                result += chunk;
            });
            response.on('close', (err: unknown) => {
                if (allowEarlyClose) {
                    passBackControl(response, result, err);
                }
            });
            response.addListener('end', () => {
                passBackControl(response, result);
            });
        });

        request.on('error', (e: Error) => {
            callbackCalled = true;
            callback(e);
        });

        if (options.method === 'POST' && postBody) {
            request.write(postBody);
        }
        request.end();
    }

    getAuthorizeUrl(responseType = 'code'): string {
        return (
            `${this._baseSite}${this._authorizeUrl}` +
            `?response_type=${responseType}&client_id=${this._clientId}` +
            `&state=xyz&redirect_uri=${this._callbackURL}`
        );
    }

    getOAuthAccessToken(code: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const postData = `grant_type=authorization_code&code=${code}&redirect_uri=${this._callbackURL}`;
            const postHeaders: OutgoingHttpHeaders = {
                Authorization: this.buildAuthHeader(),
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length,
            };
            this._request('POST', this._getAccessTokenUrl(), postHeaders, postData, null, (error, data) => {
                return error ? reject(error) : resolve(getResults(data ?? ''));
            });
        });
    }

    getOAuthClientCredentials(): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const postData = 'grant_type=client_credentials';
            const postHeaders: OutgoingHttpHeaders = {
                Authorization: this.buildAuthHeader(),
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length,
            };
            this._request('POST', this._getAccessTokenUrl(), postHeaders, postData, null, (error, data) => {
                return error ? reject(error) : resolve(getResults(data ?? ''));
            });
        });
    }

    getOAuthPasswordCredentials(username: string, password: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const postData = `grant_type=password&username=${username}&password=${password}`;
            const postHeaders: OutgoingHttpHeaders = {
                Authorization: this.buildAuthHeader(),
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length,
            };
            this._request('POST', this._getAccessTokenUrl(), postHeaders, postData, null, (error, data) => {
                return error ? reject(error) : resolve(getResults(data ?? ''));
            });
        });
    }

    getOAuthRefreshToken(refreshToken: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const postData = `grant_type=refresh_token&refresh_token=${refreshToken}`;
            const postHeaders: OutgoingHttpHeaders = {
                Authorization: this.buildAuthHeader(),
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length,
            };
            this._request('POST', this._getAccessTokenUrl(), postHeaders, postData, null, (error, data) => {
                return error ? reject(error) : resolve(getResults(data ?? ''));
            });
        });
    }

    get(urlStr: string, accessToken: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            this._request('GET', urlStr, {}, '', accessToken, (error, data) => {
                return error ? reject(error) : resolve(data);
            });
        });
    }
}

function getResults(data: string): unknown {
    try {
        return JSON.parse(data);
    } catch {
        return querystring.parse(data);
    }
}
