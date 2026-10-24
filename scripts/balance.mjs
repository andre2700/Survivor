// Simulador de equilíbrio: um robô joga partidas seguidas de uma fase, como um jogador novo. A cada
// partida ele guarda o ouro, compra melhorias permanentes (a mais barata primeiro) e joga de novo.
// Mostra quantas partidas leva para chegar a cada chefe e para vencer a fase. As partidas rodam sem
// desenhar a tela e em tempo acelerado.
// Uso: npm run balance -- [fase] [partidas] [herói] [dificuldade]
//      ex.: npm run balance -- clareira 12 knight 0
// O robô é pior que uma pessoa (não desvia dos avisos dos chefes): os números são um piso.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const [stage = 'clareira', runsArg = '10', hero = 'knight', tierArg = '0', startMeta = ''] = process.argv.slice(2);
const RUNS = Number(runsArg);
const TIER = Number(tierArg);

const server = await createServer({ server: { port: Number(process.env.PORT ?? 5180), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { META_UPGRADES, metaCost } = await server.ssrLoadModule('/src/data/meta.ts');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let page;

// melhorias que o robô compra (as de atributo; as ferramentas de carta não ajudam o robô)
const BUY = ['maxHp', 'power', 'defense', 'attackSpeed', 'moveSpeed', 'critChance', 'magnet', 'wisdom', 'greed', 'luck'];
const meta = Object.fromEntries(startMeta.split(',').filter(Boolean).map((kv) => kv.split('=')).map(([k, v]) => [k, Number(v)]));
let gold = 0;
let tiers = {};

function shop() {
  for (;;) {
    const options = META_UPGRADES.filter((d) => BUY.includes(d.id)).map((d) => ({ d, cost: metaCost(d, meta[d.id] ?? 0) }));
    options.sort((a, b) => a.cost - b.cost);
    const best = options[0];
    if (!best || best.cost > gold) return;
    gold -= best.cost;
    meta[best.d.id] = (meta[best.d.id] ?? 0) + 1;
  }
}

async function playRun() {
  // página nova a cada partida (a anterior fica com o relógio do jogo parado)
  await page?.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${process.env.PORT ?? 5180}/`);
  await page.evaluate(([save]) => localStorage.setItem('survivor-save-v1', JSON.stringify(save)), [{
    version: 2, gold: 0, meta, unlocked: ['knight', 'mage', 'ranger', 'barbarian'], selected: hero, stage, tier: { [stage]: TIER }, tiers, seen: {},
  }]);
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene?.isActive('Menu'));
  await page.evaluate(() => window.__game.scene.getScene('Menu').scene.start('Game'));
  await page.waitForFunction(() => window.__game.scene.isActive('Hud'));
  await page.evaluate(() => {
    const game = window.__game;
    game.loop.sleep();
    window.__sim = { time: game.loop.time };
  });
  for (;;) {
    const r = await page.evaluate(() => {
      const game = window.__game;
      const g = game.scene.getScene('Game');
      const DT = 1000 / 60;
      for (let i = 0; i < 1800; i++) {
        if (g.state === 'over' || g.state === 'victory' || game.scene.isActive('Victory')) break;
        // escolha de carta: arma que já tem > arma nova (até 5) > atributo de dano/vida > o resto
        if (g.state === 'levelup') {
          const owned = Object.keys(g.loadout.weapons).length;
          const score = (o) => (o.kind === 'weapon' ? (g.loadout.weapons[o.id] ? 3 : owned < 5 ? 2.6 : 0.5) : o.kind === 'stat' ? (['power', 'attackSpeed', 'maxHp', 'area'].includes(o.stat) ? 2 : 1.4) : 0.3) + o.rarity * 0.3;
          const pick = [...g.currentOptions].sort((a, b) => score(b) - score(a))[0];
          g.chooseUpgrade(pick);
          continue;
        }
        // movimento: foge dos inimigos (muito mais do chefe) e vai buscar gemas/moedas quando dá
        const p = g.player;
        let fx = 0;
        let fy = 0;
        let near = 0;
        g.queryEnemies(p.x, p.y, 200, (e) => {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const d2 = dx * dx + dy * dy + 1;
          const w = (e.boss ? 6 : 1) / d2;
          fx += dx * w;
          fy += dy * w;
          if (d2 < 60 * 60) near++;
        });
        // desvia dos avisos: golpes do céu marcados e o ponto do golpe/pouso do chefe
        const away = (x, y, r, k) => {
          const dx = p.x - x;
          const dy = p.y - y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < r + 28) { fx += (dx / d) * k; fy += (dy / d) * k; }
        };
        for (const s of g.enemySkills.strikes) away(s.x, s.y, s.r, 0.08);
        for (const [b, st] of g.bossAI.states) {
          if (!b.active || !st.move) continue;
          if (st.move.kind === 'slam' || st.move.kind === 'leap') away(st.tx, st.ty, 70, 0.1);
          if (st.move.kind === 'charge' && st.step === 'windup') {
            // sai da faixa da investida pelo lado
            const lx = st.tx - b.x;
            const ly = st.ty - b.y;
            const l = Math.hypot(lx, ly) || 1;
            const side = ((p.x - b.x) * -ly + (p.y - b.y) * lx) / l;
            fx += (-ly / l) * Math.sign(side || 1) * 0.08;
            fy += (lx / l) * Math.sign(side || 1) * 0.08;
          }
        }
        if (near < 4) {
          let best = null;
          let bd = 260 * 260;
          for (const k of g.pickups.items) {
            if (!k.active) continue;
            const d = (k.x - p.x) ** 2 + (k.y - p.y) ** 2;
            if (d < bd) { bd = d; best = k; }
          }
          if (best) {
            const d = Math.sqrt(bd) + 1;
            fx += ((best.x - p.x) / d) * 0.012;
            fy += ((best.y - p.y) / d) * 0.012;
          }
        }
        // anda em volta (não fica encurralado parado)
        fx += Math.cos(g.elapsed * 0.25) * 0.0015;
        fy += Math.sin(g.elapsed * 0.25) * 0.0015;
        const len = Math.hypot(fx, fy) || 1;
        g.joy.x = fx / len;
        g.joy.y = fy / len;
        window.__sim.time += DT;
        game.loop.delta = DT;
        game.headlessStep(window.__sim.time, DT);
      }
      const done = g.state === 'over' || g.state === 'victory' || game.scene.isActive('Victory');
      return { done, time: g.elapsed, bosses: g.bossesDown, gold: Math.floor(g.gold), level: g.level, victory: game.scene.isActive('Victory') || g.state === 'victory', hp: Math.round(g.hp) };
    });
    if (r.done) return r;
  }
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
console.log(`fase ${stage} · herói ${hero} · dificuldade ${TIER} · ${RUNS} partidas`);
const firstReach = {};
for (let i = 1; i <= RUNS; i++) {
  const t0 = Date.now();
  const r = await playRun();
  gold += r.gold;
  const reached = Math.min(3, Math.floor(r.time / 300));
  for (let k = 1; k <= reached; k++) firstReach[`chegou ao chefe ${k}`] ??= i;
  for (let k = 1; k <= r.bosses; k++) firstReach[`venceu o chefe ${k}`] ??= i;
  if (r.victory) {
    const list = (tiers[stage] ??= []);
    list[TIER] = { stars: [true, false, false], bosses: 3 };
  }
  const metaSum = Object.values(meta).reduce((a, b) => a + b, 0);
  console.log(`#${i} ${fmt(r.time)} chefes ${r.bosses}/3 nv ${r.level} ouro +${r.gold} (melhorias ${metaSum}) ${r.victory ? 'VITÓRIA' : ''} [${Math.round((Date.now() - t0) / 1000)}s]`);
  shop();
  if (r.victory) break;
}
console.log('primeira vez:', firstReach);
console.log('melhorias:', JSON.stringify(meta));
if (errors.length) console.log('erros:', errors.slice(0, 5));
await browser.close();
await server.close();
