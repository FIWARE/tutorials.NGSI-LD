"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const debug_1 = __importDefault(require("debug"));
const debugLog = (0, debug_1.default)('tutorial:upload');
const csvFilter = (req, file, callback) => {
    debugLog(file);
    callback(null, true);
};
const storage = multer_1.default.diskStorage({
    destination: (req, file, callback) => {
        callback(null, path_1.default.join(__dirname, '../resources/'));
    },
    filename: (req, file, callback) => {
        callback(null, `${Date.now()}-${file.originalname}`);
    }
});
const uploadFile = (0, multer_1.default)({ storage, fileFilter: csvFilter });
exports.default = uploadFile;
