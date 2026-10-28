// O que certas criaturas fazem ao morrer (ou quase): explodem (com aviso), ficam furiosas com pouca
// vida, curam os aliados, se dividem, uivam e apressam a matilha, soltam esporos venenosos, estouram em
// estilhaços de gelo ou se levantam mais uma vez. Tudo que fere o herói tem aviso ou dá para desviar.
import Phaser from 'phaser';
import { frameName } from '../art/textures';
import { ENEMIES, type EnemyId } from '../data/enemies';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import { warnCircle } from './telegraph';
import { sfx } from './sfx';

export type DeathFxKind = 'burst' | 'enrage' | 'heal' | 'split' | 'howl' | 'spores' | 'shards' | 'revive';

/** Números de cada efeito. */
const FX = {
  burst: { radius: 42, warn: 0.6, hero: 1.6, foes: 1.2 },
  enrage: { at: 0.3, speed: 1.7, damage: 1.4 },
  heal: { radius: 90, amount: 0.25 },
  split: { hp: 0.35, scale: 0.68 },
  howl: { radius: 150, speed: 1.3 },
  spores: { radius: 38, time: 3.5, tick: 0.5, hero: 0.03 },
  shards: { count: 6, damage: 1 },
  revive: { delay: 1.4, hp: 0.5 },
};

interface Cloud {
  x: number;
  y: number;
  until: number;
  next: number;
  img: Phaser.GameObjects.Image;
}

export class DeathFx {
  private clouds: Cloud[] = [];

  constructor(private sc: GameScene) {}

  /** Inimigo ferido: os furiosos, com pouca vida, ficam mais rápidos e fortes até morrer. */
  onHurt(e: Enemy) {
    if (DEATH_FX[e.def.id] !== 'enrage' || e.enraged || e.hp <= 0 || e.hp > e.maxHp * FX.enrage.at) return;
    e.enraged = true;
    e.speed *= FX.enrage.speed;
    e.damage *= FX.enrage.damage;
    e.baseTint = 0xff6a5a;
    e.setTint(e.baseTint);
    this.sc.floatText(e.x, e.y - 20 * e.baseScale, 'FÚRIA!', '#ff6a5a', true);
    this.sc.impact(e.x, e.y, 0xff5a4a, 0.9);
  }

