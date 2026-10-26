// Música sintetizada com WebAudio, composta pelo próprio jogo (sem arquivos de áudio): cada fase tem
// a sua trilha (tom, modo, andamento, timbres e bateria), com uma melodia gerada a partir de uma
// semente (sempre a mesma para a fase). Com um chefe na tela entra a camada de batalha: bateria
// mais forte, arpejo mais rápido e a melodia uma oitava acima. Vitória e derrota têm vinhetas.
import { audioOut } from './sfx';

type Drums = 'none' | 'soft' | 'march' | 'drive';

export interface TrackDef {
  bpm: number;
  /** tônica (nota MIDI da oitava grave do baixo) */
  root: number;
  /** escala: intervalos em semitons a partir da tônica */
  mode: number[];
  /** acordes (graus da escala, 0 = tônica), um por compasso */
  chords: number[];
  lead: OscillatorType;
  bass: OscillatorType;
  /** arpejo: timbre e a cada quantos passos (16 avos) uma nota; 0 = sem arpejo */
  arp: OscillatorType;
  arpEvery: number;
  drums: Drums;
  /** acorde longo de fundo */
  pad: boolean;
  /** semente da melodia */
  seed: number;
  /** volume geral da trilha */
  vol: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

export const TRACKS: Record<string, TrackDef> = {
  menu: { bpm: 96, root: 43, mode: MAJOR, chords: [0, 5, 3, 4], lead: 'triangle', bass: 'triangle', arp: 'sine', arpEvery: 2, drums: 'soft', pad: true, seed: 11, vol: 0.9 },
  clareira: { bpm: 124, root: 43, mode: MAJOR, chords: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'square', bass: 'triangle', arp: 'triangle', arpEvery: 2, drums: 'march', pad: false, seed: 21, vol: 0.8 },
  outono: { bpm: 116, root: 45, mode: MIXO, chords: [0, 6, 3, 0, 0, 6, 4, 4], lead: 'triangle', bass: 'triangle', arp: 'square', arpEvery: 2, drums: 'march', pad: true, seed: 32, vol: 0.85 },
  pantano: { bpm: 104, root: 40, mode: DORIAN, chords: [0, 3, 0, 6, 0, 3, 4, 4], lead: 'triangle', bass: 'sine', arp: 'triangle', arpEvery: 3, drums: 'soft', pad: true, seed: 43, vol: 0.9 },
  dunas: { bpm: 120, root: 38, mode: HARMONIC, chords: [0, 1, 0, 6, 0, 1, 4, 4], lead: 'sawtooth', bass: 'triangle', arp: 'triangle', arpEvery: 2, drums: 'march', pad: false, seed: 54, vol: 0.7 },
  sombria: { bpm: 100, root: 40, mode: MINOR, chords: [0, 5, 3, 4, 0, 5, 6, 4], lead: 'triangle', bass: 'sawtooth', arp: 'sine', arpEvery: 2, drums: 'soft', pad: true, seed: 65, vol: 0.85 },
  pico: { bpm: 112, root: 42, mode: DORIAN, chords: [0, 6, 5, 4, 0, 6, 3, 4], lead: 'sine', bass: 'triangle', arp: 'sine', arpEvery: 1, drums: 'soft', pad: true, seed: 76, vol: 1 },
  vulcao: { bpm: 138, root: 40, mode: PHRYGIAN, chords: [0, 1, 0, 6, 0, 1, 5, 6], lead: 'sawtooth', bass: 'square', arp: 'square', arpEvery: 2, drums: 'drive', pad: false, seed: 87, vol: 0.65 },
  ruinas: { bpm: 108, root: 38, mode: HARMONIC, chords: [0, 5, 3, 4, 0, 5, 1, 4], lead: 'triangle', bass: 'sawtooth', arp: 'sine', arpEvery: 2, drums: 'march', pad: true, seed: 98, vol: 0.85 },
  cidadela: { bpm: 144, root: 37, mode: PHRYGIAN, chords: [0, 1, 6, 0, 0, 1, 4, 4], lead: 'sawtooth', bass: 'square', arp: 'sawtooth', arpEvery: 2, drums: 'drive', pad: true, seed: 109, vol: 0.6 },
  ending: { bpm: 84, root: 41, mode: MAJOR, chords: [0, 4, 5, 3, 0, 4, 3, 4], lead: 'triangle', bass: 'sine', arp: 'sine', arpEvery: 2, drums: 'none', pad: true, seed: 120, vol: 1 },
};

/** Volume da música (os efeitos ficam por cima). */
const MUSIC_VOL = 0.9;
/** Quanto adiantado as notas são agendadas (s) e de quanto em quanto tempo o agendador roda (ms). */
const LOOKAHEAD = 0.15;
const TICK = 30;

/** Nota da melodia: passo do compasso (0–15), grau da escala (relativo à tônica, pode passar de 7) e duração em passos. */
interface Note {
  step: number;
  degree: number;
  len: number;
}

/** Gerador pseudoaleatório com semente (a mesma fase sempre tem a mesma melodia). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Ritmos de um compasso (início de cada nota em 16 avos). */
const RHYTHMS = [
  [0, 4, 8, 12],
  [0, 3, 6, 8, 12],
  [0, 2, 4, 8, 10, 12],
  [0, 4, 6, 8, 12, 14],
  [0, 6, 8, 12],
  [0, 2, 4, 6, 8, 12],
];

/**
 * Melodia de 8 compassos em frases A A' B A'': as notas fortes caem nas notas do acorde e as fracas
 * andam por graus vizinhos, o que soa como uma melodia de verdade (e não notas soltas ao acaso).
 */
function compose(t: TrackDef): Note[][] {
  const r = rng(t.seed);
  const bars: Note[][] = [];
  const motif = (bar: number, from?: Note[]): Note[] => {
    const chord = t.chords[bar % t.chords.length];
    const rhythm = from ? from.map((n) => n.step) : RHYTHMS[Math.floor(r() * RHYTHMS.length)];
    let prev = chord + 7;
    return rhythm.map((step, i) => {
      const next = rhythm[i + 1] ?? 16;
      const strong = step % 4 === 0;
      let degree: number;
      if (from && i < from.length && r() < 0.65) {
        // variação: a mesma forma, ajustada ao acorde novo
        degree = from[i].degree - t.chords[(bar - 1 + t.chords.length) % t.chords.length] + chord;
      } else if (strong) {
        const tones = [chord, chord + 2, chord + 4].map((d) => d + 7);
        degree = tones.reduce((a, b) => (Math.abs(b - prev) < Math.abs(a - prev) ? b : a));
        if (r() < 0.3) degree = tones[Math.floor(r() * 3)];
      } else {
        degree = prev + (r() < 0.5 ? 1 : -1) * (r() < 0.8 ? 1 : 2);
      }
      degree = Math.max(5, Math.min(14, degree));
      prev = degree;
      return { step, degree, len: Math.max(1, Math.min(next - step, r() < 0.3 ? 2 : 4)) };
    });
  };
  const a = motif(0);
  bars.push(a, motif(1), motif(2, a), motif(3));
  bars.push(motif(4), motif(5), motif(6, a), motif(7));
  return bars;
}

class Player {
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private track: TrackDef | null = null;
  private trackId = '';
  private melody: Note[][] = [];
  private nextTime = 0;
  private step = 0;
  private timer = 0;
  /** camada de batalha (chefe na tela): 0 ou 1 */
  private battle = 0;
  private enabled = true;
  private duck = 1;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop();
    else if (this.trackId) this.play(this.trackId, true);
  }

