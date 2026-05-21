import debug from 'debug';
import monitor from '../../lib/monitoring';
import * as ngsiLD from '../../lib/ngsi-ld';
import type { Request, Response } from 'express';

const log = debug('tutorial:person');
const { LinkHeader } = ngsiLD;

// This function receives the details of a person from the context
//
// It is effectively processing the following cUrl command:
//   curl -X GET \
//     'http://{{orion}}/ngsi-ld/v1/entities/?type=person&options=keyValues'
//
async function displayPerson(req: Request, res: Response): Promise<void> {
    log('displayPerson');
    // If the user is not authorized, display the main page.
    if (!res.locals.authorized) {
        req.flash('error', 'Access Denied');
        return res.redirect('/');
    }
    try {
        monitor('NGSI', 'readEntity ' + String(req.params.id));
        const person = await ngsiLD.readEntity(
            String(req.params.id),
            { options: 'keyValues' },
            ngsiLD.setHeaders(req.session.access_token, LinkHeader)
        ) as Record<string, unknown>;
        return res.render('person', { title: person.name, person });
    } catch (error) {
        const err = error as { cause: { title: string; detail: string } };
        return res.render('error', {
            title: `Error: ${err.cause.title}`,
            message: err.cause.detail,
            error: {
                stack: err.cause.title
            }
        });
    }
}

export { displayPerson as display };
