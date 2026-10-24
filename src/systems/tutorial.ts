// Tutorial da primeira partida: dicas curtas, uma de cada vez, que somem quando o jogador faz o que
// pedem (andar, subir de nível, escolher a carta) ou depois de alguns segundos (avisos e chefes).
// O passo fica salvo: se a partida acabar no meio, continua na próxima. 99 = concluído.
import type { GameScene } from '../scenes/GameScene';
import { loadSave, writeSave } from './save';

export const TUTORIAL_DONE = 99;

interface Step {
  text: string;
  /** mostra a mão arrastando (passo de andar) */
  hand?: boolean;
  /** só aparece a partir deste tempo de partida (s) */
  from?: number;
  /** some sozinho depois de tantos segundos na tela */
  hold?: number;
}

export const TUTORIAL_STEPS: Step[] = [
  { text: 'Arraste o dedo em qualquer lugar da tela para andar', hand: true },
  { text: 'Seu herói ataca sozinho! Pegue as gemas azuis para subir de nível' },
  { text: 'Escolha uma carta: arma nova ou melhoria. Vale combinar elementos!' },
  { text: 'Círculos e faixas vermelhas no chão = golpe chegando. Saia de cima!', from: 40, hold: 6 },
  { text: 'Aos 5, 10 e 15 minutos chega um chefe. Vença para ganhar baús, itens e ovos!', from: 70, hold: 7 },
];

export class Tutorial {
  step: number;
  private shownAt = -1;
  private moved = 0;
  private last = { x: 0, y: 0 };

  constructor(private sc: GameScene) {
    this.step = loadSave().tutorial;
    this.last = { x: sc.player.x, y: sc.player.y };
  }

  get active() {
    return this.step < TUTORIAL_STEPS.length;
  }

  private save() {
    const s = loadSave();
    s.tutorial = this.active ? this.step : TUTORIAL_DONE;
    writeSave(s);
  }

  private next() {
    this.step++;
    this.shownAt = -1;
    this.sc.events.emit('tutorial', null);
    this.save();
  }

  update() {
    if (!this.active) return;
    const sc = this.sc;
    const st = TUTORIAL_STEPS[this.step];
    const t = sc.elapsed;
    if (st.from !== undefined && t < st.from) return;
    if (this.shownAt < 0) {
      this.shownAt = t;
      sc.events.emit('tutorial', st);
    }
    if (this.step === 0) {
      const p = sc.player;
      this.moved += Math.hypot(p.x - this.last.x, p.y - this.last.y);
      this.last = { x: p.x, y: p.y };
      if (this.moved > 140) this.next();
    } else if (st.hold && t - this.shownAt > st.hold) this.next();
  }

  /** Subiu de nível (passo 1) e escolheu a carta (passo 2). */
  onLevelUp() {
    // subiu de nível antes de terminar os passos de andar e das gemas: vai direto para a carta
    if (this.step <= 1) {
      this.step = 1;
      this.next();
    }
  }

  onCardPicked() {
    if (this.step === 2) this.next();
  }

  /** Fim da partida: quem já passou da escolha da carta não precisa ver o tutorial de novo. */
  onRunEnd() {
    if (this.active && this.step >= 3) {
      this.step = TUTORIAL_DONE;
      this.save();
    }
  }
}
