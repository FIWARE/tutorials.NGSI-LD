import multer from 'multer';
import path from 'path';
import debug from 'debug';
import { Request } from 'express';

const debugLog = debug('tutorial:upload');

const csvFilter = (req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    debugLog(file);
    callback(null, true);
};

const storage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
        callback(null, path.join(__dirname, '../resources/'));
    },
    filename: (req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
        callback(null, `${Date.now()}-${file.originalname}`);
    }
});

const uploadFile = multer({ storage, fileFilter: csvFilter });
export default uploadFile;
