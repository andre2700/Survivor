// Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio). Os efeitos e a música
// (systems/music.ts) passam por um compressor no fim, para os sons somados não estourarem.

type SfxName = 'hit' | 'pickup' | 'levelup' | 'hurt' | 'kill' | 'select' | 'boss' | 'zap' | 'splash' | 'boom' | 'whoosh' | 'freeze' | 'reaction'
  | 'coin' | 'chest' | 'bell'
  // sons de cada arma
  | 'magic' | 'slash' | 'chop' | 'throw' | 'wave' | 'rumble' | 'crack' | 'wind' | 'laser' | 'fwoosh' | 'thunder';

let ctx: AudioContext | null = null;
/** sequência de gemas pegas em seguida (o tom sobe) */
let gemStreak = 0;
let gemAt = -1;
/** escala maior (semitons) da escada das gemas */
const SCALE = [0, 2, 4, 5, 7, 9, 11];
/** saída comum (compressor) e o volume dos efeitos */
let master: DynamicsCompressorNode | null = null;
let sfxBus: GainNode | null = null;
let enabled = true;
const lastPlayed: Partial<Record<SfxName, number>> = {};
const MIN_GAP: Partial<Record<SfxName, number>> = {
  magic: 0.12, slash: 0.1, chop: 0.15, throw: 0.12, wave: 0.3, rumble: 0.25, crack: 0.2, wind: 0.4, laser: 0.4, fwoosh: 0.15, thunder: 0.12,
  coin: 0.05, hit: 0.05, pickup: 0.04, kill: 0.04, zap: 0.08, splash: 0.15, boom: 0.15, whoosh: 0.2, freeze: 0.1, reaction: 0.08 };

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/** Deve ser chamado após um gesto do usuário (política de autoplay). */
export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -14;
      master.ratio.value = 4;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 2.2;
      sfxBus.connect(master);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

// app em segundo plano ou aba escondida: silencia tudo (e não gasta bateria)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
}

