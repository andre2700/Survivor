// Música sintetizada com WebAudio (sem arquivos de áudio): cada fase tem o seu tema composto à mão
// (refrão e resposta), o seu compasso, tom, modo, andamento, timbres, baixo, acompanhamento e
// bateria, montados em partes A B A' B' (32 compassos antes de repetir). Com um
// chefe na tela entra a camada de batalha: percussão bem mais forte (bumbo, tambores graves, viradas)
// e baixo em colcheias. Vitória e derrota têm vinhetas.
import { audioOut } from './sfx';

type Drums = 'none' | 'soft' | 'march' | 'drive' | 'waltz';
/** baixo: pulso de colcheias, valsa (1 e acorde), caminhando, nota longa, galope (riff) ou tônica e quinta */
type BassStyle = 'pulse' | 'waltz' | 'walk' | 'drone' | 'gallop' | 'root5';
/** acompanhamento: arpejo subindo, sobe e desce, acorde quebrado, sinos agudos esparsos ou nada */
type ArpStyle = 'up' | 'updown' | 'broken' | 'bells' | 'none';

export interface TrackDef {
  bpm: number;
  /** tônica (nota MIDI da oitava grave do baixo) */
  root: number;
  /** escala: intervalos em semitons a partir da tônica */
  mode: number[];
  /** passos (16 avos) por compasso: 16 = 4 tempos; 12 = 3 tempos (valsa) */
  meter: 16 | 12;
  /**
   * Temas compostos à mão, cada um com 2 compassos: o refrão (A) e a resposta (B). Notação:
   * "passo:grau/duração", com o grau na escala da fase (7 = tônica da oitava da melodia).
   */
  hookA: string;
  hookB: string;
  /** acordes permitidos (graus): o de cada compasso é escolhido pelas notas da melodia */
  chords: number[];
  lead: OscillatorType;
  bass: OscillatorType;
  bassStyle: BassStyle;
  arpStyle: ArpStyle;
  drums: Drums;
  /** acorde longo de fundo */
  pad: boolean;
  /** volume geral da trilha */
  vol: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

// cada fase com a sua melodia, o seu compasso e o seu acompanhamento (para nenhuma soar como outra)
export const TRACKS: Record<string, TrackDef> = {
  // tema do herói: sobe com calma e descansa
  menu: {
    bpm: 84, root: 43, mode: MAJOR, meter: 16, chords: [0, 3, 4, 5],
    hookA: '0:7/6 6:9/2 8:11/4 12:12/4 16:11/6 22:9/2 24:8/8',
    hookB: '0:12/4 4:11/4 8:9/4 12:11/4 16:10/6 22:9/2 24:7/8',
    lead: 'triangle', bass: 'triangle', bassStyle: 'root5', arpStyle: 'up', drums: 'soft', pad: true, vol: 0.95,
  },
  // marcha alegre: notas repetidas e um salto para cima
  clareira: {
    bpm: 104, root: 43, mode: MAJOR, meter: 16, chords: [0, 3, 4, 5],
    hookA: '0:7/2 2:7/2 4:11/2 6:9/2 8:11/4 12:14/4 16:12/2 18:11/2 20:9/2 22:11/2 24:7/8',
    hookB: '0:9/3 3:10/3 6:11/2 8:12/8 16:11/3 19:9/3 22:8/2 24:9/8',
    lead: 'square', bass: 'triangle', bassStyle: 'pulse', arpStyle: 'none', drums: 'march', pad: false, vol: 0.85,
  },
  // balanço de outono: desce pela sétima menor, baixo caminhando
  outono: {
    bpm: 96, root: 45, mode: MIXO, meter: 16, chords: [0, 3, 4, 6],
    hookA: '0:11/3 3:10/1 4:9/4 8:7/2 10:9/2 12:10/4 16:9/2 18:7/2 20:6/4 24:7/8',
    hookB: '0:14/4 4:13/2 6:11/2 8:12/4 12:10/4 16:11/4 20:9/4 24:10/8',
    lead: 'triangle', bass: 'triangle', bassStyle: 'walk', arpStyle: 'broken', drums: 'march', pad: true, vol: 0.9,
  },
  // valsa misteriosa na névoa
  pantano: {
    bpm: 90, root: 40, mode: DORIAN, meter: 12, chords: [0, 3, 6, 4],
    hookA: '0:7/6 6:8/3 9:9/3 12:10/6 18:9/3 21:7/3',
    hookB: '0:12/9 9:11/3 12:9/6 18:8/3 21:9/3',
    lead: 'sine', bass: 'sine', bassStyle: 'waltz', arpStyle: 'updown', drums: 'waltz', pad: true, vol: 1,
  },
  // escala do deserto (menor harmônica): sobe até a sétima e volta ornamentando
  dunas: {
    bpm: 100, root: 38, mode: HARMONIC, meter: 16, chords: [0, 3, 4, 5],
    hookA: '0:11/2 2:12/2 4:13/2 6:14/2 8:13/4 12:12/4 16:11/2 18:12/2 20:11/2 22:10/2 24:9/4 28:8/4',
    hookB: '0:7/4 4:8/2 6:9/2 8:11/8 16:12/4 20:11/2 22:9/2 24:8/8',
    lead: 'triangle', bass: 'triangle', bassStyle: 'drone', arpStyle: 'broken', drums: 'march', pad: false, vol: 0.9,
  },
  // caixinha de música sombria, em três
  sombria: {
    bpm: 84, root: 40, mode: MINOR, meter: 12, chords: [0, 3, 5, 4],
    hookA: '0:9/3 3:11/3 6:14/3 9:13/3 12:11/6 18:9/6',
    hookB: '0:12/3 3:11/3 6:9/3 9:8/3 12:7/9 21:6/3',
    lead: 'sine', bass: 'triangle', bassStyle: 'waltz', arpStyle: 'bells', drums: 'none', pad: true, vol: 1,
  },
  // vento na montanha: notas longas e sinos de gelo
  pico: {
    bpm: 92, root: 42, mode: DORIAN, meter: 16, chords: [0, 3, 4, 6],
    hookA: '0:11/8 8:14/4 12:13/4 16:11/8 24:9/4 28:10/4',
    hookB: '0:9/4 4:10/4 8:11/4 12:14/4 16:13/12 28:11/4',
    lead: 'triangle', bass: 'triangle', bassStyle: 'drone', arpStyle: 'bells', drums: 'soft', pad: true, vol: 1,
  },
  // riff pesado do vulcão, com baixo galopando
  vulcao: {
    bpm: 112, root: 40, mode: PHRYGIAN, meter: 16, chords: [0, 1, 5, 6],
    hookA: '0:7/2 2:7/1 3:8/1 4:7/2 6:10/2 8:9/2 10:8/2 12:7/4 16:7/2 18:7/1 19:8/1 20:7/2 22:11/2 24:10/4 28:8/4',
    hookB: '0:12/6 6:11/2 8:10/8 16:9/6 22:8/2 24:7/8',
    lead: 'square', bass: 'square', bassStyle: 'gallop', arpStyle: 'none', drums: 'drive', pad: false, vol: 0.75,
  },
  // órgão solene nas ruínas, em três
  ruinas: {
    bpm: 80, root: 38, mode: HARMONIC, meter: 12, chords: [0, 3, 4, 5],
    hookA: '0:7/6 6:9/3 9:11/3 12:13/6 18:14/3 21:11/3',
    hookB: '0:12/6 6:11/6 12:10/3 15:9/3 18:8/6',
    lead: 'triangle', bass: 'triangle', bassStyle: 'drone', arpStyle: 'updown', drums: 'waltz', pad: true, vol: 0.95,
  },
  // tema épico da cidadela: saltos de oitava e descida pesada
  cidadela: {
    bpm: 116, root: 37, mode: PHRYGIAN, meter: 16, chords: [0, 1, 4, 5],
    hookA: '0:7/4 4:14/4 8:13/2 10:12/2 12:11/4 16:8/4 20:12/4 24:11/8',
    hookB: '0:14/2 2:13/2 4:14/4 8:15/4 12:14/4 16:12/6 22:11/2 24:8/8',
    lead: 'square', bass: 'square', bassStyle: 'pulse', arpStyle: 'broken', drums: 'drive', pad: true, vol: 0.75,
  },
  // valsa terna do final
  ending: {
    bpm: 76, root: 41, mode: MAJOR, meter: 12, chords: [0, 3, 4, 5],
    hookA: '0:9/6 6:8/3 9:7/3 12:11/9 21:9/3',
    hookB: '0:12/6 6:11/3 9:9/3 12:10/6 18:8/3 21:7/3',
    lead: 'triangle', bass: 'sine', bassStyle: 'waltz', arpStyle: 'up', drums: 'none', pad: true, vol: 1,
  },
};

/** Volume da música (os efeitos ficam por cima). */
const MUSIC_VOL = 0.9;
/** Quanto adiantado as notas são agendadas (s) e de quanto em quanto tempo o agendador roda (ms). */
const LOOKAHEAD = 0.15;
const TICK = 30;
/** Música inteira: A (8 compassos), B (8), A' (8), B' (8), e volta ao começo. */
const SONG_BARS = 32;
/** Agudos cortados (som mais macio, sem chiado). */
const SOFT_HZ = 3000;

/** Nota da melodia: passo do compasso, grau da escala (relativo à tônica, pode passar de 7) e duração em passos. */
interface Note {
  step: number;
  degree: number;
  len: number;
}

/** A música pronta: notas de cada compasso e o acorde de cada compasso. */
interface Song {
  bars: Note[][];
  chords: number[];
}

/** "0:7/6 6:9/2" → notas. */
function parse(hook: string): Note[] {
  return hook.split(/\s+/).filter(Boolean).map((tok) => {
    const [step, rest] = tok.split(':');
    const [degree, len] = rest.split('/');
    return { step: Number(step), degree: Number(degree), len: Number(len) };
  });
}

/** Parte da música em que o compasso está: 0 = A, 1 = B, 2 = A', 3 = B'. */
const sectionOf = (bar: number) => Math.floor((bar % SONG_BARS) / 8);

/**
 * Monta a música de 32 compassos a partir dos temas da fase:
 * - A: o refrão, o refrão uma nota acima (sequência), o refrão de novo e o fecho na tônica;
 * - B: a resposta, a resposta uma nota abaixo, de novo, e um fecho em suspenso que chama o refrão;
 * - A' e B': as mesmas frases com enfeites (e no A' uma segunda voz), terminando na tônica.
 * O acorde de cada compasso é o (dentre os da fase) que mais combina com as notas daquele compasso.
 */
function compose(t: TrackDef): Song {
  const spb = t.meter;
  const A = parse(t.hookA);
  const B = parse(t.hookB);
  /** compasso k (0 ou 1) do tema, transposto `shift` graus */
  const barOf = (hook: Note[], k: number, shift = 0) =>
    hook.filter((n) => n.step >= k * spb && n.step < (k + 1) * spb).map((n) => ({ step: n.step - k * spb, degree: n.degree + shift, len: Math.min(n.len, (k + 1) * spb - n.step) }));
  const close = (degree: number): Note[] => [{ step: 0, degree, len: spb }];
  const ornament = (bar: Note[]): Note[] => bar.flatMap((n, i) => {
    const next = bar[i + 1];
    if (!next || next.step - n.step < 3 || i % 2) return [n];
    return [{ ...n, len: 1 }, { step: n.step + 1, degree: n.degree + Math.sign(next.degree - n.degree || 1), len: next.step - n.step - 1 }];
  });
  const sectionA = (v: boolean) => {
    const bars = [barOf(A, 0), barOf(A, 1), barOf(A, 0, 1), barOf(A, 1, 1), barOf(A, 0), barOf(A, 1), barOf(A, 0), close(7)];
    return v ? bars.map((b, i) => (i < 7 ? ornament(b) : b)) : bars;
  };
  const sectionB = (v: boolean) => {
    const bars = [barOf(B, 0), barOf(B, 1), barOf(B, 0, -1), barOf(B, 1, -1), barOf(B, 0), barOf(B, 1), barOf(B, 0), close(v ? 7 : 11)];
    return v ? bars.map((b, i) => (i < 7 && i % 2 ? ornament(b) : b)) : bars;
  };
  const bars = [...sectionA(false), ...sectionB(false), ...sectionA(true), ...sectionB(true)];
  // harmonia: para cada compasso, o acorde que contém mais tempo de melodia (notas no tempo forte valem mais)
  const chords = bars.map((bar, i) => {
    let best = t.chords[0];
    let bestScore = -1;
    for (const c of t.chords) {
      const tones = [c, c + 2, c + 4].map((d) => ((d % 7) + 7) % 7);
      let score = i % 8 === 7 && c === 0 ? 2 : 0;
      for (const n of bar) if (tones.includes(((n.degree % 7) + 7) % 7)) score += n.len * (n.step % (spb / 2) === 0 ? 2 : 1);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  });
  return { bars, chords };
}

class Player {
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private track: TrackDef | null = null;
  private trackId = '';
  private song: Song = { bars: [], chords: [] };
  /** acorde do acompanhamento (notas MIDI) e o compasso em que foi escolhido */
  private arpVoicing: number[] = [];
  private arpBar = -1;
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
    this.song = compose(def);
    this.arpVoicing = [];
    this.arpBar = -1;
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
      this.step = (this.step + 1) % (t.meter * SONG_BARS);
    }
  }

