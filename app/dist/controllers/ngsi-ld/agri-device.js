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
exports.display = displayAgriDevice;
const debug_1 = __importDefault(require("debug"));
const monitoring_1 = __importDefault(require("../../lib/monitoring"));
const ngsiLD = __importStar(require("../../lib/ngsi-ld"));
const log = (0, debug_1.default)('tutorial:device');
const { LinkHeader } = ngsiLD;
async function displayAgriDevice(req, res) {
    log('displayAgriDevice');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        (0, monitoring_1.default)('NGSI', 'readEntity ' + String(req.params.id));
        const device = await ngsiLD.readEntity(String(req.params.id), { options: 'keyValues' }, ngsiLD.setHeaders(req.session.access_token, LinkHeader));
        const controlledProperties = device.controlledProperty;
        const chartData = {};
        let timeseries = null;
        try {
            timeseries = await ngsiLD.readTemporalEntity(String(req.params.id), {
                options: 'temporalValues',
                attrs: controlledProperties.join(',')
            }, ngsiLD.setHeaders(req.session.access_token, LinkHeader));
            controlledProperties.forEach((key) => {
                let addData = false;
                if (timeseries && Array.isArray(timeseries[key].values)) {
                    addData = timeseries[key].values[0].length === 2;
                }
                if (addData && timeseries) {
                    const data = [];
                    const labels = [];
                    const color = [];
                    const values = timeseries[key].values.reverse();
                    values.forEach((element) => {
                        const date = new Date(element[1]);
                        data.push({ t: element[1], y: element[0] });
                        labels.push(date.toISOString().slice(11, 16));
                        color.push('#45d3dd');
                    });
                    chartData[key] = { data, labels, color };
                }
            });
        }
        catch (e) {
            log(e);
        }
        return res.render('agri-device', { title: device.name, device, timeseries, chartData });
    }
    catch (error) {
        const err = error;
        const errorDetail = err.cause || err;
        log(errorDetail);
        // If no device has been found, display an error screen
        return res.render('error', {
            title: `Error: ${errorDetail.title}`,
            message: errorDetail.detail,
            error: {
                stack: errorDetail.title
            }
        });
    }
}