/** Contexto de áudio e a saída comum (para a música), se o áudio já foi liberado. */
export function audioOut(): { ctx: AudioContext; master: AudioNode } | null {
  return ctx && master ? { ctx, master } : null;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(sfxBus ?? ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Ruído filtrado (água, terra, vento): `from`→`to` é a frequência do filtro. */
function noise(dur: number, vol: number, from: number, to: number, type: BiquadFilterType = 'lowpass', delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(gain).connect(sfxBus ?? ctx.destination);
  src.start(t0);
}

/** Ruído que cresce e some devagar (onda do mar, vento): sem ataque seco, então não soa como batida. */
function noiseSwell(dur: number, vol: number, from: number, to: number, type: BiquadFilterType = 'lowpass') {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur * 0.5);
  filter.frequency.exponentialRampToValueAtTime(from, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(sfxBus ?? ctx.destination);
  src.start(t0);
}

export function sfx(name: SfxName) {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const gap = MIN_GAP[name] ?? 0;
  if (now - (lastPlayed[name] ?? -1) < gap) return;
  lastPlayed[name] = now;
  switch (name) {
    case 'hit':
      tone(220, 0.06, 'square', 0.04, 110);
      break;
    case 'kill':
      tone(160, 0.1, 'square', 0.05, 60);
      break;
    case 'pickup': {
      // gemas seguidas sobem de tom (até duas oitavas), como uma escada: dá vontade de pegar mais
      gemStreak = now - gemAt < 0.45 ? Math.min(gemStreak + 1, 24) : 0;
      gemAt = now;
      const f = 660 * 2 ** (SCALE[gemStreak % 7] / 12 + Math.floor(gemStreak / 7));
      tone(f, 0.07, 'sine', 0.05, f * 1.5);
      tone(f * 2, 0.05, 'triangle', 0.015);
      break;
    }
    case 'coin':
      tone(1976, 0.05, 'square', 0.025);
      tone(2637, 0.12, 'square', 0.025, undefined, 0.05);
      break;
    case 'chest':
      // tampa abrindo e um brilho subindo
      noise(0.12, 0.08, 800, 300);
      [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.18, 'triangle', 0.05, undefined, 0.08 + i * 0.06));
      tone(2637, 0.4, 'sine', 0.03, 3520, 0.4);
      break;
    case 'magic':
      // varinha: brilho mágico que sobe, com um "plim" de harmônicos
      tone(1047, 0.16, 'sine', 0.04, 2093);
      tone(1568, 0.12, 'triangle', 0.02, 3136, 0.03);
      break;
    case 'slash':
      // espada cortando o ar: chiado agudo e rápido
      noise(0.12, 0.07, 6000, 1800, 'bandpass');
      break;
    case 'chop':
      // machadada: corte grave e a pancada no chão
      noise(0.14, 0.08, 2500, 600, 'bandpass');
      tone(90, 0.18, 'sine', 0.1, 45, 0.05);
      break;
    case 'throw':
      // adagas e martelo arremessados: zunido curto
      noise(0.09, 0.05, 3500, 5000, 'bandpass');
      break;
    case 'wave':
      // onda: água que cresce e quebra (sem batida)
      noiseSwell(0.7, 0.09, 500, 1800);
      break;
    case 'rumble':
      // ondas de choque dos passos: estrondo grave e abafado
      tone(55, 0.35, 'sine', 0.1, 38);
      noise(0.35, 0.05, 260, 80);
      break;
    case 'crack':
      // fissura: pedra rachando em estalos
      [0, 0.05, 0.11].forEach((d) => noise(0.05, 0.08, 3000, 900, 'bandpass', d));
      tone(70, 0.25, 'sine', 0.06, 40);
      break;
    case 'wind':
      // tornado: vento girando
      noiseSwell(0.9, 0.06, 900, 2400, 'bandpass');
      break;
    case 'laser':
      tone(880, 0.35, 'sawtooth', 0.025, 1320);
      tone(440, 0.35, 'square', 0.015, 660);
      break;
    case 'fwoosh':
      // bola de fogo saindo: labareda
      noise(0.3, 0.07, 400, 1600, 'bandpass');
      break;
    case 'thunder':
      // raio: estalo seco e um trovão grave
      noise(0.06, 0.1, 8000, 3000, 'highpass');
      noise(0.5, 0.06, 300, 80, 'lowpass', 0.04);
      break;
    case 'bell':
      // sino: parciais fora da série harmônica e um decaimento longo
      [[196, 0.16], [392, 0.08], [466, 0.06], [587, 0.05], [784, 0.03]].forEach(([f, v]) => tone(f, 2.2, 'sine', v));
      noise(0.08, 0.06, 4000, 1500, 'highpass');
      break;
    case 'levelup':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.06, undefined, i * 0.08));
      break;
    case 'hurt':
      tone(140, 0.15, 'sawtooth', 0.08, 70);
      noise(0.12, 0.06, 1800, 400);
      break;
    case 'select':
      tone(660, 0.08, 'square', 0.05, 990);
      break;
    case 'zap':
      tone(1200, 0.12, 'sawtooth', 0.04, 200);
      break;
    case 'splash':
      noise(0.45, 0.12, 2400, 300);
      break;
    case 'boom':
      noise(0.5, 0.18, 600, 60);
      tone(70, 0.4, 'sine', 0.12, 35);
      break;
    case 'whoosh':
      noise(0.6, 0.08, 300, 2200, 'bandpass');
      break;
    case 'freeze':
      [1568, 2093, 2637].forEach((f, i) => tone(f, 0.18, 'triangle', 0.04, f * 1.5, i * 0.04));
      break;
    case 'reaction':
      tone(392, 0.25, 'square', 0.06, 784);
      tone(587, 0.3, 'triangle', 0.05, 1175, 0.05);
      noise(0.3, 0.08, 3000, 400);
      break;
    case 'boss':
      tone(110, 0.6, 'sawtooth', 0.1, 55);
      tone(82, 0.8, 'square', 0.08, 41, 0.2);
      break;
  }
}
