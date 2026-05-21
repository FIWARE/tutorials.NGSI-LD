import createError from 'http-errors';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import indexRouter from './routes/index';
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const session = require('express-session') as (options?: Record<string, unknown>) => import('express').RequestHandler;
import flash from 'connect-flash';
import debug from 'debug';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import healthcheck from 'express-healthcheck';
import * as DataPersist from './controllers/ngsi-ld/building-update';
import japaneseRouter from './routes/japanese';

const log = debug('tutorial:server');

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(20).toString('hex');

const app = express();

const MONGO_DB = process.env.MONGO_URL || 'mongodb://localhost:27017';
const sessionOff = process.env.SESSION_OFF || false;

const connectWithRetry = (): void => {
    mongoose
        .connect(MONGO_DB + '/session')
        .then(() => {
            log('MongoDB is connected');
        })
        .catch((err: Error) => {
            log('MongoDB connection unsuccessful: ' + JSON.stringify(err));
            log('retry after 5 seconds.');
            setTimeout(connectWithRetry, 5000);
        });
};

if (!sessionOff) {
    log(`Enabling sessions`);
    connectWithRetry();
} else {
    log('Sessions are disabled.');
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json({ type: ['application/json', 'application/*+json'] }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(flash());

if (process.env.NODE_ENV === 'production' && !sessionOff) {
    // Use Mongo-DB to store session data.
    app.use(
        session({
            resave: false,
            saveUninitialized: true,
            secret: SECRET,
            store: MongoStore.create({
                mongoUrl: MONGO_DB + '/sessions',
                ttl: 14 * 24 * 60 * 60 // save session for 14 days
            })
        })
    );
} else {
    // Use Memstore for session data.
    app.use(
        session({
            secret: SECRET,
            resave: false,
            saveUninitialized: true
        })
    );
}

app.use(express.static(path.join(__dirname, 'public')));

app.use(function (req: Request, res: Response, next: NextFunction): void {
    res.locals.session = req.session;
    next();
});

app.post('/building/subscription', DataPersist.duplicateBuildings);
app.use('/japanese/ngsi-ld/v1/', japaneseRouter);
app.use('/', indexRouter);
app.use('/health', healthcheck());

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction): void {
    next(createError(404));
});

// error handler
app.use(function (err: { status?: number; message?: string }, req: Request, res: Response, _next: NextFunction): void {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

export default app;
