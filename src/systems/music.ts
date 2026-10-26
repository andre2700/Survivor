// Música sintetizada com WebAudio, composta pelo próprio jogo (sem arquivos de áudio): cada fase tem
// a sua trilha (tom, modo, andamento, timbres e bateria), com uma melodia gerada a partir de uma
// semente (sempre a mesma para a fase), em partes A B A' B' (32 compassos antes de repetir). Com um
// chefe na tela entra a camada de batalha: percussão bem mais forte (bumbo, tambores graves, viradas)
// e baixo em colcheias. Vitória e derrota têm vinhetas.
import { audioOut } from './sfx';

type Drums = 'none' | 'soft' | 'march' | 'drive';

export interface TrackDef {
  bpm: number;
  /** tônica (nota MIDI da oitava grave do baixo) */
  root: number;
  /** escala: intervalos em semitons a partir da tônica */
  mode: number[];
  /** acordes da parte A e da parte B (graus da escala, 0 = tônica), um por compasso */
  chordsA: number[];
  chordsB: number[];
  lead: OscillatorType;
  bass: OscillatorType;
  /** arpejo suave a cada tantos passos (16 avos); 0 = sem arpejo */
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

// andamentos calmos (a camada de chefe é que acelera a sensação, com a bateria) e timbres suaves
export const TRACKS: Record<string, TrackDef> = {
  menu: { bpm: 84, root: 43, mode: MAJOR, chordsA: [0, 4, 5, 3], chordsB: [3, 4, 0, 5], lead: 'triangle', bass: 'triangle', arpEvery: 2, drums: 'soft', pad: true, seed: 11, vol: 0.95 },
  clareira: { bpm: 104, root: 43, mode: MAJOR, chordsA: [0, 3, 4, 0], chordsB: [5, 3, 0, 4], lead: 'square', bass: 'triangle', arpEvery: 2, drums: 'march', pad: false, seed: 21, vol: 0.85 },
  outono: { bpm: 98, root: 45, mode: MIXO, chordsA: [0, 6, 3, 0], chordsB: [3, 6, 0, 4], lead: 'triangle', bass: 'triangle', arpEvery: 2, drums: 'march', pad: true, seed: 32, vol: 0.9 },
  pantano: { bpm: 90, root: 40, mode: DORIAN, chordsA: [0, 3, 0, 6], chordsB: [5, 3, 6, 4], lead: 'triangle', bass: 'sine', arpEvery: 3, drums: 'soft', pad: true, seed: 43, vol: 0.95 },
  dunas: { bpm: 100, root: 38, mode: HARMONIC, chordsA: [0, 1, 0, 6], chordsB: [3, 1, 5, 4], lead: 'triangle', bass: 'triangle', arpEvery: 2, drums: 'march', pad: false, seed: 54, vol: 0.9 },
  sombria: { bpm: 88, root: 40, mode: MINOR, chordsA: [0, 5, 3, 4], chordsB: [5, 6, 0, 4], lead: 'triangle', bass: 'triangle', arpEvery: 2, drums: 'soft', pad: true, seed: 65, vol: 0.95 },
  pico: { bpm: 94, root: 42, mode: DORIAN, chordsA: [0, 6, 5, 4], chordsB: [3, 4, 0, 6], lead: 'sine', bass: 'triangle', arpEvery: 2, drums: 'soft', pad: true, seed: 76, vol: 1 },
  vulcao: { bpm: 112, root: 40, mode: PHRYGIAN, chordsA: [0, 1, 0, 6], chordsB: [5, 6, 1, 0], lead: 'square', bass: 'square', arpEvery: 2, drums: 'drive', pad: false, seed: 87, vol: 0.75 },
  ruinas: { bpm: 92, root: 38, mode: HARMONIC, chordsA: [0, 5, 3, 4], chordsB: [5, 1, 3, 4], lead: 'triangle', bass: 'triangle', arpEvery: 2, drums: 'march', pad: true, seed: 98, vol: 0.95 },
  cidadela: { bpm: 116, root: 37, mode: PHRYGIAN, chordsA: [0, 1, 6, 0], chordsB: [5, 1, 4, 4], lead: 'square', bass: 'square', arpEvery: 2, drums: 'drive', pad: true, seed: 109, vol: 0.75 },
  ending: { bpm: 76, root: 41, mode: MAJOR, chordsA: [0, 4, 5, 3], chordsB: [3, 0, 4, 4], lead: 'triangle', bass: 'sine', arpEvery: 2, drums: 'none', pad: true, seed: 120, vol: 1 },
};

/** Volume da música (os efeitos ficam por cima). */
const MUSIC_VOL = 0.9;
/** Quanto adiantado as notas são agendadas (s) e de quanto em quanto tempo o agendador roda (ms). */
const LOOKAHEAD = 0.15;
const TICK = 30;
/** Música inteira: A (8 compassos), B (8), A' (8), B' (8), e volta ao começo (~1 min 20 s). */
const SONG_BARS = 32;
/** Agudos cortados (som mais macio, sem chiado). */
const SOFT_HZ = 3000;

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

/** Ritmos de motivo com cara própria (síncopes, pausas): é o ritmo que faz a melodia "grudar". */
const HOOK_RHYTHMS = [
  [0, 3, 6, 8, 12],
  [0, 2, 4, 7, 8],
  [0, 4, 6, 8, 11],
  [0, 3, 4, 8, 10, 12],
  [0, 2, 6, 8, 12, 14],
];
/** Ritmos da parte B: notas mais longas (contraste com o refrão). */
const LONG_RHYTHMS = [
  [0, 6, 8],
  [0, 4, 8, 12],
  [0, 8, 12],
];
/** Contornos do motivo (passos na escala a partir da primeira nota): sobe e volta, o que a gente cantarola. */
const CONTOURS = [
  [0, 1, 2, 1, 0, -1],
  [0, 2, 1, 3, 2, 0],
  [0, -1, 0, 2, 4, 2],
  [0, 0, 2, 4, 3, 2],
  [0, 2, 4, 3, 1, 0],
];

/** Parte da música em que o compasso está: 0 = A, 1 = B, 2 = A', 3 = B'. */
const sectionOf = (bar: number) => Math.floor((bar % SONG_BARS) / 8);
/** Acorde do compasso. */
const chordAt = (t: TrackDef, bar: number) => (sectionOf(bar) % 2 ? t.chordsB : t.chordsA)[bar % 4];

/**
 * Melodia de 32 compassos, como uma música de verdade:
 * - A: um motivo de um compasso (ritmo e desenho próprios) repetido e levado pelos acordes (sequência),
 *   variado no 3º compasso e fechado numa nota longa; na 2ª metade, a frase termina na tônica;
 * - B: outra ideia, mais aguda e com notas longas, em pergunta e resposta;
 * - A' e B': as mesmas frases com enfeites e um final diferente (o ouvido reconhece e não cansa).
 */
function compose(t: TrackDef): Note[][] {
  const r = rng(t.seed);
  const pick = <T>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const hook = { rhythm: pick(HOOK_RHYTHMS), contour: pick(CONTOURS) };
  const answer = { rhythm: pick(LONG_RHYTHMS), contour: pick(CONTOURS) };
  const LOW = 5;
  const HIGH = 15;
  const clamp = (d: number) => Math.max(LOW, Math.min(HIGH, d));
  /**
   * o motivo começando numa nota do acorde: a mais perto da anterior (a melodia anda, não pula) entre
   * as que deixam o desenho inteiro dentro da extensão (sem achatar no teto)
   */
  const motif = (m: { rhythm: number[]; contour: number[] }, chord: number, from: number, lift = 0): Note[] => {
    const hi = Math.max(...m.contour);
    const lo = Math.min(...m.contour);
    const tones: number[] = [];
    for (let o = -7; o <= 21; o += 7) for (const d of [chord, chord + 2, chord + 4]) tones.push(d + o + lift);
    const fits = tones.filter((d) => d + hi <= HIGH && d + lo >= LOW);
    const start = (fits.length ? fits : tones).reduce((a, b) => (Math.abs(b - from) < Math.abs(a - from) ? b : a));
    return m.rhythm.map((step, i) => ({
      step, degree: clamp(start + m.contour[i % m.contour.length]), len: Math.max(1, Math.min((m.rhythm[i + 1] ?? 16) - step, 4)),
    }));
  };
  /** compasso de fechamento: nota longa no acorde (tônica no fim da frase) e uma nota de ligação */
  const cadence = (chord: number, home: boolean): Note[] => [
    { step: 0, degree: clamp(home ? 7 : chord + 7), len: 10 },
    { step: 12, degree: clamp((home ? 7 : chord + 7) + 1), len: 3 },
  ];
  /** enfeite: notas de passagem rápidas entre as notas do motivo */
  const ornament = (bar: Note[]): Note[] => bar.flatMap((n, i) => {
    const next = bar[i + 1];
    if (!next || next.step - n.step < 3 || r() < 0.4) return [n];
    return [{ ...n, len: 1 }, { step: n.step + 1, degree: clamp(n.degree + Math.sign(next.degree - n.degree || 1)), len: next.step - n.step - 1 }];
  });

  const sectionA = (variant: boolean): Note[][] => {
    const bars: Note[][] = [];
    let last = 9;
    for (let b = 0; b < 8; b++) {
      const chord = t.chordsA[b % 4];
      let notes: Note[];
      if (b === 3) notes = cadence(chord, false);
      else if (b === 7) notes = cadence(chord, true);
      else {
        notes = motif(hook, chord, last);
        // 3º compasso de cada frase: mesma forma, desfecho diferente
        if (b % 4 === 2) notes = notes.map((n, i) => (i >= notes.length - 2 ? { ...n, degree: clamp(n.degree + (b < 4 ? 2 : -1)) } : n));
        if (variant) notes = ornament(notes);
      }
      last = notes[notes.length - 1].degree;
      bars.push(notes);
    }
    return bars;
  };
  const sectionB = (variant: boolean): Note[][] => {
    const bars: Note[][] = [];
    let last = 11;
    for (let b = 0; b < 8; b++) {
      const chord = t.chordsB[b % 4];
      let notes: Note[];
      if (b === 7) notes = cadence(t.chordsA[0], false);
      // pergunta (aguda) e resposta (mais grave, mais curta)
      else if (b % 2 === 0) notes = motif(answer, chord, last, 2);
      else notes = motif(hook, chord, last - 2).slice(0, 3);
      if (variant && b % 2 === 1) notes = ornament(notes);
      last = notes[notes.length - 1].degree;
      bars.push(notes);
    }
    return bars;
  };
  return [...sectionA(false), ...sectionB(false), ...sectionA(true), ...sectionB(true)];
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
    this.filter.frequency.value = SOFT_HZ;
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
    this.filter?.frequency.setTargetAtTime(k < 1 ? 1200 : SOFT_HZ, t, 0.2);
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
      this.step = (this.step + 1) % (16 * SONG_BARS);
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

  private hit(ctx: AudioContext, at: number, kind: 'kick' | 'snare' | 'hat' | 'tom' | 'taiko' | 'crash', vol: number, pitch = 1) {
    if (kind === 'kick' || kind === 'tom' || kind === 'taiko') {
      // tambores: um tom que cai rápido (o taiko é bem grave e longo)
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const [f0, f1, len] = kind === 'kick' ? [120, 40, 0.16] : kind === 'tom' ? [220 * pitch, 90 * pitch, 0.22] : [80, 34, 0.5];
      osc.frequency.setValueAtTime(f0, at);
      osc.frequency.exponentialRampToValueAtTime(f1, at + len * 0.8);
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(g).connect(this.filter!);
      osc.start(at);
      osc.stop(at + len + 0.05);
      return;
    }
    const len = kind === 'snare' ? 0.14 : kind === 'crash' ? 0.9 : 0.04;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'snare' ? 'bandpass' : 'highpass';
    f.frequency.value = kind === 'snare' ? 1800 : kind === 'crash' ? 4000 : 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    // pratos e chimbal passam por fora do filtro macio (senão somem)
    src.connect(f).connect(g).connect(kind === 'snare' ? this.filter! : this.gain!);
    src.start(at);
  }

  private playStep(ctx: AudioContext, step: number, at: number, sd: number) {
    const t = this.track!;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = chordAt(t, bar);
    const section = sectionOf(bar);
    const battle = this.battle;
    // fundo: acorde longo no começo do compasso
    if (t.pad && s === 0) {
      for (const d of [chord, chord + 2, chord + 4]) this.note(ctx, this.freq(d, 1), at, sd * 16, 'triangle', 0.03, 0.5);
    }
    // baixo: tônica e quinta (na parte B anda pelas notas do acorde; no chefe, em colcheias)
    const bassEvery = battle ? 2 : t.drums === 'drive' ? 4 : 8;
    if (s % bassEvery === 0) {
      const walk = section % 2 ? [chord, chord + 2, chord + 4, chord + 2] : [chord, chord, chord + 4, chord];
      const d = walk[Math.floor(s / 4) % 4];
      this.note(ctx, this.freq(d, 0), at, sd * (battle ? 1.8 : bassEvery * 0.85), t.bass, 0.15);
    }
    // arpejo baixo e suave pelas notas do acorde
    if (t.arpEvery && s % t.arpEvery === 0) {
      const tones = [chord, chord + 2, chord + 4, chord + 2];
      this.note(ctx, this.freq(tones[(s / t.arpEvery) % 4], 1), at, sd * 1.6, 'triangle', 0.03);
    }
    // melodia (no A' ganha uma segunda voz, uma terça abaixo)
    for (const n of this.melody[bar % SONG_BARS]) {
      if (n.step !== s) continue;
      const vol = t.lead === 'square' ? 0.055 : t.lead === 'sine' ? 0.11 : 0.09;
      this.note(ctx, this.freq(n.degree, 1), at, sd * n.len * 0.95, t.lead, vol * (battle ? 1.15 : 1));
      if (section === 2) this.note(ctx, this.freq(n.degree - 2, 1), at, sd * n.len * 0.9, 'triangle', 0.035);
    }
    // bateria (o chefe tem a dele, bem mais forte)
    if (battle) return this.battleDrums(ctx, bar, s, at);
    const drums = t.drums;
    if (drums === 'none') return;
    // virada no fim de cada parte
    if (bar % 8 === 7 && s >= 12 && drums !== 'soft') return this.hit(ctx, at, 'tom', 0.16, 1.4 - (s - 12) * 0.15);
    if (drums === 'soft') {
      if (s === 0) this.hit(ctx, at, 'kick', 0.24);
      if (s === 8) this.hit(ctx, at, 'kick', 0.14);
      if (s % 4 === 2) this.hit(ctx, at, 'hat', 0.03);
      return;
    }
    if (s === 0 || s === 8 || (drums === 'drive' && s === 10)) this.hit(ctx, at, 'kick', 0.34);
    if (s === 4 || s === 12) this.hit(ctx, at, 'snare', drums === 'drive' ? 0.16 : 0.12);
    if (s % 2 === 0) this.hit(ctx, at, 'hat', 0.035);
    if (bar % 8 === 0 && s === 0) this.hit(ctx, at, 'crash', 0.06);
  }

  /** Percussão da luta contra o chefe: bumbo em todo tempo, caixa forte, tambores graves e viradas. */
  private battleDrums(ctx: AudioContext, bar: number, s: number, at: number) {
    if (s % 4 === 0) this.hit(ctx, at, 'kick', 0.42);
    if (s === 14 || s === 7) this.hit(ctx, at, 'kick', 0.3);
    if (s === 0 || s === 8) this.hit(ctx, at, 'taiko', 0.35);
    if (s === 4 || s === 12) this.hit(ctx, at, 'snare', 0.26);
    if (s % 2 === 0) this.hit(ctx, at, 'hat', s % 4 === 2 ? 0.07 : 0.04);
    if (bar % 4 === 0 && s === 0) this.hit(ctx, at, 'crash', 0.1);
    // virada de tambores a cada 4 compassos
    if (bar % 4 === 3 && s >= 8 && s % 2 === 0) this.hit(ctx, at, 'tom', 0.24, 1.5 - (s - 8) * 0.12);
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

/** Melodia de uma trilha (testes e conferência). */
export const melodyOf = (id: string) => compose(TRACKS[id]);
