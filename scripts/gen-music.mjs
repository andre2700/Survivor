// Gera música com o Lyria (API do Gemini). A chave vem de GEMINI_API_KEY, como em gen-image.mjs.
//
//   node scripts/gen-music.mjs --out screenshots/musica-ia/menu.mp3 --prompt "..." [--model lyria-3-pro-preview]
//
// Cada música gerada é anotada no mesmo registro de gastos das imagens (art/source/_gen-log.jsonl);
// `node scripts/gen-image.mjs --usage` resume tudo.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const LOG = 'art/source/_gen-log.jsonl';
const DEFAULT_MODEL = 'lyria-3-pro-preview';

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--prompt') args.prompt = argv[++i];
  else if (a === '--prompt-file') args.prompt = readFileSync(argv[++i], 'utf8');
  else if (a === '--out') args.out = argv[++i];
  else if (a === '--model') args.model = argv[++i];
}
if (!args.prompt || !args.out) {
  console.log('uso: --out arquivo.mp3 --prompt "..." [--model nome]');
  process.exit(1);
}
const model = args.model ?? DEFAULT_MODEL;
const key = process.env.GEMINI_API_KEY;
const res = await fetch(`${API}/models/${model}:generateContent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(key ? { 'x-goog-api-key': key } : {}) },
  body: JSON.stringify({ contents: [{ parts: [{ text: args.prompt }] }] }),
});
const body = await res.json();
if (!res.ok) {
  console.error(`${res.status}: ${body.error?.message ?? JSON.stringify(body)}`);
  process.exit(1);
}
const parts = body.candidates?.[0]?.content?.parts ?? [];
for (const p of parts) if (p.text) console.log(p.text);
const audio = parts.find((p) => p.inlineData?.data);
if (!audio) {
  console.error('nenhum áudio retornado:', JSON.stringify(body).slice(0, 500));
  process.exit(1);
}
mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, Buffer.from(audio.inlineData.data, 'base64'));
appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), model, out: args.out, tokens: body.usageMetadata?.totalTokenCount ?? null }) + '\n');
console.log('salvo:', args.out, audio.inlineData.mimeType);
