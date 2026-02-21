import { Hono } from 'hono';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export const sportsRouter = new Hono();

sportsRouter.get('/live', async (c) => {
    try {
        const crawlerPath = path.resolve(process.cwd(), 'StreamCrawler');
        const scraperScript = path.join(crawlerPath, 'scraper.py');
        const outputFile = path.join(crawlerPath, 'streams.json');

        const forceRefresh = c.req.query('refresh') === 'true';

        // Fast-path: Return cached streams.json immediately if it exists and no refresh requested
        if (!forceRefresh) {
            try {
                const fileContent = await fs.readFile(outputFile, 'utf-8');
                const streams = JSON.parse(fileContent);
                console.log('[Sports] Serving CACHED streams.json');
                return c.json(streams);
            } catch (err) {
                console.log('[Sports] No cache found, running crawler...');
            }
        }

        console.log('[Sports] Invoking python crawler...');

        // Check if scraper exists
        try {
            await fs.access(scraperScript);
        } catch {
            return c.json({ error: 'Crawler script not found. Ensure StreamCrawler/scraper.py exists.' }, 500);
        }

        // Execute the python script and wait for it to finish fetching the `.m3u8` payloads
        // We force PYTHONIOENCODING to utf8 so Windows cp1252 terminal doesn't crash on stream title emojis
        const { stdout, stderr } = await execAsync(`python "${scraperScript}"`, {
            cwd: crawlerPath,
            env: { ...process.env, PYTHONIOENCODING: 'utf8' }
        });
        console.log('[Sports] Crawler STDOUT:', stdout);
        if (stderr) console.error('[Sports] Crawler STDERR:', stderr);

        // After success, parse the streams.json output from the script
        const fileContent = await fs.readFile(outputFile, 'utf-8');
        const streams = JSON.parse(fileContent);

        return c.json(streams);
    } catch (error: any) {
        console.error('[Sports] Crawler execution failed:', error);
        return c.json({ error: error.message || 'Unknown crawler failure.' }, 500);
    }
});
