import express from 'express';
import type { Request, Response } from 'express';
import debug from 'debug';
import * as alternateContext from '../controllers/ngsi-ld/amending-context';

const router = express.Router();
const log = debug('tutorial:ngsi-ld');

log('Loading Compaction/Expansion endpoint');

router.get('/entities/:id', (req: Request, res: Response) => {
    void alternateContext.translateRequest(req, res);
});

router.get('/entities', (req: Request, res: Response) => {
    void alternateContext.translateRequest(req, res);
});

export default router;
