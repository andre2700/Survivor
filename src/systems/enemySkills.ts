// Habilidades dos inimigos não corpo a corpo (Marco 3): à distância (cospe gosma), conjurador (a Bola
// de Fogo do herói, com nível) e explosivo (pisca e explode). Todo ataque tem aviso antes, para o
// jogador poder desviar.
import Phaser from 'phaser';
import { frameName, loopFrame } from '../art/textures';
import type { EnemySkill } from '../data/enemies';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import { sfx } from './sfx';

interface Shot {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  /** raio de acerto no herói */
  r: number;
  kind: EnemySkill['kind'];
  /** bola de fogo: explode ao chegar no ponto mirado */
  tx: number;
  ty: number;
  area: number;
}

/** Tiros inimigos ao mesmo tempo (desempenho). */
const MAX_SHOTS = 120;

export class EnemySkills {
  private shots: Shot[] = [];

  constructor(private scene: GameScene) {}

  /**
   * Nível da habilidade: o da criatura, mais a fase e o tempo de partida (um a cada 4 min).
   * Cada 3 níveis somam um projétil; a área cresce 10% por nível.
   */
  level(skill: EnemySkill) {
    return skill.level + this.scene.stageIndex + Math.floor(this.scene.elapsed / 240);
  }

  /**
   * Comportamento de um inimigo com habilidade: devolve quanto ele anda em direção ao herói
   * (1 avança, negativo recua, 0 fica parado preparando) e se anda de lado.
   */
  think(e: Enemy, d: number): { forward: number; side: number } {
    const skill = e.def.skill!;
    const t = this.scene.elapsed;
    const p = this.scene.player;
    if (e.attackPhase === 'windup') {
      if (t < e.attackTimer) {
        if (skill.kind === 'explode') {
          // pisca cada vez mais rápido e incha antes de explodir
          const k = 1 - (e.attackTimer - t) / skill.windup;
          if (Math.floor(t * (8 + k * 20)) % 2 === 0) e.setTintFill(0xffffff);
          else this.scene.restoreTint(e);
        }
        return { forward: 0, side: 0 };
      }
      e.attackPhase = 'walk';
      this.scene.restoreTint(e);
      this.release(e, skill);
      e.attackTimer = t + skill.cooldown * (0.85 + Math.random() * 0.3);
      return { forward: 0, side: 0 };
    }
    if (skill.kind === 'explode') {
      if (d < skill.range + e.radius) this.windup(e, skill, p.x, p.y);
      return { forward: 1, side: 0 };
    }
    // à distância e conjurador: chegam até o alcance, mantêm distância e andam de lado
    if (d < skill.range && t >= e.attackTimer && this.scene.cameras.main.worldView.contains(e.x, e.y)) {
      this.windup(e, skill, p.x, p.y);
      return { forward: 0, side: 0 };
    }
    if (d < skill.range * 0.6) return { forward: -0.7, side: 0 };
    if (d < skill.range) return { forward: 0.1, side: 0.45 };
    return { forward: 1, side: 0 };
  }

  private windup(e: Enemy, skill: EnemySkill, tx: number, ty: number) {
    e.attackPhase = 'windup';
    e.attackTimer = this.scene.elapsed + skill.windup;
    e.attackX = tx;
    e.attackY = ty;
    if (skill.kind === 'fireball') {
      // aviso: linha de mira e o círculo onde a bola vai cair
      const lvl = this.level(skill);
      const r = skill.radius * (1 + (lvl - 1) * 0.1);
      const g = this.scene.add.graphics().setDepth(LAYER.groundFx + 1);
      g.lineStyle(2, 0xff5a2a, 0.55).lineBetween(e.x, e.y, tx, ty);
      g.lineStyle(2, 0xff5a2a, 0.9).strokeEllipse(tx, ty, r * 2, r * 1.5);
      g.fillStyle(0xff5a2a, 0.18).fillEllipse(tx, ty, r * 2, r * 1.5);
      this.scene.tweens.add({ targets: g, alpha: { from: 0.3, to: 1 }, duration: skill.windup * 1000, onComplete: () => g.destroy() });
    } else if (skill.kind === 'spit') {
      // estufa antes de cuspir
      this.scene.tweens.add({ targets: e, scaleY: e.baseScale * 1.25, scaleX: e.baseScale * 0.85, duration: skill.windup * 900, yoyo: true });
    }
  }

