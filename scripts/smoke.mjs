// Teste de fumaça: abre o jogo num navegador com tela de celular, joga alguns segundos
// e salva screenshots em ./screenshots. Falha se houver erros no console.
// Uso: npm run build && npm run smoke
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
mkdirSync('screenshots', { recursive: true });

const server = await createServer({ server: { port: 5173, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const shot = (name) => page.screenshot({ path: `screenshots/${name}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const gameEval = (fn, arg) => page.evaluate(fn, arg);

await page.goto('http://127.0.0.1:5173/');
await page.waitForFunction(() => window.__game?.scene?.isActive('Menu'));
await wait(500);
await shot('01-menu');

// Loja com ouro de teste
await gameEval(() => {
  const s = JSON.parse(localStorage.getItem('survivor-save-v1') || '{}');
  localStorage.setItem('survivor-save-v1', JSON.stringify({ ...s, gold: 500 }));
});
await gameEval(() => window.__game.scene.getScene('Menu').scene.start('Shop'));
await wait(400);
await shot('02-shop');
await gameEval(() => window.__game.scene.getScene('Shop').scene.start('Menu'));
await wait(300);

// Começa a partida
await gameEval(() => window.__game.scene.getScene('Menu').scene.start('Game'));
await page.waitForFunction(() => window.__game.scene.isActive('Hud'));

// Simula o joystick arrastando o dedo
const box = await page.locator('canvas').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height * 0.75;
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 0; i < 30; i++) {
  const a = i / 5;
  await page.mouse.move(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
  await wait(100);
}
await page.mouse.up();
await shot('03-gameplay');

// Avança: dá todas as armas, pula para o minuto 5 e deixa rodar
await gameEval(() => {
  const g = window.__game.scene.getScene('Game');
  g.loadout.weapons = { sword: 3, wand: 4, orb: 3, aura: 2, lightning: 2 };
  g.loadout.passives = { might: 2, magnet: 1 };
  g.chooseUpgrade({ kind: 'gold' });
  g.pendingLevels = 0;
  g.elapsed = 300;
  g.hp = 9999;
});
await wait(6000);
await shot('04-midgame');
const midState = await gameEval(() => {
  const g = window.__game.scene.getScene('Game');
  return { enemies: g.activeEnemies().length, kills: g.kills, level: g.level, state: g.state, fps: Math.round(window.__game.loop.actualFps) };
});
console.log('meio de jogo:', midState);

// Força subir de nível
await gameEval(() => {
  const g = window.__game.scene.getScene('Game');
  if (g.state === 'playing') g.addXp(g.xpNext);
});
await page.waitForFunction(() => window.__game.scene.isActive('LevelUp'));
await wait(600);
await shot('05-levelup');
// toca na primeira carta (coordenadas lógicas -> tela)
const H = await gameEval(() => window.__game.scale.height);
const k = box.width / 360;
await page.mouse.click(box.x + 180 * k, box.y + (H * 0.16 + 60 + 35) * k);
await page.waitForFunction(() => !window.__game.scene.isActive('LevelUp'), null, { timeout: 3000 });
await wait(1500);

// Pausa e retoma
await gameEval(() => window.__game.scene.getScene('Game').openPause());
await wait(300);
await shot('06-pause');
await gameEval(() => window.__game.scene.getScene('Game').resumeFromPause());

// Chefe
await gameEval(() => {
  const g = window.__game.scene.getScene('Game');
  g.elapsed = 600;
});
await wait(2500);
await shot('07-boss');
const bossOk = await gameEval(() => ({ boss: !!window.__game.scene.getScene('Game').boss, state: window.__game.scene.getScene('Game').state }));
console.log('chefe:', bossOk);
// fecha qualquer tela de nível pendente escolhendo a primeira opção
await gameEval(() => {
  const g = window.__game.scene.getScene('Game');
  g.xp = -1e9;
  while (g.state === 'levelup') g.chooseUpgrade({ kind: 'heal' });
});

// Morte -> tela de fim
await gameEval(() => {
  const g = window.__game.scene.getScene('Game');
  g.hp = 1;
  g.revives = 0;
  g.invulnUntil = 0;
  const e = g.activeEnemies()[0];
  g.onPlayerTouched(e);
});
await page.waitForFunction(() => window.__game.scene.isActive('GameOver'), null, { timeout: 15000 });
await wait(800);
await shot('08-gameover');

// Jogar de novo
await gameEval(() => {
  const s = window.__game.scene.getScene('GameOver');
  s.scene.stop('Game'); s.scene.stop('Hud'); s.scene.stop(); s.scene.start('Game');
});
await page.waitForFunction(() => window.__game.scene.isActive('Game') && window.__game.scene.getScene('Game').state === 'playing');
await wait(1000);
await shot('09-restart');

await browser.close();
await server.close();
if (errors.length) {
  console.error('ERROS NO CONSOLE:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('OK - screenshots em ./screenshots');
