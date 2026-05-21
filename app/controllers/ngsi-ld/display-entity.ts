import debug from 'debug';
import monitor from '../../lib/monitoring';
import * as ngsiLD from '../../lib/ngsi-ld';
import type { Request, Response } from 'express';

const log = debug('tutorial:ngsi-ld');
const { LinkHeader } = ngsiLD;

// Factory that returns a display handler for a given entity type.
// Reads a single NGSI-LD entity by id, renders it using the named Pug
// template, and passes the entity data as a local under entityKey.
function displayEntity(templateName: string, entityKey: string) {
    return async function (req: Request, res: Response): Promise<void> {
        log('display ' + entityKey);
        if (!res.locals.authorized) {
            req.flash('error', 'Access Denied');
            return res.redirect('/');
        }
        try {
            monitor('NGSI', 'readEntity ' + String(req.params.id));
            const entity = await ngsiLD.readEntity(
                String(req.params.id),
                { options: 'keyValues' },
                ngsiLD.setHeaders(req.session.access_token, LinkHeader)
            ) as Record<string, unknown>;
            return res.render(templateName, { title: entity.name, [entityKey]: entity });
        } catch (error) {
            const err = error as { cause?: { title?: string; detail?: string } };
            const errorDetail = err.cause || (error as { title?: string; detail?: string });
            log(errorDetail);
            return res.render('error', {
                title: `Error: ${(errorDetail as { title?: string }).title}`,
                message: (errorDetail as { detail?: string }).detail,
                error: {
                    stack: (errorDetail as { title?: string }).title
                }
            });
        }
    };
}

export { displayEntity };
