const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const bodyParser = require('body-parser');
const indexRouter = require('./routes/index');
const healthRouter = require('./routes/health');
const crypto = require('crypto');
const session = require('express-session');
const flash = require('connect-flash');
const debug = require('debug')('tutorial:server');
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(20).toString('hex');

const app = express();
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');

const MONGO_DB = process.env.MONGO_URL || 'mongodb://localhost:27017';

const connectWithRetry = () => {
    mongoose
        .connect(MONGO_DB + '/session', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        })
        .then(() => {
            debug('MongoDB is connected');
        })
        .catch((err) => {
            debug('MongoDB connection unsuccessful: ' + JSON.stringify(err));
            debug('retry after 5 seconds.');
            setTimeout(connectWithRetry, 5000);
        });
};
connectWithRetry();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(flash());

if (process.env.NODE_ENV === 'production') {
    // Use Mongo-DB to store session data.
    app.use(
        session({
            resave: false,
            saveUninitialized: true,
            secret: SECRET,
            store: MongoStore.create({
                mongoUrl: MONGO_DB + '/sessions',
                mongooseConnection: mongoose.connection,
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
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/*+json' }));

app.use(function (req, res, next) {
    res.locals.session = req.session;
    next();
});

const proxyLDRouter = require('./routes/proxy-ld');
const DeviceConvertor = require('./controllers/ngsi-ld/device-convert');
const DataPersist = require('./controllers/ngsi-ld/building-update');
const japaneseRouter = require('./routes/japanese');
app.use('/', proxyLDRouter);
app.post('/device/subscription/initialize', DeviceConvertor.duplicateDevices);
app.post('/building/subscription', DataPersist.duplicateBuildings);
app.post('/device/subscription/:attrib', DeviceConvertor.shadowDeviceMeasures);

app.use('/japanese/ngsi-ld/v1/', japaneseRouter);

app.use('/health', healthRouter);
app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
// eslint-disable-next-line no-unused-vars
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
