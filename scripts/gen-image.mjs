// Gera imagens com a API do Gemini. A chave vem de GEMINI_API_KEY ou é injetada pelo
// proxy do ambiente (segredo de rede no cabeçalho x-goog-api-key).
//
//   node scripts/gen-image.mjs --list
//   node scripts/gen-image.mjs --out art-tests/heroi.png --prompt "..." [--ref imagem.png ...] [--model nome] [--aspect 21:9]
//
// --ref envia imagens de referência (estilo ou personagem) junto com o prompt.
// Cada imagem gerada é anotada em art/source/_gen-log.jsonl (data, modelo, arquivo, tokens): é o
// registro de gastos. `node scripts/gen-image.mjs --usage` resume o registro.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname } from 'node:path';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const LOG = 'art/source/_gen-log.jsonl';
const DEFAULT_MODEL = 'gemini-2.5-flash-image';

function parseArgs(argv) {
  const args = { refs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--prompt') args.prompt = argv[++i];
    else if (a === '--prompt-file') args.prompt = readFileSync(argv[++i], 'utf8');
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--ref') args.refs.push(argv[++i]);
    else if (a === '--aspect') args.aspect = argv[++i];
    else if (a === '--usage') args.usage = true;
  }
  return args;
}

async function call(path, init) {
  const key = process.env.GEMINI_API_KEY;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(key ? { 'x-goog-api-key': key } : {}) },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${body.error?.message ?? JSON.stringify(body)}`);
  return body;
}

async function listModels() {
  const { models = [] } = await call('/models?pageSize=1000');
  for (const m of models) {
    if (/image|imagen/i.test(m.name)) console.log(m.name.replace('models/', ''), '-', m.supportedGenerationMethods?.join(','));
  }
}

async function generate({ prompt, out, model = DEFAULT_MODEL, refs, aspect }) {
  const parts = [{ text: prompt }];
  for (const ref of refs) {
    const mime = extname(ref).toLowerCase() === '.jpg' ? 'image/jpeg' : 'image/png';
    parts.push({ inline_data: { mime_type: mime, data: readFileSync(ref).toString('base64') } });
  }
  const body = await call(`/models/${model}:generateContent`, {
    method: 'POST',
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'], ...(aspect ? { imageConfig: { aspectRatio: aspect } } : {}) } }),
  });
  const resParts = body.candidates?.[0]?.content?.parts ?? [];
  const images = resParts.filter((p) => p.inlineData?.data);
  for (const p of resParts) if (p.text) console.log(p.text);
  if (images.length === 0) throw new Error(`nenhuma imagem retornada: ${JSON.stringify(body).slice(0, 500)}`);
  mkdirSync(dirname(out), { recursive: true });
  appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), model, out, tokens: body.usageMetadata?.totalTokenCount ?? null }) + '\n');
  images.forEach((img, i) => {
    const file = i === 0 ? out : out.replace(/(\.\w+)?$/, `-${i + 1}$1`);
    writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'));
    console.log('salvo:', file);
  });
}

/** Resumo do registro: imagens geradas por modelo e por dia. */
function usage() {
  if (!existsSync(LOG)) return console.log('nenhuma imagem registrada');
  const rows = readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const count = (key) => rows.reduce((m, r) => ((m[key(r)] = (m[key(r)] ?? 0) + 1), m), {});
  console.log('total:', rows.length, 'imagens');
  console.log('por modelo:', count((r) => r.model));
  console.log('por dia:', count((r) => r.at.slice(0, 10)));
}

const args = parseArgs(process.argv.slice(2));
try {
  if (args.usage) usage();
  else if (args.list) await listModels();
  else if (args.prompt && args.out) await generate(args);
  else console.log('uso: --list | --out arquivo.png --prompt "..." [--ref img.png] [--model nome]');
} catch (err) {
  console.error(String(err.message ?? err));
  process.exit(1);
}
