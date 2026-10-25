// Conferência visual de uma fase: abre a partida nela, chama cada criatura, cada evento e cada chefe,
// tira capturas e lista os erros do console. Rodar ao criar ou mexer numa fase:
// node scripts/stage-audit.mjs <fase> <pasta> [largura altura]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
const STAGE = process.argv[2] ?? 'clareira';
const OUT = process.argv[3] ?? `screenshots/stage-${STAGE}`;
const W = Number(process.argv[4] ?? 390);
const H = Number(process.argv[5] ?? 844);
mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { port: 5191, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { getStage } = await server.ssrLoadModule('/src/data/stages.ts');
const stage = getStage(STAGE);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const run = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
await page.goto('http://127.0.0.1:5191/');
await page.waitForFunction(() => !!window.__game);
// as fases anteriores vencidas: esta fica liberada
const { STAGES } = await server.ssrLoadModule('/src/data/stages.ts');
const before = STAGES.slice(0, STAGES.findIndex((s) => s.id === STAGE)).map((s) => s.id);
await run(([st, prev]) => {
  localStorage.clear();
  const tiers = Object.fromEntries(prev.map((id) => [id, [{ stars: [true, true, true], bosses: 3 }]]));
  localStorage.setItem('survivor-save-v1', JSON.stringify({ version: 2, gold: 0, stage: st, eggSeen: true, tutorial: 99, tiers, tips: ['menu', 'stages', 'pets', 'equip', 'shop', 'missions'] }));
}, [STAGE, before]);
await page.reload();
await page.waitForFunction(() => window.__game?.scene?.isActive('Menu'));
await wait(600);
await run(() => window.__game.scene.getScene('Menu').scene.start('Stages'));
await wait(900);
await shot('s00_fase');
// PAGE_ONLY=1: só a página da fase no mapa
if (process.env.PAGE_ONLY) {
  console.log(errors.length ? `ERROS:\n${errors.join('\n')}` : 'sem erros no console');
  await browser.close();
  await server.close();
  process.exit(errors.length ? 1 : 0);
}
await run(() => window.__game.scene.getScene('Stages').scene.start('Menu'));
await page.waitForFunction(() => window.__game.scene.isActive('Menu'));
await run(() => window.__game.scene.getScene('Menu').scene.start('Game'));
await page.waitForFunction(() => window.__game.scene.isActive('Hud'));
// herói imortal: a conferência é visual
await run(() => { const g = window.__game.scene.getScene('Game'); g.stats.maxHp = g.hp = 1e9; g.addXp = () => {}; });
await wait(2500);
await shot('s01_inicio');

// cada criatura da fase (das ondas e dos anéis), em volta do herói
const kinds = [...new Set(stage.waves.flatMap((w) => w.pool).concat(stage.ring ?? [], stage.swarm ? [stage.swarm] : [], stage.sleepers ?? []))];
console.log('criaturas:', kinds.join(', '));
await run((ks) => {
  const g = window.__game.scene.getScene('Game');
  g.devKillAll();
  ks.forEach((k, i) => {
    const a = (i / ks.length) * Math.PI * 2;
    g.devSpawn(k, g.player.x + Math.cos(a) * 110, g.player.y + Math.sin(a) * 110);
  });
}, kinds);
await wait(1800);
await shot('s02_criaturas');
await wait(1500);
await shot('s03_criaturas_ataque');

// criaturas paradas no mapa (estátua de gárgula, mímico): dormindo e depois acordando
if (stage.sleepers?.length) {
  await run((ids) => {
    const g = window.__game.scene.getScene('Game');
    g.devKillAll();
    ids.forEach((id, i) => g.spawnSleeper(id, g.player.x - 60 + i * 120, g.player.y - 150));
  }, stage.sleepers);
  await wait(800);
  await shot('s04_dormindo');
  await run(() => { const g = window.__game.scene.getScene('Game'); g.player.y -= 120; });
  await wait(900);
  await shot('s05_acordando');
}

// cada evento da fase
for (const ev of stage.events) {
  await run(() => window.__game.scene.getScene('Game').devKillAll());
  await run((e) => window.__game.scene.getScene('Game').runEvents.start(e), ev);
  await wait(1600);
  await shot(`s10_evento_${ev}`);
  await wait(1500);
  await shot(`s11_evento_${ev}_b`);
  await wait(2000);
  await shot(`s12_evento_${ev}_c`);
  await wait(5000);
}

// os três chefes
for (let i = 0; i < 3; i++) {
  await run(() => { const g = window.__game.scene.getScene('Game'); g.devKillAll(); for (const b of g.mainBosses) b.hp = 0; });
  await wait(1500);
  await run(() => window.__game.scene.getScene('Game').devBoss());
  await wait(2500);
  await shot(`s20_chefe${i}`);
  await wait(4000);
  await shot(`s21_chefe${i}_golpe`);
}

console.log(errors.length ? `ERROS:\n${errors.join('\n')}` : 'sem erros no console');
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
