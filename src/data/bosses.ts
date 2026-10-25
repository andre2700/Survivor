// Chefes (Marco 3+): cada fase tem três, um no fim de cada terço da partida (início, meio e final).
// Cada chefe tem um repertório de golpes com aviso, fica furioso com pouca vida e o chefe final tem
// uma segunda fase: quando parece derrotado, ele se transforma e volta com a vida cheia de novo.
import type { EnemyId } from './enemies';

/**
 * Golpes de chefe. Todos têm aviso antes (anel, faixa, mira ou brilho) para o jogador poder reagir.
 * - slam: para e golpeia a área à frente (anel no chão)
 * - leap: salta até onde o herói está (o círculo de pouso aparece antes) e o pouso empurra e fere
 * - charge: corre em linha reta (faixa no chão), `times` vezes seguidas
 * - volley: leque de tiros mirados no herói
 * - nova: anel de tiros para todos os lados
 * - rain: chuva de golpes do céu (raios, meteoros, raízes) em círculos marcados em volta do herói
 * - summon: chama ajudantes em volta dele
 * - blink: some e reaparece perto do herói (e logo ataca)
 */
export type BossMoveKind = 'slam' | 'leap' | 'charge' | 'volley' | 'nova' | 'summon' | 'rain' | 'blink';

/** Tiros dos golpes `volley` e `nova` (os mesmos dos inimigos à distância e conjuradores). */
export type BossShot = 'spit' | 'fireball' | 'wave' | 'tornado' | 'web';

export interface BossMove {
  kind: BossMoveKind;
  /** chance relativa de ser escolhido */
  weight: number;
  /** tempo mínimo até repetir este golpe (s) */
  cooldown: number;
  /** volley/nova: tiro, quantidade e cor (gosma) */
  shot?: BossShot;
  count?: number;
  color?: number;
  /** charge: quantas investidas seguidas; leap: quantos saltos seguidos */
  times?: number;
  /** summon: quem ele chama e quantos */
  minions?: EnemyId[];
  /** rain: aparência de cada golpe do céu */
  look?: 'bolt' | 'meteor' | 'spike';
  /** dano em múltiplos do dano de contato */
  damage?: number;
}

export interface BossPhase {
  moves: BossMove[];
  /** multiplicador de velocidade de andar */
  speed: number;
  /** pausa entre golpes (s) */
  pause: number;
}

export interface BossDef {
  /** fase 1 e, nos chefes finais, a fase 2 (depois da transformação) */
  phases: [BossPhase] | [BossPhase, BossPhase];
  /** fica furioso abaixo desta fração de vida (mais rápido e golpes mais seguidos) */
  enrageAt: number;
  /** nome na fase 2 */
  phase2Name?: string;
  /** cor da fase 2 */
  phase2Tint?: number;
}

const slam = (weight = 2): BossMove => ({ kind: 'slam', weight, cooldown: 3, damage: 1.5 });
const leap = (weight = 2, times = 1): BossMove => ({ kind: 'leap', weight, cooldown: 6, times, damage: 1.6 });
const charge = (weight = 2, times = 1): BossMove => ({ kind: 'charge', weight, cooldown: 5, times, damage: 1.4 });
const summon = (minions: EnemyId[], count: number, weight = 1): BossMove => ({ kind: 'summon', weight, cooldown: 14, minions, count });

