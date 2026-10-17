// Gera com o Gemini as imagens de art/manifest.mjs que ainda não existem em art/source/.
// O herói cavaleiro é a referência de estilo de todas as outras.
//
//   node scripts/gen-art.mjs [nome ...]     (sem nomes: todas as que faltam; com nomes: refaz essas)
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { ART } from '../art/manifest.mjs';

const run = promisify(execFile);
const STYLE = readFileSync('art/source/_style.txt', 'utf8').trim();
const REF = 'Match exactly the art style, outline weight, shading and palette of the reference image.';
const names = process.argv.slice(2);
const todo = Object.entries(ART).filter(([name, a]) =>
  a.prompt && (names.length ? names.includes(name) : !existsSync(`art/source/${name}.png`)));

async function gen([name, a]) {
  const prompt = `${STYLE} ${REF} Subject: ${a.prompt}.`;
  for (let t = 1; t <= 3; t++) {
    try {
      await run('node', ['scripts/gen-image.mjs', '--model', 'gemini-3-pro-image', '--ref', 'art/source/hero_knight.png',
        '--out', `art/source/${name}.png`, '--prompt', prompt]);
      console.log('ok', name);
      return;
    } catch (err) {
      console.log(`falhou ${name} (${t}):`, String(err.stderr ?? err).slice(0, 200));
      await new Promise((r) => setTimeout(r, 15000 * t));
    }
  }
}

const queue = [...todo];
await Promise.all([1, 2, 3].map(async () => {
  while (queue.length) await gen(queue.shift());
}));
