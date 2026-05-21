import debug from 'debug';
import monitor from '../../lib/monitoring';
import * as ngsiLD from '../../lib/ngsi-ld';
import type { Request, Response } from 'express';

const log = debug('tutorial:device');
const { LinkHeader } = ngsiLD;

async function displayAgriDevice(req: Request, res: Response): Promise<void> {
    log('displayAgriDevice');
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

        const controlledProperties = device.controlledProperty as string[];
        const chartData: Record<string, { data: { t: string; y: unknown }[]; labels: string[]; color: string[] }> = {};
        let timeseries: Record<string, { values: [unknown, string][] }> | null = null;

        try {
            timeseries = await ngsiLD.readTemporalEntity(
                String(req.params.id),
                {
                    options: 'temporalValues',
                    attrs: controlledProperties.join(',')
                },
                ngsiLD.setHeaders(req.session.access_token, LinkHeader)
            ) as Record<string, { values: [unknown, string][] }>;

            controlledProperties.forEach((key) => {
                let addData = false;

                if (timeseries && Array.isArray(timeseries[key].values)) {
                    addData = timeseries[key].values[0].length === 2;
                }

                if (addData && timeseries) {
                    const data: { t: string; y: unknown }[] = [];
                    const labels: string[] = [];
                    const color: string[] = [];

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
        } catch (e) {
            log(e);
        }
        return res.render('agri-device', { title: device.name, device, timeseries, chartData });
    } catch (error) {
        const err = error as { cause?: { title?: string; detail?: string }; title?: string };
        const errorDetail = err.cause || err;
        log(errorDetail);
        // If no device has been found, display an error screen
        return res.render('error', {
            title: `Error: ${errorDetail.title}`,
            message: (errorDetail as { detail?: string }).detail,
            error: {
                stack: errorDetail.title
            }
        });
    }
}

export { displayAgriDevice as display };
