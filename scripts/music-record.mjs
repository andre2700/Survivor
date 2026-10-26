// Grava um trecho de cada trilha (e da camada de chefe) num Chromium sem tela, mede o pico do som
// (acima de 1 estoura) e salva em mp3 para ouvir: node scripts/music-record.mjs <pasta> [segundos] [trilha ...]
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const OUT = process.argv[2] ?? 'screenshots/music';
const SECONDS = Number(process.argv[3] ?? 14);
mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { port: 5195, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { TRACKS } = await server.ssrLoadModule('/src/systems/music.ts');
const ids = process.argv.slice(4).length ? process.argv.slice(4) : Object.keys(TRACKS);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5195/');
await page.waitForFunction(() => window.__game?.scene?.isActive('Menu'));
for (const id of ids) {
  for (const battle of id === 'menu' || id === 'ending' ? [false] : [false, true]) {
    const r = await page.evaluate(async ([id, battle, secs]) => {
      const sfx = await import('/src/systems/sfx.ts');
      const music = await import('/src/systems/music.ts');
      sfx.unlockAudio();
      const { ctx, master } = sfx.audioOut();
      await ctx.resume();
      const dest = ctx.createMediaStreamDestination();
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      master.connect(dest);
      master.connect(an);
      music.setBattleMusic(battle);
      music.playMusic(id);
      const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();
      let peak = 0;
      let sum = 0;
      let n = 0;
      const buf = new Float32Array(an.fftSize);
      const t0 = performance.now();
      while (performance.now() - t0 < secs * 1000) {
        await new Promise((res) => setTimeout(res, 40));
        an.getFloatTimeDomainData(buf);
        for (const v of buf) {
          peak = Math.max(peak, Math.abs(v));
          sum += v * v;
          n++;
        }
      }
      rec.stop();
      await new Promise((res) => (rec.onstop = res));
      music.stopMusic();
      master.disconnect(dest);
      master.disconnect(an);
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      await new Promise((res) => setTimeout(res, 800));
      return { peak, rms: Math.sqrt(sum / n), b64: btoa(bin) };
    }, [id, battle, battle ? Math.min(SECONDS, 8) : SECONDS]);
    const name = `${id}${battle ? '_chefe' : ''}`;
    writeFileSync(`${OUT}/${name}.webm`, Buffer.from(r.b64, 'base64'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${OUT}/${name}.webm`, '-b:a', '128k', `${OUT}/${name}.mp3`]);
    console.log(`${name.padEnd(16)} pico ${r.peak.toFixed(2)} rms ${r.rms.toFixed(3)}${r.peak > 0.98 ? '  ESTOURA' : ''}`);
  }
}
console.log(errors.length ? `ERROS:\n${errors.join('\n')}` : 'sem erros no console');
await browser.close();
await server.close();
