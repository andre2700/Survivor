// Gera imagens com a API do Gemini (lê a chave de GEMINI_API_KEY).
//
//   node scripts/gen-image.mjs --list
//   node scripts/gen-image.mjs --out art-tests/heroi.png --prompt "..." [--ref imagem.png ...] [--model nome]
//
// --ref envia imagens de referência (estilo ou personagem) junto com o prompt.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname } from 'node:path';

const API = 'https://generativelanguage.googleapis.com/v1beta';
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
  }
  return args;
}

async function call(path, init) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não definida');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, ...(init?.headers ?? {}) },
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

async function generate({ prompt, out, model = DEFAULT_MODEL, refs }) {
  const parts = [{ text: prompt }];
  for (const ref of refs) {
    const mime = extname(ref).toLowerCase() === '.jpg' ? 'image/jpeg' : 'image/png';
    parts.push({ inline_data: { mime_type: mime, data: readFileSync(ref).toString('base64') } });
  }
  const body = await call(`/models/${model}:generateContent`, {
    method: 'POST',
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }),
  });
  const resParts = body.candidates?.[0]?.content?.parts ?? [];
  const images = resParts.filter((p) => p.inlineData?.data);
  for (const p of resParts) if (p.text) console.log(p.text);
  if (images.length === 0) throw new Error(`nenhuma imagem retornada: ${JSON.stringify(body).slice(0, 500)}`);
  mkdirSync(dirname(out), { recursive: true });
  images.forEach((img, i) => {
    const file = i === 0 ? out : out.replace(/(\.\w+)?$/, `-${i + 1}$1`);
    writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'));
    console.log('salvo:', file);
  });
}

const args = parseArgs(process.argv.slice(2));
try {
  if (args.list) await listModels();
  else if (args.prompt && args.out) await generate(args);
  else console.log('uso: --list | --out arquivo.png --prompt "..." [--ref img.png] [--model nome]');
} catch (err) {
  console.error(String(err.message ?? err));
  process.exit(1);
}
