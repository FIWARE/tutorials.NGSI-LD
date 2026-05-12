declare module 'express-healthcheck' {
    import type { RequestHandler } from 'express';
    function healthcheck(): RequestHandler;
    export = healthcheck;
}
