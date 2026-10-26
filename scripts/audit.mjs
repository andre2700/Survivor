// Conferência visual do jogo inteiro: abre todas as telas e uma partida, tira capturas e lista os
// erros do console. Rodar antes de publicar: node scripts/audit.mjs <pasta> [largura altura]
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
const OUT = process.argv[2] ?? 'screenshots/audit';
const W = Number(process.argv[3] ?? 390);
const H = Number(process.argv[4] ?? 844);
const server = await createServer({ server: { port: 5190, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { makeItem } = await server.ssrLoadModule('/src/data/items.ts');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const run = (fn, arg) => page.evaluate(fn, arg);
// GAME_LANG=en: joga em inglês e lista no fim os textos que apareceram sem tradução
if (process.env.GAME_LANG) await page.addInitScript((l) => { window.__lang = l; }, process.env.GAME_LANG);
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const go = async (from, to, data) => { await run(([f, t, d]) => window.__game.scene.getScene(f).scene.start(t, d), [from, to, data]); await wait(900); };
const reload = async (save) => {
  await run((s) => { localStorage.clear(); if (window.__lang) localStorage.setItem('survivor-settings', JSON.stringify({ language: window.__lang })); if (s) localStorage.setItem('survivor-save-v1', JSON.stringify(s)); }, save);
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene?.isActive('Menu'));
  await wait(900);
};
const startRun = async () => {
  await run(() => window.__game.scene.getScene('Menu').scene.start('Game'));
  await page.waitForFunction(() => window.__game.scene.isActive('Hud'));
};
await page.goto('http://127.0.0.1:5190/');

// 1) jogador novo: menu e tutorial da primeira partida
await reload(null);
await shot('a01_menu_novo');
await startRun();
await wait(1500); await shot('a02_tut_andar');
// arrasta o dedo na tela (joystick)
await page.mouse.move(W / 2, H * 0.7); await page.mouse.down();
for (let i = 0; i < 20; i++) { await page.mouse.move(W / 2 + 60, H * 0.7 - i); await wait(80); }
await page.mouse.up();
await wait(500); await shot('a03_tut_gemas');
await run(() => { const g = window.__game.scene.getScene('Game'); g.addXp(g.xpNext - g.xp + 1); });
await wait(1000); await shot('a04_tut_carta');
await run(() => { const s = window.__game.scene.getScene('LevelUp'); const c = s.children.list.find((o) => o.input && o.list?.length > 2); c?.emit('pointerdown'); c?.emit('pointerup'); });
await wait(800);
await run(() => { const g = window.__game.scene.getScene('Game'); g.hp = 1e9; g.stats.maxHp = 1e9; g.elapsed = 41; });
await wait(800); await shot('a05_tut_avisos');
await run(() => { window.__game.scene.getScene('Game').elapsed = 72; });
await wait(800); await shot('a06_tut_chefe');
await run(() => window.__game.scene.getScene('Game').endRun(false));
await page.waitForFunction(() => window.__game.scene.isActive('GameOver'), null, { timeout: 15000 });
await wait(2200); await shot('a07_fim');
const tut = await run(() => JSON.parse(localStorage.getItem('survivor-save-v1')).tutorial);

// 2) jogador com progresso: todas as telas
const pet = (stage, level) => ({ stage, plus: 0, level, xp: 10, feeds: 1, kills: 120, bossWins: 1, runs: 7, trial: false, mission: {} });
const items = Array.from({ length: 12 }, (_, i) => makeItem(i + 1, i % 6, 1 + i, Math.random));
await reload({ version: 2, gold: 5000, stage: 'clareira', eggSeen: true, items, equipped: {}, dust: 50, nextItem: 100, tutorial: 99, tips: [],
  pets: { fire: pet(2, 15) }, activePet: 'fire', eggs: [], evoCrystals: 1, ancientShards: 0, life: { kills: 1500, bosses: 6 }, achieved: {},
  tiers: { clareira: [{ stars: [true, false, false], bosses: 3 }] }, bestTime: 300, victories: 1 });
await shot('b01_menu');
await go('Menu', 'Missions'); await shot('b02_missoes');
await run(() => { const s = window.__game.scene.getScene('Missions'); s.tab = 'achievements'; s.scene.restart(); }); await wait(900); await shot('b03_conquistas');
await go('Missions', 'Settings', { from: 'Menu' }); await shot('b04_ajustes');
await go('Settings', 'Stages'); await shot('b05_fases');
await go('Stages', 'Shop'); await shot('b06_melhorias');
await go('Shop', 'Equip'); await shot('b07_equip');
await go('Equip', 'Pets'); await shot('b08_pets');
await go('Pets', 'Menu');
await startRun();
await run(() => { const g = window.__game.scene.getScene('Game'); g.hp = 1e9; g.stats.maxHp = 1e9; g.elapsed = 280; });
await wait(3500); await shot('b09_partida');
await run(() => { const g = window.__game.scene.getScene('Game'); g.scene.pause(); g.scene.launch('Pause'); });
await wait(700); await shot('b10_pausa');
await run(() => { window.__game.scene.getScene('Pause').scene.launch('Settings', { from: 'Pause' }); });
await wait(700); await shot('b11_pausa_ajustes');
if (process.env.GAME_LANG) console.log('SEM TRADUÇÃO:\n' + (await run(() => [...new Set(JSON.parse(sessionStorage.getItem('i18n-missing') ?? '[]'))].join('\n'))));
console.log(JSON.stringify({ tutorialAoFim: tut, errors: errors.slice(0, 10) }));
await browser.close();
await server.close();