export const BOSSES: Partial<Record<EnemyId, BossDef>> = {
  // ---------- Clareira Ensolarada ----------
  king_slime: {
    enrageAt: 0.4,
    phases: [{ speed: 1, pause: 1.6, moves: [leap(3), summon(['slime', 'slime_water'], 5), slam(1)] }],
  },
  alpha_wolf: {
    enrageAt: 0.5,
    phases: [{ speed: 1, pause: 1.3, moves: [charge(3, 3), summon(['wolf'], 4), slam(1)] }],
  },
  demon: {
    enrageAt: 0.35, phase2Name: 'Demônio Desperto', phase2Tint: 0xff7a6a,
    phases: [
      { speed: 1, pause: 1.4, moves: [{ kind: 'volley', weight: 3, cooldown: 4, shot: 'fireball', count: 3, damage: 1.2 }, { kind: 'rain', weight: 2, cooldown: 8, look: 'meteor', count: 6, damage: 1.4 }, leap(2), slam(1)] },
      { speed: 1.25, pause: 0.9, moves: [{ kind: 'nova', weight: 3, cooldown: 5, shot: 'fireball', count: 10, damage: 1.2 }, { kind: 'rain', weight: 3, cooldown: 6, look: 'meteor', count: 10, damage: 1.4 }, leap(2, 2), summon(['bat', 'bat_air'], 8)] },
    ],
  },
  goblin_king: {
    enrageAt: 0.35, phase2Name: 'Rei Goblin Furioso', phase2Tint: 0xff9a7a,
    phases: [
      { speed: 1, pause: 1.5, moves: [leap(3), slam(2), charge(2, 1), summon(['goblin'], 6)] },
      { speed: 1.25, pause: 1, moves: [leap(3, 2), charge(3, 3), { kind: 'rain', weight: 2, cooldown: 7, look: 'spike', count: 7, damage: 1.3 }, summon(['goblin', 'wolf'], 6)] },
    ],
  },
  // ---------- Bosque Outonal ----------
  magma_lord: {
    enrageAt: 0.4,
    phases: [{ speed: 1, pause: 1.5, moves: [{ kind: 'volley', weight: 3, cooldown: 3.5, shot: 'fireball', count: 3, damage: 1.2 }, { kind: 'nova', weight: 2, cooldown: 7, shot: 'spit', count: 12, color: 0xff6a2a, damage: 1 }, leap(2)] }],
  },
  goblin_warlord: {
    enrageAt: 0.5,
    phases: [{ speed: 1, pause: 1.3, moves: [charge(3, 2), summon(['slime_bomb'], 5, 2), { kind: 'volley', weight: 2, cooldown: 4, shot: 'spit', count: 5, color: 0xc0c8d8, damage: 1 }] }],
  },
  orc_chief: {
    enrageAt: 0.35, phase2Name: 'Chefe Orc Enfurecido', phase2Tint: 0xff8a6a,
    phases: [
      { speed: 1, pause: 1.4, moves: [leap(3), charge(2, 2), slam(2), summon(['orc', 'goblin_earth'], 4)] },
      { speed: 1.3, pause: 0.8, moves: [leap(3, 3), charge(3, 4), { kind: 'rain', weight: 2, cooldown: 7, look: 'spike', count: 8, damage: 1.4 }, summon(['orc'], 5)] },
    ],
  },
  // ---------- Pântano Enevoado ----------
  croc_king: {
    enrageAt: 0.45,
    phases: [{ speed: 1, pause: 1.4, moves: [charge(4, 3), summon(['frog', 'croc'], 4), slam(1)] }],
  },
  grand_frog_shaman: {
    enrageAt: 0.5,
    phases: [{ speed: 1, pause: 1.4, moves: [{ kind: 'volley', weight: 3, cooldown: 4, shot: 'wave', count: 3, damage: 1.2 }, { kind: 'nova', weight: 2, cooldown: 8, shot: 'wave', count: 8, damage: 1.1 }, summon(['frog', 'frog_shaman'], 4), { kind: 'blink', weight: 1, cooldown: 8 }] }],
  },
  frog_king: {
    enrageAt: 0.35, phase2Name: 'Rei Sapo Furioso', phase2Tint: 0xa0ff8a,
    phases: [
      { speed: 1, pause: 1.4, moves: [leap(4), { kind: 'volley', weight: 2, cooldown: 4, shot: 'wave', count: 3, damage: 1.2 }, summon(['frog', 'croc'], 5)] },
      { speed: 1.25, pause: 0.9, moves: [leap(4, 3), { kind: 'nova', weight: 3, cooldown: 5, shot: 'wave', count: 10, damage: 1.2 }, { kind: 'rain', weight: 2, cooldown: 7, look: 'spike', count: 8, damage: 1.3 }, summon(['croc', 'frog_shaman'], 5)] },
    ],
  },
  // ---------- Dunas Escaldantes ----------
  colossal_worm: {
    enrageAt: 0.45,
    phases: [{ speed: 1, pause: 1.4, moves: [{ kind: 'rain', weight: 3, cooldown: 5, look: 'spike', count: 7, damage: 1.4 }, charge(2, 2), summon(['sandworm', 'scorpion'], 4), { kind: 'blink', weight: 2, cooldown: 6 }] }],
  },
  lizard_elder: {
    enrageAt: 0.5,
    phases: [{ speed: 1, pause: 1.4, moves: [{ kind: 'volley', weight: 3, cooldown: 4, shot: 'tornado', count: 3, damage: 1 }, { kind: 'nova', weight: 2, cooldown: 7, shot: 'spit', count: 14, color: 0xe8e070, damage: 0.9 }, summon(['lizard_shaman', 'cactus_spitter'], 4), { kind: 'blink', weight: 1, cooldown: 8 }] }],
  },
  scorpion_emperor: {
    enrageAt: 0.35, phase2Name: 'Imperador Escorpião Venenoso', phase2Tint: 0xd890ff,
    phases: [
      { speed: 1, pause: 1.3, moves: [charge(3, 2), { kind: 'volley', weight: 3, cooldown: 4, shot: 'spit', count: 5, color: 0xb060e0, damage: 1.2 }, leap(1), slam(2)] },
      { speed: 1.3, pause: 0.8, moves: [charge(3, 3), { kind: 'nova', weight: 3, cooldown: 5, shot: 'spit', count: 16, color: 0xb060e0, damage: 1.1 }, { kind: 'rain', weight: 2, cooldown: 7, look: 'spike', count: 9, damage: 1.4 }, summon(['scorpion', 'sandworm'], 5)] },
    ],
  },
  // ---------- Floresta Sombria ----------
  werewolf_alpha: {
    enrageAt: 0.5,
    phases: [{ speed: 1, pause: 1.2, moves: [leap(4, 2), charge(2, 2), summon(['werewolf'], 4)] }],
  },
  elder_witch: {
    enrageAt: 0.5,
    phases: [{ speed: 1, pause: 1.3, moves: [{ kind: 'rain', weight: 3, cooldown: 5, look: 'bolt', count: 7, damage: 1.3 }, { kind: 'volley', weight: 2, cooldown: 4, shot: 'web', count: 5, damage: 0.8 }, summon(['wisp'], 6), { kind: 'blink', weight: 2, cooldown: 6 }] }],
  },
  ancient_ent: {
    enrageAt: 0.35, phase2Name: 'Ent Ancião Desperto', phase2Tint: 0xd070ff,
    phases: [
      { speed: 1, pause: 1.4, moves: [{ kind: 'rain', weight: 3, cooldown: 5, look: 'spike', count: 8, damage: 1.4 }, slam(2), summon(['spider', 'wisp'], 5), leap(1)] },
      { speed: 1.25, pause: 0.9, moves: [{ kind: 'rain', weight: 3, cooldown: 4, look: 'spike', count: 12, damage: 1.4 }, { kind: 'nova', weight: 3, cooldown: 5, shot: 'spit', count: 16, color: 0x9a50d0, damage: 1.1 }, leap(2, 2), summon(['werewolf', 'spider'], 5)] },
    ],
  },
  // ---------- Pico Congelado ----------
  yeti_elder: {
    enrageAt: 0.45,
    phases: [{ speed: 1, pause: 1.4, moves: [leap(3, 2), slam(2), charge(1, 2), summon(['penguin'], 6)] }],
  },
  frost_queen: {
    enrageAt: 0.5,
    phases: [{ speed: 1, pause: 1.3, moves: [{ kind: 'volley', weight: 3, cooldown: 4, shot: 'wave', count: 3, damage: 1.1 }, { kind: 'nova', weight: 2, cooldown: 7, shot: 'spit', count: 14, color: 0xbff0ff, damage: 1 }, { kind: 'rain', weight: 2, cooldown: 6, look: 'spike', count: 7, damage: 1.3 }, summon(['snow_owl'], 6), { kind: 'blink', weight: 1, cooldown: 7 }] }],
  },
  // ---------- Coração do Vulcão ----------
  salamander_queen: {
    enrageAt: 0.45,
    phases: [{ speed: 1, pause: 1.2, moves: [charge(3, 3), { kind: 'volley', weight: 2, cooldown: 4, shot: 'fireball', count: 3, damage: 1.1 }, summon(['salamander'], 8)] }],
  },
  ash_lord: {
    enrageAt: 0.5,
    phases: [{ speed: 1, pause: 1.3, moves: [{ kind: 'nova', weight: 3, cooldown: 5, shot: 'fireball', count: 10, damage: 1.1 }, { kind: 'rain', weight: 3, cooldown: 6, look: 'meteor', count: 7, damage: 1.3 }, { kind: 'blink', weight: 2, cooldown: 6 }, summon(['ember_bat'], 8)] }],
  },
  magma_titan: {
    enrageAt: 0.35, phase2Name: 'Titã Desperto', phase2Tint: 0xff9a5a,
    phases: [
      { speed: 1, pause: 1.4, moves: [slam(3), leap(2), { kind: 'rain', weight: 3, cooldown: 6, look: 'meteor', count: 8, damage: 1.4 }, { kind: 'volley', weight: 2, cooldown: 4, shot: 'fireball', count: 5, damage: 1.2 }] },
      { speed: 1.25, pause: 0.9, moves: [{ kind: 'rain', weight: 3, cooldown: 4.5, look: 'meteor', count: 14, damage: 1.4 }, { kind: 'nova', weight: 3, cooldown: 5, shot: 'fireball', count: 14, damage: 1.2 }, leap(2, 2), slam(2), summon(['magma_golem', 'lava_serpent'], 4)] },
    ],
  },
  ice_dragon: {
    enrageAt: 0.35, phase2Name: 'Dragão de Gelo Ancestral', phase2Tint: 0x8ab8ff,
    phases: [
      { speed: 1, pause: 1.4, moves: [{ kind: 'volley', weight: 3, cooldown: 4, shot: 'spit', count: 7, color: 0xbff0ff, damage: 1.1 }, leap(2), charge(2, 2), { kind: 'rain', weight: 2, cooldown: 7, look: 'spike', count: 8, damage: 1.3 }] },
      { speed: 1.25, pause: 0.9, moves: [{ kind: 'nova', weight: 3, cooldown: 5, shot: 'spit', count: 18, color: 0xbff0ff, damage: 1.1 }, { kind: 'volley', weight: 2, cooldown: 4, shot: 'wave', count: 5, damage: 1.2 }, leap(2, 2), summon(['yeti', 'snow_golem'], 5)] },
    ],
  },
};

/** Golpes do chefe surpresa (um monstro comum gigante): simples, mas com aviso e variedade. */
export const SURPRISE_BOSS: BossDef = {
  enrageAt: 0.4,
  phases: [{ speed: 1, pause: 1.6, moves: [slam(3), charge(2, 1), leap(1)] }],
};

export function bossDef(id: EnemyId): BossDef {
  return BOSSES[id] ?? SURPRISE_BOSS;
}
