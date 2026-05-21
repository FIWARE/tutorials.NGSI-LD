import debug from 'debug';
import monitor from '../../lib/monitoring';
import * as ngsiLD from '../../lib/ngsi-ld';
import type { Request, Response } from 'express';

const log = debug('tutorial:device');
const { LinkHeader } = ngsiLD;

// This function receives the details of a device from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=Device&options=keyValues'
//
async function displayDevice(req: Request, res: Response): Promise<void> {
    log('displayDevice');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + String(req.params.id));
        const device = await ngsiLD.readEntity(
            String(req.params.id),
            { options: 'keyValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        ) as Record<string, unknown>;
        return res.render('device-details', { title: device.name, device });
    } catch (error) {
        log(error);
        // If no device has been found, display an error screen
        return res.render('error', {
            title: 'Error',
            error
        });
    }
}

export { displayDevice as display };