  private release(e: Enemy, skill: EnemySkill) {
    const dmg = e.damage * skill.damage;
    if (skill.kind === 'explode') {
      this.explode(e.x, e.y, skill.radius, dmg);
      this.scene.elementalDamage(e, e.hp + 1, '#ffffff');
      return;
    }
    const lvl = this.level(skill);
    const n = skill.kind === 'fireball' ? 1 + Math.floor((lvl - 1) / 3) : 1;
    const base = Math.atan2(e.attackY - e.y, e.attackX - e.x);
    const dist = Math.hypot(e.attackX - e.x, e.attackY - e.y);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.28;
      this.fire(e, skill, a, dist, dmg, lvl);
    }
    sfx(skill.kind === 'fireball' ? 'whoosh' : 'splash');
  }

  private fire(e: Enemy, skill: EnemySkill, angle: number, dist: number, dmg: number, lvl: number) {
    if (this.shots.length >= MAX_SHOTS) return;
    const fireball = skill.kind === 'fireball';
    const img = fireball
      ? this.scene.add.image(e.x, e.y - 6, 'atlas', frameName('fx_fireball')).setTint(0xffb08a).setScale(0.9).setRotation(angle)
      : this.scene.add.image(e.x, e.y - 6, 'atlas', frameName('glow')).setTint(0xb060e0).setScale(0.35);
    img.setDepth(LAYER.fx);
    this.shots.push({
      img, vx: Math.cos(angle) * skill.speed, vy: Math.sin(angle) * skill.speed, life: fireball ? dist / skill.speed : 2.4,
      damage: dmg, r: fireball ? 8 : skill.radius, kind: skill.kind,
      tx: e.x + Math.cos(angle) * dist, ty: e.y + Math.sin(angle) * dist, area: skill.radius * (1 + (lvl - 1) * 0.1),
    });
  }

  /** Explosão inimiga: fere o herói e também os inimigos em volta (dá para usar a seu favor). */
  private explode(x: number, y: number, radius: number, dmg: number) {
    const sc = this.scene;
    sc.elements.vfx('vfx_explosion', x, y + radius * 0.5, radius * 2.1, [[0, 0.04], [1, 0.06], [2, 0.12], [3, 0.28]]);
    sfx('boom');
    const p = sc.player;
    if ((p.x - x) ** 2 + ((p.y - y) / 0.8) ** 2 < (radius + 8) ** 2) sc.hurtPlayer(dmg);
    sc.queryEnemies(x, y, radius + 16, (o) => {
      if (o.active && !o.boss && (o.x - x) ** 2 + (o.y - y) ** 2 < (radius + o.radius) ** 2) sc.elementalDamage(o, dmg * 2, '#ff9a5a');
    });
  }

  update(dt: number) {
    const p = this.scene.player;
    const keep: Shot[] = [];
    for (const s of this.shots) {
      s.life -= dt;
      s.img.x += s.vx * dt;
      s.img.y += s.vy * dt;
      if (s.kind === 'fireball') {
        s.img.setFrame(loopFrame('fx_fireball', s.life, 12));
        if (Math.random() < 0.5) this.scene.emitFlame(s.img.x, s.img.y);
      }
      const hitPlayer = (p.x - s.img.x) ** 2 + (p.y - 6 - s.img.y) ** 2 < (s.r + 8) ** 2;
      if (s.kind === 'fireball' && (s.life <= 0 || hitPlayer)) {
        this.explode(s.img.x, s.img.y + 6, s.area, s.damage);
        s.img.destroy();
        continue;
      }
      if (hitPlayer) {
        this.scene.hurtPlayer(s.damage);
        this.scene.impact(s.img.x, s.img.y, 0xb060e0, 0.6);
        s.img.destroy();
        continue;
      }
      if (s.life <= 0) {
        s.img.destroy();
        continue;
      }
      keep.push(s);
    }
    this.shots = keep;
  }

  destroy() {
    for (const s of this.shots) s.img.destroy();
    this.shots = [];
  }
}
