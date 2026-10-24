// Perigos espalhados pelo mapa: árvores bravas (atacam quem chega perto, com aviso) e armadilhas
// (uma placa de pedra com runa: pisou, acontece algo aleatório, bom ou ruim).
import Phaser from 'phaser';
import { warnCircle } from './telegraph';
import { ENEMIES } from '../data/enemies';
import type { GameScene } from '../scenes/GameScene';
import { sfx } from './sfx';

/** Árvore brava: alcance (px), aviso (s), tempo até atacar de novo (s) e dano (em dano de contato). */
const TREE = { reach: 56, windup: 0.8, cooldown: 2.6, damage: 1.4 };

/** Armadilha: raio para pisar (px) e quantas aparecem por trecho do mapa (chance). */
export const TRAP = { radius: 14, chance: 0.14 };

/** Efeitos da armadilha (sorteio igual). */
type TrapEffect = 'boom' | 'teleport' | 'ambush' | 'treasure' | 'snare' | 'heal' | 'lightning' | 'curse';
const EFFECTS: TrapEffect[] = ['boom', 'teleport', 'ambush', 'treasure', 'snare', 'heal', 'lightning', 'curse'];
const EFFECT_TEXT: Record<TrapEffect, [string, string]> = {
  boom: ['ARMADILHA: EXPLOSÃO!', '#ff9a5a'],
  teleport: ['ARMADILHA: TELETRANSPORTE!', '#d6a6ff'],
  ambush: ['ARMADILHA: EMBOSCADA!', '#ff6a5a'],
  treasure: ['ARMADILHA? TESOURO!', '#ffd86a'],
  snare: ['ARMADILHA: PRESO!', '#f4f4ff'],
  heal: ['RUNA DE CURA!', '#8cf08a'],
  lightning: ['RUNA DE RAIOS!', '#73eff7'],
  curse: ['ARMADILHA: MALDIÇÃO!', '#b060ff'],
};

/** Textura da placa de armadilha (desenhada uma vez): pedra redonda com uma runa que brilha. */
export function trapTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('trap')) return;
  const g = scene.make.graphics({}, false);
  const r = 28;
  g.fillStyle(0x000000, 0.25).fillEllipse(r, r + 4, r * 2, r * 1.5);
  g.fillStyle(0x6a6878, 1).fillEllipse(r, r, r * 1.9, r * 1.4);
  g.fillStyle(0x8a889a, 1).fillEllipse(r, r - 3, r * 1.6, r * 1.1);
  g.lineStyle(3, 0xd6a6ff, 1);
  g.strokeEllipse(r, r - 3, r * 1.1, r * 0.75);
  g.lineBetween(r - 9, r - 3, r + 9, r - 3);
  g.lineBetween(r, r - 11, r, r + 5);
  g.lineBetween(r - 6, r - 9, r + 6, r + 3);
  g.generateTexture('trap', r * 2, r * 2);
  g.destroy();
}

export class MapHazards {
  /** armadilhas já acionadas (o trecho do mapa pode ser recriado ao voltar) */
  private used = new Set<string>();

  constructor(private sc: GameScene) {}

  update(trees: Phaser.GameObjects.Image[], traps: Phaser.GameObjects.Image[]) {
    this.updateTrees(trees);
    this.updateTraps(traps);
  }

  isUsed(key: string) {
    return this.used.has(key);
  }

  // ---------- Árvores bravas ----------

  private updateTrees(trees: Phaser.GameObjects.Image[]) {
    const sc = this.sc;
    const t = sc.elapsed;
    const p = sc.player;
    for (const tree of trees) {
      if (!tree.active) continue;
      const swingAt = (tree.getData('swingAt') as number) ?? 0;
      if (swingAt) {
        if (t < swingAt) continue;
        tree.setData('swingAt', 0);
        this.swing(tree);
        continue;
      }
      if (t < ((tree.getData('ready') as number) ?? 0)) continue;
      const dx = p.x - tree.x;
      const dy = p.y - tree.y;
      if (dx * dx + (dy / 0.8) ** 2 > TREE.reach * TREE.reach) continue;
      // aviso: a árvore treme e o chão em volta fica vermelho
      tree.setData('swingAt', t + TREE.windup);
      tree.setData('ready', t + TREE.windup + TREE.cooldown);
      warnCircle(sc, tree.x, tree.y, TREE.reach, 0xff3020, TREE.windup);
      sc.tweens.add({ targets: tree, angle: { from: -4, to: 4 }, duration: 80, yoyo: true, repeat: Math.floor((TREE.windup * 1000) / 160) - 1, onComplete: () => tree.setAngle(0) });
    }
  }

