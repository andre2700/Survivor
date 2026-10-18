// Gera com o Gemini as imagens de art/manifest.mjs que ainda não existem em art/source/:
// - <nome>.png: a imagem base (o herói cavaleiro é a referência de estilo de todas);
// - <nome>_sheet.png e <nome>_action.png (e _action2...): as folhas de movimento e de ação do modelo de quadros
//   (art/manifest.mjs), feitas a partir da imagem base do próprio personagem (cada folha numa imagem
//   só: gerando cada pose separada, a IA repete a mesma pose).
//
//   node scripts/gen-art.mjs [nome ...]     (sem nomes: tudo o que falta; com nomes, ex. goblin_sheet: refaz esses)
//   --plan       só lista o que seria gerado (sem gastar nada)
//   --max N      não gera se a lista passar de N imagens (padrão 6: confira uma leva antes da próxima)
//
// Modelos: personagens (heróis, monstros, chefes) usam o Pro, mais consistente; efeitos, ícones e
// objetos usam o Nano Banana 2, bem mais barato. Erro de crédito (402) para tudo na hora.
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { ART, sheets } from '../art/manifest.mjs';

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
  if (a.role === 'vfx') {
    const poses = sheets(a).move;
    const list = poses.map((p, i) => `${i + 1}) ${p.text}`).join('; ');
    // efeito com imagem base própria (onda, tornado...): os quadros seguem a imagem base
    jobs.push({
      out: `${name}_sheet`, ref: a.prompt ? name : 'hero_knight', aspect: '21:9', prompt: `${STYLE.replace(/Single subject, centered, small margin\. /, '')} ` +
        `Match the art style, outline weight, shading and palette of the reference image${a.prompt ? '' : ' (do not draw the character)'}. ` +
        `Create a sprite sheet of an animated game visual effect: one single horizontal row of ${poses.length} frames of ${a.effect}, all at the same scale, ` +
        `evenly spaced with wide magenta gaps between frames, no frame touching or overlapping another. Frames from left to right: ${list}. ${BG}`,
    });
  } else if (a.role) {
    const plan = sheets(a);
    const named = [['sheet', plan.move], ...plan.actions.map((poses, i) => [i ? `action${i + 1}` : 'action', poses])];
    for (const [suffix, poses] of named) {
      const list = poses.map((p, i) => `${i + 1}) ${p.text}`).join('; ');
      jobs.push({
        // 4 quadros ou mais numa folha quadrada viram grade 2×2: formato largo garante uma fila só
        out: `${name}_${suffix}`, ref: name, aspect: a.wide || poses.length >= 4 ? '21:9' : undefined, prompt: `${STYLE.replace(/Single subject, centered, small margin\. /, '')} ` +
          'Use the character from the reference image and keep exactly the same design, colors, outfit, proportions and art style. ' +
          `Create a sprite sheet: one single horizontal row of ${poses.length} frames of this same character, all at exactly the same scale, ` +
          'evenly spaced with wide magenta gaps between frames, no frame touching or overlapping another. ' +
          'Every frame in strict side profile view, the character facing and moving to the RIGHT, the head always at exactly the same ' +
          'side-profile angle (never turned toward the viewer). Whatever the character holds stays in the same hands in every frame. ' +
          `Frames from left to right: ${list}. ${BG}`,
      });
    }
  }
}

const PRO = 'gemini-3-pro-image';
const CHEAP = 'gemini-3.1-flash-image';
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const maxAt = argv.indexOf('--max');
const max = maxAt >= 0 ? Number(argv[maxAt + 1]) : 6;
const names = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--max');
const todo = jobs.filter((j) => (names.length ? names.includes(j.out) : !existsSync(`art/source/${j.out}.png`)));
// personagem = tem papel de criatura (não efeito)
for (const j of todo) {
  const base = ART[j.out.replace(/_(sheet|action\d*)$/, '')];
  j.model = base?.role && base.role !== 'vfx' ? PRO : CHEAP;
}
if (flag('--plan') || todo.length > max) {
  for (const j of todo) console.log(j.model === PRO ? 'pro   ' : 'barato', j.out);
  console.log(`${todo.length} imagens${todo.length > max ? ` — acima do limite (--max ${max}); nada gerado` : ''}`);
  process.exit(0);
}
let stop = false;

async function gen(j) {
  for (let t = 1; t <= 3 && !stop; t++) {
    try {
      await run('node', ['scripts/gen-image.mjs', '--model', j.model, '--ref', `art/source/${j.ref}.png`,
        '--out', `art/source/${j.out}.png`, '--prompt', j.prompt, ...(j.aspect ? ['--aspect', j.aspect] : [])]);
      console.log('ok', j.out);
      return;
    } catch (err) {
      const msg = String(err.stderr ?? err);
      console.log(`falhou ${j.out} (${t}):`, msg.slice(0, 200));
      // sem crédito: não adianta tentar de novo
      if (/\b402\b/.test(msg)) stop = true;
      await new Promise((r) => setTimeout(r, 15000 * t));
    }
  }
}

const queue = [...todo];
console.log('gerando:', queue.map((j) => j.out).join(', '));
await Promise.all([1, 2, 3].map(async () => {
  while (queue.length && !stop) await gen(queue.shift());
}));
