// Gera com o Gemini as imagens de art/manifest.mjs que ainda não existem em art/source/:
// - <nome>.png: a imagem base (o herói cavaleiro é a referência de estilo de todas);
// - <nome>_sheet.png: a folha de animação, feita a partir da imagem base do próprio personagem;
//   com `separate`, uma imagem por pose (<nome>_f1.png, ...), para figuras grandes que se encostariam na folha.
//
//   node scripts/gen-art.mjs [nome ...]     (sem nomes: tudo o que falta; com nomes, ex. goblin_sheet: refaz esses)
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { ART } from '../art/manifest.mjs';

const run = promisify(execFile);
const STYLE = readFileSync('art/source/_style.txt', 'utf8').trim();
const BG = 'Flat solid pure magenta background (#FF00FF), no ground shadow, no text, no border.';

const jobs = [];
for (const [name, a] of Object.entries(ART)) {
  if (a.tile) {
    jobs.push({ out: name, ref: 'hero_knight', prompt: `${STYLE.replace(/Single subject.*$/s, '')} Match the art style and palette of the reference image. Subject: ${a.prompt}.` });
    continue;
  }
  if (a.prompt) jobs.push({ out: name, ref: 'hero_knight', prompt: `${STYLE} Match exactly the art style, outline weight, shading and palette of the reference image. Subject: ${a.prompt}.` });
  if (a.frames && a.separate) {
    a.frames.forEach((pose, i) => jobs.push({
      out: `${name}_f${i + 1}`, ref: name, prompt: `${STYLE} ` +
        'Use the character from the reference image and keep exactly the same design, colors, outfit, proportions and art style. ' +
        `Draw this same character in strict side profile view, facing and moving to the RIGHT, in this pose: ${pose}.`,
    }));
  } else if (a.frames) {
    const poses = a.frames.map((f, i) => `${i + 1}) ${f}`).join('; ');
    jobs.push({
      out: `${name}_sheet`, ref: name, prompt: `${STYLE.replace(/Single subject, centered, small margin\. /, '')} ` +
        'Use the character from the reference image and keep exactly the same design, colors, outfit, proportions and art style. ' +
        `Create a sprite sheet: one single horizontal row of ${a.frames.length} frames of this same character, all at exactly the same scale, ` +
        'evenly spaced with wide magenta gaps between frames, no frame touching or overlapping another. ' +
        `Every frame in strict side profile view, the character facing and moving to the RIGHT. Frames from left to right: ${poses}. ${BG}`,
    });
  }
}

const names = process.argv.slice(2);
const todo = jobs.filter((j) => (names.length ? names.includes(j.out) : !existsSync(`art/source/${j.out}.png`)));

async function gen(j) {
  for (let t = 1; t <= 3; t++) {
    try {
      await run('node', ['scripts/gen-image.mjs', '--model', 'gemini-3-pro-image', '--ref', `art/source/${j.ref}.png`,
        '--out', `art/source/${j.out}.png`, '--prompt', j.prompt]);
      console.log('ok', j.out);
      return;
    } catch (err) {
      console.log(`falhou ${j.out} (${t}):`, String(err.stderr ?? err).slice(0, 200));
      await new Promise((r) => setTimeout(r, 15000 * t));
    }
  }
}

const queue = [...todo];
console.log('gerando:', queue.map((j) => j.out).join(', '));
await Promise.all([1, 2, 3].map(async () => {
  while (queue.length) await gen(queue.shift());
}));
