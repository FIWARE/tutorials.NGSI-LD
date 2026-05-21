//
// This controller is an example of accessing and amending the Context Data
// programmatically. The code uses a nodejs library to envelop all the
// necessary HTTP calls and responds with success or failure.
//

import debug from 'debug';
import monitor from '../../lib/monitoring';
import * as ngsiLD from '../../lib/ngsi-ld';
import type { Request, Response } from 'express';

const log = debug('tutorial:farm');
const { LinkHeader } = ngsiLD;

// This function receives the details of a building from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=Building&options=keyValues'
//
async function displayFarm(req: Request, res: Response): Promise<void> {
    log('displayFarm');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + String(req.params.id));
        const building = await ngsiLD.readEntity(
            String(req.params.id),
            { options: 'keyValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        ) as Record<string, unknown>;
        return res.render('building', { title: building.name, building });
    } catch (error) {
        const err = error as { cause: { title: string; detail: string } };
        // If no farm has been found, display an error screen
        return res.render('error', {
            title: `Error: ${err.cause.title}`,
            message: err.cause.detail,
            error: {
                stack: err.cause.title
            }
        });
    }
}

export { displayFarm as display };