  /** A árvore golpeia com os galhos: fere quem está na área (herói e inimigos). */
  private swing(tree: Phaser.GameObjects.Image) {
    const sc = this.sc;
    const p = sc.player;
    const side = p.x < tree.x ? -1 : 1;
    sc.tweens.add({ targets: tree, angle: side * 16, duration: 110, yoyo: true, ease: 'Quad.Out' });
    sc.impact(tree.x + side * 24, tree.y - 20, 0x9a8aa8, 1.4);
    sfx('hit');
    const dx = p.x - tree.x;
    const dy = p.y - tree.y;
    if (dx * dx + (dy / 0.8) ** 2 < TREE.reach * TREE.reach) {
      sc.hurtPlayer(sc.enemyDamage(10) * TREE.damage);
    }
    sc.queryEnemies(tree.x, tree.y, TREE.reach + 10, (e) => {
      if (e.active && !e.boss && (e.x - tree.x) ** 2 + ((e.y - tree.y) / 0.8) ** 2 < TREE.reach * TREE.reach) sc.elementalDamage(e, e.maxHp * 0.5, '#c8b8d8');
    });
  }

  // ---------- Armadilhas ----------

  private updateTraps(traps: Phaser.GameObjects.Image[]) {
    const sc = this.sc;
    const p = sc.player;
    for (const trap of traps) {
      if (!trap.active || !trap.visible) continue;
      if ((p.x - trap.x) ** 2 + (p.y - trap.y) ** 2 > TRAP.radius * TRAP.radius) continue;
      this.used.add(trap.getData('trapKey') as string);
      trap.setVisible(false);
      this.trigger(trap.x, trap.y);
    }
  }

  private trigger(x: number, y: number) {
    const sc = this.sc;
    const p = sc.player;
    const fx = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
    const [label, color] = EFFECT_TEXT[fx];
    sc.floatText(p.x, p.y - 26, label, color, true);
    sc.impact(x, y, parseInt(color.slice(1), 16), 1.6);
    switch (fx) {
      case 'boom': {
        // explode: fere o herói e, muito mais, os inimigos em volta
        const r = 70;
        sc.elements.vfx('vfx_explosion', x, y + r * 0.4, r * 2, [[0, 0.04], [1, 0.06], [2, 0.12], [3, 0.28]]);
        sfx('boom');
        sc.hurtPlayer(sc.stats.maxHp * 0.15);
        sc.queryEnemies(x, y, r + 16, (e) => {
          if (e.active && (e.x - x) ** 2 + (e.y - y) ** 2 < (r + e.radius) ** 2) sc.elementalDamage(e, e.boss ? e.maxHp * 0.03 : e.maxHp * 2, '#ff9a5a');
        });
        return;
      }
      case 'teleport': {
        const a = Math.random() * Math.PI * 2;
        p.x += Math.cos(a) * 220;
        p.y += Math.sin(a) * 180;
        sc.impact(p.x, p.y, 0xd6a6ff, 1.8);
        sfx('whoosh');
        return;
      }
      case 'ambush': {
        const pool = sc.stage.waves[Math.min(sc.stage.waves.length - 1, Math.floor(sc.elapsed / 60))].pool;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          sc.spawnEnemy(ENEMIES[pool[i % pool.length]], p.x + Math.cos(a) * 120, p.y + Math.sin(a) * 100);
        }
        sfx('boss');
        return;
      }
      case 'treasure':
        for (let i = 0; i < 14; i++) sc.dropPickup('coin', x + Phaser.Math.Between(-26, 26), y + Phaser.Math.Between(-20, 20), 2 * sc.rewardScale());
        sfx('levelup');
        return;
      case 'snare':
        sc.webUntil = sc.elapsed + 2.5;
        return;
      case 'heal':
        sc.hp = Math.min(sc.stats.maxHp, sc.hp + sc.stats.maxHp * 0.25);
        sfx('levelup');
        return;
      case 'lightning':
        // raios nos inimigos mais próximos
        for (const e of sc.nearestEnemies(p.x, p.y, 8, 260)) {
          sc.weapons.drawBolt(e.x, e.y, sc.cameras.main.worldView.y - 10, true);
          sc.elementalDamage(e, e.boss ? e.maxHp * 0.02 : e.maxHp * 1.5, '#73eff7');
        }
        sfx('zap');
        return;
      case 'curse':
        sc.cursedUntil = Math.max(sc.cursedUntil, sc.elapsed + 15);
        sfx('boss');
        return;
    }
  }
}
