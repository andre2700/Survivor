// Gera screenshots/style-test.png com a cena do teste de estilo (dev/style-test.html).
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const server = await createServer({ server: { port: 5178, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 2400, height: 1280 } });
page.on('pageerror', (e) => console.error(String(e)));
page.on('console', (m) => m.type() === 'error' && console.error(m.text()));
await page.goto('http://127.0.0.1:5178/dev/style-test.html');
await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
await page.waitForTimeout(500);
await page.locator('canvas').screenshot({ path: 'screenshots/style-test.png' });
await browser.close();
await server.close();
console.log('screenshots/style-test.png');