  /** Inimigo morreu (posição e criatura antes de o objeto ser reaproveitado). */
  onDeath(e: Enemy) {
    const kind = DEATH_FX[e.def.id];
    if (!kind || e.boss) return;
    const sc = this.sc;
    const { x, y } = e;
    const def = e.def;
    switch (kind) {
      case 'burst': {
        // aviso no chão e a explosão logo depois: fere o herói e os inimigos em volta
        const r = FX.burst.radius;
        const dmg = e.damage;
        warnCircle(sc, x, y, r, 0xff7a2a, FX.burst.warn);
        sc.time.delayedCall(FX.burst.warn * 1000, () => {
          if (sc.state === 'over') return;
          sc.elements.vfx('vfx_explosion', x, y + r * 0.4, r * 2, [[0, 0.04], [1, 0.06], [2, 0.12], [3, 0.28]]);
          sfx('boom');
          const p = sc.player;
          if ((p.x - x) ** 2 + ((p.y - y) / 0.8) ** 2 < (r + 6) ** 2) sc.hurtPlayer(dmg * FX.burst.hero);
          sc.queryEnemies(x, y, r + 16, (o) => {
            if (o.active && !o.boss && (o.x - x) ** 2 + (o.y - y) ** 2 < (r + o.radius) ** 2) sc.elementalDamage(o, dmg * FX.burst.foes * 4, '#ff9a5a');
          });
        });
        return;
      }
      case 'heal': {
        // um anel verde: os aliados em volta recuperam parte da vida
        const r = FX.heal.radius;
        this.ring(x, y, r, 0x8cf08a);
        sc.queryEnemies(x, y, r, (o) => {
          if (!o.active || o.boss || o.def.object || (o.x - x) ** 2 + (o.y - y) ** 2 > r * r) return;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * FX.heal.amount);
          sc.impact(o.x, o.y - 6, 0x8cf08a, 0.5);
        });
        return;
      }
      case 'split': {
        if (e.revived) return;
        for (const side of [-1, 1]) {
          const m = sc.spawnEnemy(def, x + side * 12, y);
          if (!m) continue;
          m.revived = true;
          m.maxHp = Math.max(1, Math.round(m.maxHp * FX.split.hp));
          m.hp = m.maxHp;
          m.baseScale *= FX.split.scale;
          m.radius *= FX.split.scale;
          m.alpha = 1;
        }
        return;
      }
      case 'howl': {
        // uivo: a matilha em volta fica mais rápida (uma vez por inimigo)
        const r = FX.howl.radius;
        this.ring(x, y, r, 0xffc070);
        sc.floatText(x, y - 20, 'AUUU!', '#ffc070', false);
        sc.queryEnemies(x, y, r, (o) => {
          if (!o.active || o.boss || o.hasted || (o.x - x) ** 2 + (o.y - y) ** 2 > r * r) return;
          o.hasted = true;
          o.speed *= FX.howl.speed;
        });
        return;
      }
      case 'spores': {
        // nuvem de esporos: fere o herói enquanto ele estiver dentro
        const img = sc.add.image(x, y, 'atlas', frameName('glow')).setTint(0x9ad050).setAlpha(0).setDepth(LAYER.groundFx).setScale((FX.spores.radius * 2.6) / 64);
        sc.tweens.add({ targets: img, alpha: 0.55, duration: 300 });
        this.clouds.push({ x, y, until: sc.elapsed + FX.spores.time, next: sc.elapsed + 0.4, img });
        return;
      }
      case 'shards': {
        // estilhaços de gelo em todas as direções (lentos: dá para desviar)
        for (let i = 0; i < FX.shards.count; i++) {
          const a = (i / FX.shards.count) * Math.PI * 2 + Math.random() * 0.3;
          sc.enemySkills.bossShot(e, 'spit', a, e.damage * FX.shards.damage, 0xbff0ff, 140);
        }
        sfx('freeze');
        return;
      }
      case 'revive': {
        // os ossos tremem e ele se levanta uma vez, com metade da vida
        if (e.revived) return;
        const glow = sc.add.image(x, y, 'atlas', frameName('glow')).setTint(0x9af07a).setAlpha(0.7).setDepth(LAYER.fx).setScale(0.6);
        sc.tweens.add({ targets: glow, scale: 1, alpha: 0.2, duration: FX.revive.delay * 1000, yoyo: false });
        sc.time.delayedCall(FX.revive.delay * 1000, () => {
          glow.destroy();
          if (sc.state === 'over') return;
          const m = sc.spawnEnemy(ENEMIES[def.id], x, y);
          if (!m) return;
          m.revived = true;
          m.hp = m.maxHp * FX.revive.hp;
          m.alpha = 0.4;
          sc.impact(x, y, 0x9af07a, 0.9);
          sc.floatText(x, y - 20, 'LEVANTOU!', '#9af07a', false);
        });
        return;
      }
    }
  }

  update() {
    if (!this.clouds.length) return;
    const sc = this.sc;
    const t = sc.elapsed;
    const p = sc.player;
    this.clouds = this.clouds.filter((c) => {
      if (t >= c.until) {
        sc.tweens.add({ targets: c.img, alpha: 0, duration: 300, onComplete: () => c.img.destroy() });
        return false;
      }
      if (t >= c.next) {
        c.next = t + FX.spores.tick;
        if ((p.x - c.x) ** 2 + ((p.y - c.y) / 0.8) ** 2 < FX.spores.radius ** 2) sc.hurtPlayer(sc.stats.maxHp * FX.spores.hero);
      }
      return true;
    });
  }

  private ring(x: number, y: number, r: number, color: number) {
    const g = this.sc.add.graphics().setDepth(LAYER.fx);
    this.sc.tweens.addCounter({
      from: 0.2, to: 1, duration: 380,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 1;
        g.clear().lineStyle(3, color, 1 - k).strokeEllipse(x, y, r * 2 * k, r * 1.6 * k);
      },
      onComplete: () => g.destroy(),
    });
  }
}

/** Criaturas e o que fazem ao morrer (as outras não fazem nada). */
export const DEATH_FX: Partial<Record<EnemyId, DeathFxKind>> = {
  slime_magma: 'burst', fire_imp: 'burst',
  orc: 'enrage', werewolf: 'enrage', yeti: 'enrage', demon_brute: 'enrage',
  frog_shaman: 'heal', lizard_shaman: 'heal', witch: 'heal', demon_witch: 'heal',
  slime_spit: 'split',
  wolf: 'howl', hellhound: 'howl',
  sporeshroom: 'spores',
  snow_golem: 'shards',
  skeleton: 'revive', zombie: 'revive',
};