  /** Toca a trilha (continua se já for a mesma). */
  play(id: string, restart = false) {
    if (this.trackId === id && this.timer && !restart) return;
    this.trackId = id;
    this.stop(true);
    if (!this.enabled) return;
    const out = audioOut();
    const def = TRACKS[id];
    if (!out || !def) return;
    const { ctx, master } = out;
    this.track = def;
    this.melody = compose(def);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 5200;
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.gain.gain.exponentialRampToValueAtTime(MUSIC_VOL * def.vol * this.duck, ctx.currentTime + 1.2);
    this.filter.connect(this.gain).connect(master);
    this.nextTime = ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), TICK);
  }

  /** Para a trilha (com um fim suave). */
  stop(keepId = false) {
    if (!keepId) this.trackId = '';
    window.clearInterval(this.timer);
    this.timer = 0;
    const out = audioOut();
    if (out && this.gain) {
      const g = this.gain;
      const t = out.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      window.setTimeout(() => g.disconnect(), 800);
    }
    this.gain = null;
    this.filter = null;
  }

  retry() {
    if (this.trackId && !this.timer) this.play(this.trackId, true);
  }

  setBattle(on: boolean) {
    this.battle = on ? 1 : 0;
  }

  /** Abaixa a música (pausa) ou volta ao normal. */
  setDuck(k: number) {
    this.duck = k;
    const out = audioOut();
    if (!out || !this.gain || !this.track) return;
    const t = out.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(MUSIC_VOL * this.track.vol * k, t, 0.2);
    this.filter?.frequency.setTargetAtTime(k < 1 ? 1400 : 5200, t, 0.2);
  }

  private schedule() {
    const out = audioOut();
    const t = this.track;
    if (!out || !t || !this.filter) return;
    // aba escondida ou áudio suspenso: não acumula notas
    if (out.ctx.state !== 'running') {
      this.nextTime = out.ctx.currentTime + 0.1;
      return;
    }
    const stepDur = 60 / t.bpm / 4;
    while (this.nextTime < out.ctx.currentTime + LOOKAHEAD) {
      this.playStep(out.ctx, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % (16 * 8);
    }
  }

  private freq(degree: number, octave: number) {
    const t = this.track!;
    const o = Math.floor(degree / 7);
    const d = ((degree % 7) + 7) % 7;
    const midi = t.root + 12 * (octave + o) + t.mode[d];
    return 440 * 2 ** ((midi - 69) / 12);
  }

  private note(ctx: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, vol: number, attack = 0.01) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(this.filter!);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  private hit(ctx: AudioContext, at: number, kind: 'kick' | 'snare' | 'hat', vol: number) {
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(120, at);
      osc.frequency.exponentialRampToValueAtTime(40, at + 0.12);
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      osc.connect(g).connect(this.filter!);
      osc.start(at);
      osc.stop(at + 0.2);
      return;
    }
    const len = kind === 'snare' ? 0.14 : 0.04;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'snare' ? 'bandpass' : 'highpass';
    f.frequency.value = kind === 'snare' ? 1800 : 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(f).connect(g).connect(this.filter!);
    src.start(at);
  }

  private playStep(ctx: AudioContext, step: number, at: number, sd: number) {
    const t = this.track!;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = t.chords[bar % t.chords.length];
    const battle = this.battle;
    // fundo: acorde longo no começo do compasso
    if (t.pad && s === 0) {
      for (const d of [chord, chord + 2, chord + 4]) this.note(ctx, this.freq(d, 1), at, sd * 16, 'triangle', 0.035, 0.4);
    }
    // baixo: tônica do acorde (na batalha, em colcheias)
    if (s % (battle || t.drums === 'drive' ? 4 : 8) === 0) {
      this.note(ctx, this.freq(chord, 0), at, sd * (battle ? 3 : 6), t.bass, 0.16);
    }
    // arpejo pelas notas do acorde
    const every = battle ? 1 : t.arpEvery;
    if (every && s % every === 0) {
      const tones = [chord, chord + 2, chord + 4, chord + 7];
      const d = tones[(s / every) % tones.length];
      this.note(ctx, this.freq(d, 2), at, sd * 1.5, t.arp, battle ? 0.045 : 0.04);
    }
    // melodia (na batalha, uma oitava acima e com timbre mais forte)
    for (const n of this.melody[bar]) {
      if (n.step !== s) continue;
      this.note(ctx, this.freq(n.degree, battle ? 2 : 1), at, sd * n.len * 0.95, battle ? 'square' : t.lead, t.lead === 'sawtooth' || battle ? 0.06 : 0.09);
    }
    // bateria
    const drums: Drums = battle ? 'drive' : t.drums;
    if (drums === 'none') return;
    if (drums === 'soft') {
      if (s === 0) this.hit(ctx, at, 'kick', 0.28);
      if (s % 4 === 2) this.hit(ctx, at, 'hat', 0.04);
      return;
    }
    if (s === 0 || s === 8 || (drums === 'drive' && (s === 6 || s === 10))) this.hit(ctx, at, 'kick', 0.4);
    if (s === 4 || s === 12) this.hit(ctx, at, 'snare', drums === 'drive' ? 0.22 : 0.16);
    if (s % 2 === 0) this.hit(ctx, at, 'hat', drums === 'drive' ? 0.06 : 0.045);
  }
}