  private freq(degree: number, octave: number) {
    return this.hz(this.midi(degree, octave));
  }

  private midi(degree: number, octave: number) {
    const t = this.track!;
    const o = Math.floor(degree / 7);
    const d = ((degree % 7) + 7) % 7;
    return t.root + 12 * (octave + o) + t.mode[d];
  }

  private hz(midi: number) {
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
    const spb = t.meter;
    const bar = Math.floor(step / spb);
    const s = step % spb;
    const chord = this.song.chords[bar % SONG_BARS];
    const section = sectionOf(bar);
    const battle = this.battle;
    const beat = 4;
    // fundo: acorde longo no começo do compasso
    if (t.pad && s === 0) {
      for (const d of [chord, chord + 2, chord + 4]) this.note(ctx, this.freq(d, 1), at, sd * spb, 'triangle', 0.03, 0.5);
    }
    this.playBass(ctx, t, chord, s, at, sd, battle);
    this.playArp(ctx, t, bar, chord, s, at, sd);
    // melodia (no A' ganha uma segunda voz, uma terça abaixo)
    for (const n of this.song.bars[bar % SONG_BARS]) {
      if (n.step !== s) continue;
      const vol = t.lead === 'square' ? 0.055 : t.lead === 'sine' ? 0.11 : 0.09;
      this.note(ctx, this.freq(n.degree, 1), at, sd * n.len * 0.95, t.lead, vol * (battle ? 1.15 : 1));
      if (section === 2) this.note(ctx, this.freq(n.degree - 2, 1), at, sd * n.len * 0.9, 'triangle', 0.035);
    }
    // bateria (o chefe tem a dele, bem mais forte)
    if (battle) return this.battleDrums(ctx, spb, bar, s, at);
    const drums = t.drums;
    if (drums === 'none') return;
    // virada no fim de cada parte
    if (bar % 8 === 7 && s >= spb - 4 && drums !== 'soft' && drums !== 'waltz') return this.hit(ctx, at, 'tom', 0.16, 1.4 - (s - spb + 4) * 0.15);
    if (drums === 'waltz') {
      // um-dois-três: bumbo no 1, aro leve no 2 e no 3
      if (s === 0) this.hit(ctx, at, 'kick', 0.26);
      if (s === beat || s === beat * 2) this.hit(ctx, at, 'hat', 0.05);
      return;
    }
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

  /** Baixo no estilo da fase (no chefe, sempre em colcheias, mais firme). */
  private playBass(ctx: AudioContext, t: TrackDef, chord: number, s: number, at: number, sd: number, battle: number) {
    const v = 0.15;
    const play = (d: number, len: number) => this.note(ctx, this.freq(d, 0), at, sd * len, t.bass, v);
    if (battle) {
      if (s % 2 === 0) play(s % 8 === 4 ? chord + 4 : chord, 1.8);
      return;
    }
    switch (t.bassStyle) {
      case 'pulse':
        if (s % 2 === 0) play(chord, 1.6);
        return;
      case 'root5':
        if (s === 0) play(chord, 7);
        if (s === 8) play(chord + 4, 7);
        return;
      case 'walk':
        if (s % 4 === 0) play([chord, chord + 2, chord + 4, chord + 5][s / 4], 3.5);
        return;
      case 'drone':
        if (s === 0) play(chord, t.meter - 0.5);
        return;
      case 'waltz':
        if (s === 0) play(chord, 3.5);
        if (s === 4 || s === 8) this.note(ctx, this.freq(chord + 4, 0), at, sd * 3, t.bass, v * 0.6);
        return;
      case 'gallop':
        // galope: colcheia e duas semicolcheias
        if (s % 4 === 0) play(chord, 1.6);
        if (s % 4 === 2 || s % 4 === 3) play(chord, 0.8);
        return;
    }
  }

  /** Acompanhamento no estilo da fase. */
  /**
   * Acompanhamento. As notas são escolhidas como um músico faria:
   * - o acorde fica numa faixa própria, entre o baixo e a melodia (não sobe por cima dela);
   * - na troca de acorde, cada nota vai para a nota mais próxima do acorde novo (sem pular a cada compasso);
   * - o desenho cabe no compasso (6 colcheias na valsa, 8 no quaternário) e começa sempre na nota de baixo;
   * - nota que daria meio-tom contra a melodia naquele instante é trocada por outra do acorde (ou não toca).
   */
  private playArp(ctx: AudioContext, t: TrackDef, bar: number, chord: number, s: number, at: number, sd: number) {
    if (t.arpStyle === 'none') return;
    if (bar !== this.arpBar) {
      this.arpBar = bar;
      this.arpVoicing = this.voiceLead(chord);
    }
    const v = this.arpVoicing;
    const tones = [v[0], v[1], v[2], v[0] + 12];
    const waltz = t.meter === 12;
    let idx: number | undefined;
    let dur = sd * 1.8;
    let vol = 0.032;
    let type: OscillatorType = 'triangle';
    let attack = 0.01;
    switch (t.arpStyle) {
      case 'up':
        // embala: baixo-meio-alto-meio (na valsa: baixo e depois meio/alto)
        if (s % 2 === 0) idx = (waltz ? [0, 1, 2, 1, 2, 1] : [0, 1, 2, 1, 0, 1, 2, 1])[s / 2];
        break;
      case 'updown':
        // sobe e desce uma vez por compasso
        if (s % 2 === 0) idx = (waltz ? [0, 1, 2, 3, 2, 1] : [0, 1, 2, 3, 2, 1, 2, 1])[s / 2];
        type = 'sine';
        vol = 0.036;
        break;
      case 'broken':
        // nos contratempos, alternando as duas notas de cima do acorde
        if (s % 4 === 2) idx = 1 + (((s / 4) | 0) % 2);
        dur = sd * 1.5;
        vol = 0.035;
        break;
      case 'bells':
        // sinos esparsos acima da melodia
        if (s === 6) idx = 2;
        else if (s === t.meter - 2) idx = 1;
        dur = sd * 6;
        vol = 0.028;
        type = 'sine';
        attack = 0.005;
        break;
    }
    if (idx === undefined) return;
    const lift = t.arpStyle === 'bells' ? 24 : 0;
    const mel = this.melodyAt(bar, s);
    // a nota pedida e, se ela bater com a melodia, as outras do acorde (as mais próximas primeiro)
    const order = [idx, ...[0, 1, 2, 3].filter((k) => k !== idx).sort((a, b) => Math.abs(a - idx!) - Math.abs(b - idx!))];
    const pick = order.map((k) => tones[k] + lift).find((m) => {
      if (mel === undefined) return true;
      const ic = Math.abs(m - mel) % 12;
      if (ic === 1 || ic === 11) return false;
      // abaixo da melodia (os sinos ficam acima)
      return lift ? m > mel : m < mel;
    });
    if (pick === undefined) return;
    // tempo forte um pouco mais marcado
    const accent = s === 0 ? 1.2 : s % (waltz ? 4 : 8) === 0 ? 1.05 : 0.9;
    this.note(ctx, this.hz(pick), at, dur, type, vol * accent, attack);
  }

  /** Posição do acorde (três notas MIDI) mais perto da anterior, dentro da faixa do acompanhamento. */
  private voiceLead(chord: number): number[] {
    const t = this.track!;
    const pcs = [chord, chord + 2, chord + 4].map((d) => this.midi(d, 0) % 12);
    // faixa: a nota de baixo perto da oitava 1 (o acorde inteiro abaixo da tônica da melodia, acima do baixo)
    const lo = t.root + 11;
    const hi = t.root + 17;
    const center = t.root + 16;
    const prev = this.arpVoicing;
    let best: number[] = [];
    let bestCost = Infinity;
    for (let bass = lo; bass <= hi; bass++) {
      if (!pcs.includes(bass % 12)) continue;
      // as outras duas notas do acorde, logo acima
      const up = [bass];
      for (let m = bass + 1; up.length < 3; m++) if (pcs.includes(m % 12) && !up.some((u) => u % 12 === m % 12)) up.push(m);
      const mean = (up[0] + up[1] + up[2]) / 3;
      const move = prev.length ? up.reduce((a, m, i) => a + Math.abs(m - prev[i]), 0) : 0;
      const cost = move + 0.4 * Math.abs(mean - center);
      if (cost < bestCost) {
        bestCost = cost;
        best = up;
      }
    }
    return best;
  }

  /** Nota MIDI da melodia soando neste passo do compasso (se houver). */
  private melodyAt(bar: number, s: number): number | undefined {
    const n = this.song.bars[bar % SONG_BARS]?.find((x) => x.step <= s && s < x.step + x.len);
    return n ? this.midi(n.degree, 1) : undefined;
  }

  /** Percussão da luta contra o chefe: bumbo em todo tempo, caixa forte, tambores graves e viradas. */
  private battleDrums(ctx: AudioContext, spb: number, bar: number, s: number, at: number) {
    if (s % 4 === 0) this.hit(ctx, at, 'kick', 0.42);
    if (spb === 16 && (s === 14 || s === 7)) this.hit(ctx, at, 'kick', 0.3);
    if (s === 0 || (spb === 16 && s === 8)) this.hit(ctx, at, 'taiko', 0.35);
    if (spb === 16 ? s === 4 || s === 12 : s === 4 || s === 8) this.hit(ctx, at, 'snare', 0.26);
    if (s % 2 === 0) this.hit(ctx, at, 'hat', s % 4 === 2 ? 0.07 : 0.04);
    if (bar % 4 === 0 && s === 0) this.hit(ctx, at, 'crash', 0.1);
    // virada de tambores a cada 4 compassos
    if (bar % 4 === 3 && s >= spb / 2 && s % 2 === 0) this.hit(ctx, at, 'tom', 0.24, 1.5 - (s - spb / 2) * 0.12);
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
export const melodyOf = (id: string) => compose(TRACKS[id]).bars;
