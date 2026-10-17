// Teste de estresse: build grande + milhares de inimigos; mede FPS e tempo de atualização.
// Uso: npm run stress   (ENEMIES=2000 por padrão)
// Atenção: no Chromium headless a renderização é por software (CPU), então o FPS daqui
// é um piso pessimista; o tempo de lógica por frame (updateMs) é a métrica comparável.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const N = Number(process.env.ENEMIES ?? 2000);
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const server = await createServer({ server: { port: 5176, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://127.0.0.1:5176/');
await page.waitForFunction(() => window.__game?.scene?.isActive('Menu'));
await page.evaluate(() => window.__game.scene.getScene('Menu').scene.start('Game'));
await page.waitForFunction(() => window.__game.scene.isActive('Hud'));

await page.evaluate((n) => {
  const g = window.__game.scene.getScene('Game');
  g.loadout.weapons = { wand: 40, knives: 40, axe: 30, orb: 30, aura: 30, lightning: 30, sword: 30 };
  g.loadout.stats = { attackSpeed: 10, amount: 3 };
  g.recomputeStats();
  g.refreshWeapons();
  g.hp = g.stats.maxHp = 1e15;
  g.xp = -1e15;
  // inimigos resistentes para a tela continuar cheia durante a medição
  g.debugSpawn(n, 'orc');
  for (const e of g.activeEnemies()) { e.maxHp = e.hp = 1e12; }
  // mede o tempo da lógica do jogo por frame
  // o Phaser chama a função guardada em sys.sceneUpdate, então o envelope vai lá
  const orig = g.sys.sceneUpdate;
  window.__upd = [];
  g.sys.sceneUpdate = function (t, d) { const s = performance.now(); orig.call(g, t, d); window.__upd.push(performance.now() - s); };
}, N);

await page.waitForTimeout(2000);
await page.evaluate(() => { window.__upd = []; window.__frames = 0; const tick = () => { window.__frames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
await page.waitForTimeout(5000);
const r = await page.evaluate(() => {
  const g = window.__game.scene.getScene('Game');
  const u = window.__upd.slice().sort((a, b) => a - b);
  return {
    enemies: g.activeEnemies().length,
    projectiles: g.projectiles.countActive(),
    fps: +(window.__frames / 5).toFixed(1),
    updateMsAvg: +(u.reduce((a, b) => a + b, 0) / u.length).toFixed(2),
    updateMsP95: +u[Math.floor(u.length * 0.95)].toFixed(2),
  };
});
console.log(JSON.stringify(r));
await page.screenshot({ path: 'screenshots/stress.png' });
await browser.close();
await server.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
