// Teste de fumaça: abre o jogo num navegador com tela de celular, passa por todas as telas
// e salva screenshots em ./screenshots. Falha se houver erros no console.
// Uso: npm run smoke
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
mkdirSync('screenshots', { recursive: true });

const server = await createServer({ server: { port: 5173, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
// LANDSCAPE=1: celular deitado (screenshots com prefixo land-)
const landscape = !!process.env.LANDSCAPE;
const page = await browser.newPage({ viewport: landscape ? { width: 844, height: 390 } : { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const shot = (name) => page.screenshot({ path: `screenshots/${landscape ? 'land-' : ''}${name}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const run = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, timeout = 10000) => page.waitForFunction(fn, null, { timeout });

await page.goto('http://127.0.0.1:5173/');
// save com ouro e ferramentas de sorte liberadas, para exercitar todas as telas
await run(() => localStorage.setItem('survivor-save-v1', JSON.stringify({ version: 2, gold: 5000, meta: { reroll: 2, banish: 1, lock: 1, choices: 1 } })));
await page.reload();
await until(() => window.__game?.scene?.isActive('Menu'));
await wait(500);
await shot('01-menu');

await run(() => window.__game.scene.getScene('Menu').scene.start('Shop'));
await wait(400);
await shot('02-shop');
await run(() => window.__game.scene.getScene('Shop').scene.start('Menu'));
await wait(300);

await run(() => window.__game.scene.getScene('Menu').scene.start('Game'));
await until(() => window.__game.scene.isActive('Hud'));

// joystick: arrasta o dedo em círculos
const box = await page.locator('canvas').boundingBox();
const k = box.width / 400;
const cx = box.x + box.width / 2;
const cy = box.y + box.height * (landscape ? 0.6 : 0.75);
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 0; i < 30; i++) {
  await page.mouse.move(cx + Math.cos(i / 5) * 40, cy + Math.sin(i / 5) * 40);
  await wait(100);
}
await page.mouse.up();
await shot('03-gameplay');

// build grande + minuto 7
await run(() => {
  const g = window.__game.scene.getScene('Game');
  g.loadout.weapons = { sword: 12, wand: 8, orb: 6, aura: 5, lightning: 4, knives: 3, axe: 3 };
  g.loadout.stats = { power: 4, area: 2, critChance: 6 };
  g.recomputeStats();
  g.refreshWeapons();
  g.elapsed = 420;
  g.hp = g.stats.maxHp = 1e9;
});
await wait(6000);
await shot('04-midgame');
console.log('meio de jogo:', await run(() => {
  const g = window.__game.scene.getScene('Game');
  return { enemies: g.activeEnemies().length, kills: g.kills, level: g.level, state: g.state, fps: Math.round(window.__game.loop.actualFps) };
}));

// tela de nível: rolar, banir, fixar e escolher
await run(() => {
  const g = window.__game.scene.getScene('Game');
  if (g.state === 'playing') g.addXp(g.xpNext);
});
await until(() => window.__game.scene.isActive('LevelUp'));
await wait(600);
await shot('05-levelup');
const lv = await run(() => {
  const g = window.__game.scene.getScene('Game');
  const before = JSON.stringify(g.currentOptions);
  const rerolled = g.reroll();
  const banished = g.banish(0);
  const locked = g.lock(1);
  return { rerolled, banished, locked, changed: before !== JSON.stringify(g.currentOptions), n: g.currentOptions.length };
});
console.log('ferramentas de sorte:', lv);
await run(() => window.__game.scene.getScene('LevelUp').scene.restart());
await wait(400);
await shot('06-levelup-tools');
const H = await run(() => window.__game.scale.height);
if (!landscape) await page.mouse.click(box.x + 200 * k, box.y + 130 * k);
await until(() => !window.__game.scene.isActive('LevelUp') || window.__game.scene.getScene('Game').state === 'levelup', 3000);
await run(() => {
  const g = window.__game.scene.getScene('Game');
  g.xp = -1e12;
  while (g.state === 'levelup') g.chooseUpgrade(g.currentOptions[0]);
});
await wait(800);

// pausa com painel de atributos
await run(() => window.__game.scene.getScene('Game').openPause());
await wait(300);
await shot('07-pause');
await run(() => window.__game.scene.getScene('Game').resumeFromPause());

// os três chefes (5, 10 e 15 min): vence um por um; o final se transforma (fase 2) antes de cair
// o herói (nível 1) não pode cair na luta: o teste é dos chefes, não da sobrevivência
await run(() => { const g = window.__game.scene.getScene('Game'); g.elapsed = 900; g.stats.maxHp = g.hp = 1e9; });
await until(() => !!window.__game.scene.getScene('Game').boss);
await wait(1500);
await shot('08-boss');
for (let i = 0; i < 10 && !(await run(() => window.__game.scene.isActive('Victory'))); i++) {
  await run(() => {
    const g = window.__game.scene.getScene('Game');
    if (g.boss && g.state === 'playing') g.hitEnemy(g.boss, 1e15);
  });
  if (i === 3) await shot('08b-boss-phase2');
  await wait(2800);
}
console.log('chefes vencidos:', await run(() => window.__game.scene.getScene('Game').bossesDown));
await until(() => window.__game.scene.isActive('Victory'), 8000);
await wait(500);
await shot('09-victory');

// modo infinito: ciclo 2
await run(() => window.__game.scene.getScene('Game').continueEndless());
await run(() => { const g = window.__game.scene.getScene('Game'); g.elapsed += 300; });
await wait(2500);
await shot('10-endless');
const endless = await run(() => { const g = window.__game.scene.getScene('Game'); return { endless: g.endless, cycle: g.cycle, boss: !!g.boss }; });
console.log('infinito:', endless);

// morte no infinito -> fim da jornada (não é derrota)
await run(() => {
  const g = window.__game.scene.getScene('Game');
  g.stats.maxHp = 100;
  g.hp = 1;
  g.stats.dodge = 0;
  g.stats.revives = 0;
  g.revivesLeft = 0;
  g.invulnUntil = 0;
  g.onPlayerTouched(g.activeEnemies()[0]);
});
await until(() => window.__game.scene.isActive('GameOver'), 15000);
await wait(800);
await shot('11-gameover');
const save = await run(() => JSON.parse(localStorage.getItem('survivor-save-v1')));
console.log('save:', { gold: save.gold, bestCycle: save.bestCycle, victories: save.victories });

// jogar de novo
await run(() => {
  const s = window.__game.scene.getScene('GameOver');
  s.scene.stop('Game'); s.scene.stop('Hud'); s.scene.stop(); s.scene.start('Game');
});
await until(() => window.__game.scene.isActive('Game') && window.__game.scene.getScene('Game').state === 'playing');
await wait(800);
await shot('12-restart');

await browser.close();
await server.close();
if (errors.length) {
  console.error('ERROS NO CONSOLE:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('OK - screenshots em ./screenshots');
