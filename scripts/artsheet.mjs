// Gera screenshots/artsheet.png com todos os sprites ampliados (para revisar a arte).
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const server = await createServer({ server: { port: 5177, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.error(String(e)));
await page.goto(`http://127.0.0.1:5177/dev/art.html?s=${process.env.S ?? 5}`);
await page.waitForFunction(() => window.__ready);
await page.locator('canvas').screenshot({ path: 'screenshots/artsheet.png' });
await browser.close();
await server.close();
console.log('screenshots/artsheet.png');
