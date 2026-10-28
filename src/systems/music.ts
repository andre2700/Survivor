// Música: trilhas gravadas (geradas com o Lyria, ver scripts/gen-music.mjs e scripts/music-prep.mjs),
// uma por fase, uma para o menu, uma para o final e quatro de chefe. O arquivo toca em streaming
// (elemento <audio>, sem carregar a música inteira na memória) e passa pelo WebAudio para o volume,
// o abafado da pausa e o compressor comum com os efeitos. Ao chegar perto do final, a música volta
// ao ponto de repetição com um cruzamento suave; chefe na tela troca para a trilha de chefe (e volta).
// Vitória e derrota têm vinhetas curtas sintetizadas.
import { audioOut } from './sfx';
import { MUSIC_LOOPS } from './musicLoops';
import { MUSIC_URLS as URLS } from './musicUrls';

/** Trilhas que existem (menu, fases, final e chefes). */
export const MUSIC_IDS = Object.keys(URLS);

/** Trilha de chefe de cada fase. */
const BOSS_TRACK: Record<string, string> = {
  clareira: 'chefe_natureza', outono: 'chefe_natureza', pantano: 'chefe_natureza',
  dunas: 'chefe_fogo', vulcao: 'chefe_fogo',
  sombria: 'chefe_gelo', pico: 'chefe_gelo', ruinas: 'chefe_gelo',
  cidadela: 'chefe_final',
};
export const bossTrackOf = (id: string) => BOSS_TRACK[id];

/** Volume da música (os efeitos ficam por cima). */
const MUSIC_VOL = 0.45;
/** Cruzamento entre o fim e o começo, e na troca de trilha (s). */
const XF = 3;
/** Agudos abafados na pausa. */
const MUFFLED_HZ = 1200;

/** Um tocador (<audio> ligado ao WebAudio). São dois, para cruzar uma trilha com a outra. */
interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
  id: string;
}

class Player {
  private decks: Deck[] = [];
  private active: Deck | null = null;
  private bus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  /** trilha pedida (a da tela/fase) e a que está tocando (pode ser a do chefe) */
  private trackId = '';
  private playing = '';
  private battle = false;
  private enabled = true;
  private duck = 1;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop(true);
    else this.retry();
  }

  /** Toca a trilha (continua se já for a mesma). */
  play(id: string) {
    this.trackId = id;
    this.update();
  }

  /** Para a trilha (com um fim suave). */
  stop(keepId = false) {
    if (!keepId) this.trackId = '';
    this.playing = '';
    for (const d of this.decks) this.fade(d, 0, 0.6, true);
    this.active = null;
  }

  /** Áudio liberado agora (primeiro toque): começa a trilha que estava esperando. */
  retry() {
    if (this.active && !this.active.el.paused) return;
    this.playing = '';
    this.update();
  }

  setBattle(on: boolean) {
    this.battle = on;
    this.update();
  }

  /** Abaixa e abafa a música (pausa) ou volta ao normal. */
  setDuck(k: number) {
    this.duck = k;
    const out = audioOut();
    if (!out || !this.bus || !this.filter) return;
    const t = out.ctx.currentTime;
    this.bus.gain.setTargetAtTime(MUSIC_VOL * k, t, 0.2);
    this.filter.frequency.setTargetAtTime(k < 1 ? MUFFLED_HZ : 20000, t, 0.2);
  }

  /** Confere qual trilha deveria tocar e troca (cruzando) se for outra. */
  private update() {
    if (!this.enabled || !this.trackId) return;
    const want = (this.battle && BOSS_TRACK[this.trackId]) || this.trackId;
    if (want === this.playing || !URLS[want]) return;
    if (!this.setup()) return;
    this.playing = want;
    this.start(want, 0);
  }

  /** Cria a saída (volume e filtro) e os dois tocadores, na primeira vez com o áudio liberado. */
  private setup() {
    if (this.bus) return true;
    const out = audioOut();
    if (!out) return false;
    const { ctx, master } = out;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.duck < 1 ? MUFFLED_HZ : 20000;
    this.bus = ctx.createGain();
    this.bus.gain.value = MUSIC_VOL * this.duck;
    this.bus.connect(this.filter).connect(master);
    for (let i = 0; i < 2; i++) {
      const el = new Audio();
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(this.bus);
      this.decks.push({ el, gain, id: '' });
    }
    // aba escondida ou app em segundo plano: pausa (o contexto do áudio também é suspenso)
    document.addEventListener('visibilitychange', () => {
      const el = this.active?.el;
      if (!el) return;
      if (document.hidden) el.pause();
      else if (this.playing) void el.play().catch(() => {});
    });
    window.setInterval(() => this.tick(), 100);
    return true;
  }

  /** Começa `id` no tocador livre, a partir de `at` segundos, cruzando com o que estava tocando. */
  private start(id: string, at: number) {
    const next = this.decks.find((d) => d !== this.active)!;
    const prev = this.active;
    next.el.pause();
    if (next.id !== id) {
      next.el.src = URLS[id];
      next.id = id;
    }
    next.el.currentTime = at;
    next.gain.gain.cancelScheduledValues(0);
    next.gain.gain.value = 0;
    void next.el.play().catch(() => {
      // sem permissão para tocar ainda: tenta de novo no primeiro toque (retry)
      if (this.active === next) this.playing = '';
    });
    this.fade(next, 1, prev ? XF : 1.2);
    if (prev) this.fade(prev, 0, XF, true);
    this.active = next;
  }

  private fade(d: Deck, to: number, secs: number, pause = false) {
    const out = audioOut();
    if (!out) return;
    const t = out.ctx.currentTime;
    const g = d.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + secs);
    if (pause) {
      window.setTimeout(() => {
        if (d !== this.active) d.el.pause();
      }, secs * 1000 + 100);
    }
  }

  /** Perto do final: volta ao ponto de repetição, cruzando. */
  private tick() {
    const d = this.active;
    if (!d || !this.playing || d.el.paused) return;
    const loop = MUSIC_LOOPS[d.id];
    const end = loop?.end ?? (d.el.duration || Infinity) - XF;
    if (d.el.currentTime >= end) this.start(d.id, loop?.start ?? 0);
  }
}

const player = new Player();
// conferência (scripts): o tocador fica acessível só no modo de desenvolvimento
if (import.meta.env.DEV) (window as unknown as { __music: Player }).__music = player;

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

/** Trilha de chefe (chefe na tela) ou volta à da fase. */
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
  g.gain.value = 0.63;
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
