// Conferência do tocador de música num Chromium sem tela: começo, volta do fim para o ponto de
// repetição, troca para a trilha de chefe e de volta, pausa e troca de trilha. Mostra o volume a cada
// 1/4 s (sem buracos de silêncio) e grava screenshots/musica-teste.mp3: node scripts/music-check.mjs
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
const server = await createServer({ server: { port: 5196, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://127.0.0.1:5196/');
await page.waitForFunction(() => window.__game?.scene?.isActive('Menu'));
const r = await page.evaluate(async () => {
  const sfx = await import('/src/systems/sfx.ts');
  const music = await import('/src/systems/music.ts');
  sfx.unlockAudio();
  const { ctx, master } = sfx.audioOut();
  await ctx.resume();
  const dest = ctx.createMediaStreamDestination();
  const an = ctx.createAnalyser();
  master.connect(dest); master.connect(an);
  const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
  const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data); rec.start();
  const buf = new Float32Array(2048);
  const log = [];
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const sample = async (label, secs) => {
    for (let i = 0; i < secs * 4; i++) {
      await wait(250); an.getFloatTimeDomainData(buf);
      let s = 0; for (const v of buf) s += v * v;
      const p = window.__music; const d = p.active;
      log.push(`${label} ${(20 * Math.log10(Math.sqrt(s / buf.length) + 1e-9)).toFixed(0)}dB ${d?.id}@${d?.el.currentTime.toFixed(1)}`);
    }
  };
  music.playMusic('clareira');
  await sample('inicio', 3);
  const p = window.__music;
  p.active.el.currentTime = 160; // perto do ponto de volta (165.25)
  await sample('volta', 9);
  music.setBattleMusic(true);
  await sample('chefe', 5);
  music.setBattleMusic(false);
  await sample('fase', 4);
  music.duckMusic(true);
  await sample('pausa', 2);
  music.duckMusic(false);
  music.playMusic('menu');
  await sample('menu', 4);
  rec.stop(); await new Promise((res) => (rec.onstop = res));
  const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { log, b64: btoa(bin) };
});
console.log(r.log.join('\n'));
writeFileSync('screenshots/musica-teste.webm', Buffer.from(r.b64, 'base64'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'screenshots/musica-teste.webm', '-b:a', '128k', 'screenshots/musica-teste.mp3']);
console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'sem erros');
await browser.close(); await server.close();
