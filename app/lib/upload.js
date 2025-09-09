const multer = require('multer');
const path = require('path');
const debug = require('debug')('tutorial:upload');

const csvFilter = (req, file, callback) => {
    debug(file)
    callback(null, true);
};

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, path.join(__dirname, '../resources/'));
    },
    filename: (req, file, callback) => {
        callback(null, `${Date.now()}-${file.originalname}`);
    }
});

const uploadFile = multer({ storage, fileFilter: csvFilter });
module.exports = uploadFile;
