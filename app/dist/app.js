"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_errors_1 = __importDefault(require("http-errors"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const index_1 = __importDefault(require("./routes/index"));
const crypto_1 = __importDefault(require("crypto"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const session = require('express-session');
const connect_flash_1 = __importDefault(require("connect-flash"));
const debug_1 = __importDefault(require("debug"));
const mongoose_1 = __importDefault(require("mongoose"));
const connect_mongo_1 = __importDefault(require("connect-mongo"));
const express_healthcheck_1 = __importDefault(require("express-healthcheck"));
const DataPersist = __importStar(require("./controllers/ngsi-ld/building-update"));
const japanese_1 = __importDefault(require("./routes/japanese"));
const log = (0, debug_1.default)('tutorial:server');
const SECRET = process.env.SESSION_SECRET || crypto_1.default.randomBytes(20).toString('hex');
const app = (0, express_1.default)();
const MONGO_DB = process.env.MONGO_URL || 'mongodb://localhost:27017';
const sessionOff = process.env.SESSION_OFF || false;
const connectWithRetry = () => {
    mongoose_1.default
        .connect(MONGO_DB + '/session')
        .then(() => {
        log('MongoDB is connected');
    })
        .catch((err) => {
        log('MongoDB connection unsuccessful: ' + JSON.stringify(err));
        log('retry after 5 seconds.');
        setTimeout(connectWithRetry, 5000);
    });
};
if (!sessionOff) {
    log(`Enabling sessions`);
    connectWithRetry();
}
else {
    log('Sessions are disabled.');
}
// view engine setup
app.set('views', path_1.default.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ type: ['application/json', 'application/*+json'] }));
app.use(express_1.default.urlencoded({ extended: false }));
app.use((0, cookie_parser_1.default)());
app.use((0, connect_flash_1.default)());
if (process.env.NODE_ENV === 'production' && !sessionOff) {
    // Use Mongo-DB to store session data.
    app.use(session({
        resave: false,
        saveUninitialized: true,
        secret: SECRET,
        store: connect_mongo_1.default.create({
            mongoUrl: MONGO_DB + '/sessions',
            ttl: 14 * 24 * 60 * 60 // save session for 14 days
        })
    }));
}
else {
    // Use Memstore for session data.
    app.use(session({
        secret: SECRET,
        resave: false,
        saveUninitialized: true
    }));
}
app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
app.use(function (req, res, next) {
    res.locals.session = req.session;
    next();
});
app.post('/building/subscription', DataPersist.duplicateBuildings);
app.use('/japanese/ngsi-ld/v1/', japanese_1.default);
app.use('/', index_1.default);
app.use('/health', (0, express_healthcheck_1.default)());
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next((0, http_errors_1.default)(404));
});
// error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(function (err, req, res, _next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.render('error');
});
exports.default = app;