const player = new Player();

/** Toca a trilha da tela/fase (a mesma continua sem recomeçar). */
export function playMusic(id: string) {
  player.play(id);
}

/** O áudio acabou de ser liberado (primeiro toque): começa a trilha que estava esperando. */
export function retryMusic() {
  player.retry();
}

export function stopMusic() {
  player.stop();
}

/** Camada de batalha (chefe na tela). */
export function setBattleMusic(on: boolean) {
  player.setBattle(on);
}

/** Música abaixada e abafada (pausa e telas por cima). */
export function duckMusic(on: boolean) {
  player.setDuck(on ? 0.35 : 1);
}

export function setMusicEnabled(on: boolean) {
  player.setEnabled(on);
}

/** Vinheta curta: vitória (fanfarra maior) ou derrota (descida menor). Para a trilha antes. */
export function jingle(kind: 'victory' | 'defeat') {
  const out = audioOut();
  if (!out) return;
  player.stop();
  const { ctx, master } = out;
  const g = ctx.createGain();
  g.gain.value = MUSIC_VOL * 0.7;
  g.connect(master);
  const notes = kind === 'victory'
    ? [[67, 0, 0.18], [72, 0.15, 0.18], [76, 0.3, 0.18], [79, 0.45, 0.5], [76, 0.85, 0.15], [79, 1.0, 0.9]]
    : [[64, 0, 0.35], [62, 0.3, 0.35], [60, 0.6, 0.35], [55, 0.9, 1.1]];
  const t0 = ctx.currentTime + 0.05;
  for (const [midi, at, dur] of notes) {
    for (const [type, mult, vol] of [['square', 1, 0.12], ['triangle', 0.5, 0.18]] as [OscillatorType, number, number][]) {
      const osc = ctx.createOscillator();
      const ng = ctx.createGain();
      osc.type = type;
      osc.frequency.value = 440 * 2 ** ((midi - 69) / 12) * mult;
      ng.gain.setValueAtTime(0.0001, t0 + at);
      ng.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.02);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      osc.connect(ng).connect(g);
      osc.start(t0 + at);
      osc.stop(t0 + at + dur + 0.05);
    }
  }
  window.setTimeout(() => g.disconnect(), 2500);
}
