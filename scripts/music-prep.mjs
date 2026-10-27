// Prepara as músicas geradas (art/source/music/*.mp3) para o jogo: acha onde a música engrena
// (início da repetição) e onde começa o final (a repetição volta antes dele), iguala o volume
// de todas, corta o final e comprime. Escreve src/assets/music/<id>.mp3 e os pontos de repetição
// em src/systems/musicLoops.ts. Rodar depois de gerar ou trocar uma música:
//   node scripts/music-prep.mjs [id ...]
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';

const SRC = 'art/source/music';
const OUT = 'src/assets/music';
const LOOPS = 'src/systems/musicLoops.ts';
/** cruzamento do fim com o começo (s): o arquivo guarda esse trecho depois do ponto de volta */
const XF = 3;
/** volume típico (dB, janelas de 1/4 s) que todas as músicas passam a ter */
const TARGET = -16;
const RATE = 8000;
const WIN = RATE / 4;

const only = process.argv.slice(2);
const ids = readdirSync(SRC).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).filter((id) => !only.length || only.includes(id));
// pontos já calculados das outras músicas (rodar uma só não apaga as demais)
const loops = existsSync(LOOPS) ? JSON.parse(readFileSync(LOOPS, 'utf8').match(/= (\{[\s\S]*\});/)[1]) : {};

for (const id of ids) {
  const src = `${SRC}/${id}.mp3`;
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const pcm = new Int16Array(raw.buffer, raw.byteOffset, raw.length >> 1);
  const db = [];
  for (let i = 0; i + WIN <= pcm.length; i += WIN) {
    let s = 0;
    for (let k = i; k < i + WIN; k++) s += (pcm[k] / 32768) ** 2;
    db.push(10 * Math.log10(s / WIN + 1e-12));
  }
  const med = [...db].sort((a, b) => a - b)[db.length >> 1];
  const loud = (v) => v >= med - 6;
  // começo: primeira janela já no volume da música (pula introdução silenciosa)
  const first = db.findIndex(loud);
  // fim: última janela no volume da música, menos 4 s (o acorde final fica de fora)
  let last = db.length - 1;
  while (last > 0 && !loud(db[last])) last--;
  const start = Math.round((first * WIN) / RATE * 100) / 100;
  const end = Math.round(((last + 1) * WIN / RATE - 4) * 100) / 100;
  const gain = (TARGET - med).toFixed(1);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-t', String(end + XF), '-af', `volume=${gain}dB,alimiter=limit=0.95`, '-ar', '44100', '-ac', '2', '-b:a', '96k', `${OUT}/${id}.mp3`]);
  loops[id] = { start, end };
  console.log(`${id.padEnd(16)} volume ${med.toFixed(1)} dB (${gain} dB)  repete ${start}s → ${end}s`);
}

const sorted = Object.fromEntries(Object.entries(loops).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(LOOPS, `// Gerado por scripts/music-prep.mjs: onde cada música recomeça (start) e onde volta (end), em segundos.
export const MUSIC_LOOPS: Record<string, { start: number; end: number }> = ${JSON.stringify(sorted, null, 2)};
`);
