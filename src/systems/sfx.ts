// Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).

type SfxName = 'hit' | 'pickup' | 'levelup' | 'hurt' | 'kill' | 'select' | 'boss' | 'zap';

let ctx: AudioContext | null = null;
let enabled = true;
const lastPlayed: Partial<Record<SfxName, number>> = {};
const MIN_GAP: Partial<Record<SfxName, number>> = { hit: 0.05, pickup: 0.04, kill: 0.04, zap: 0.08 };

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/** Deve ser chamado após um gesto do usuário (política de autoplay). */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
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
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
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
    case 'pickup':
      tone(880 + Math.random() * 200, 0.06, 'sine', 0.05, 1400);
      break;
    case 'levelup':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.06, undefined, i * 0.08));
      break;
    case 'hurt':
      tone(140, 0.15, 'sawtooth', 0.08, 70);
      break;
    case 'select':
      tone(660, 0.08, 'square', 0.05, 990);
      break;
    case 'zap':
      tone(1200, 0.12, 'sawtooth', 0.04, 200);
      break;
    case 'boss':
      tone(110, 0.6, 'sawtooth', 0.1, 55);
      tone(82, 0.8, 'square', 0.08, 41, 0.2);
      break;
  }
}
