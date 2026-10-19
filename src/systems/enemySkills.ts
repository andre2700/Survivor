// Habilidades dos inimigos não corpo a corpo (Marco 3): à distância (cospe gosma, espinhos),
// conjurador (Bola de Fogo, Onda e Tornado do herói, com nível), explosivo (pisca e explode), bote e
// toca (o verme se enterra e irrompe sob o herói). Todo ataque tem aviso antes, para o jogador poder desviar.
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
  /** cor do tiro (gosma, esporos) */
  color: number;
  /** a onda já acertou o herói (ela atravessa, mas fere uma vez só) */
  hit?: boolean;
  /** tornado: tempo de vida total e próximo acerto permitido */
  total?: number;
  nextHit?: number;
}

/** Tiros inimigos ao mesmo tempo (desempenho). */
const MAX_SHOTS = 120;

/** Raio da bruxa marcado no chão: cai em `at` (s). */
interface Strike {
  x: number;
  y: number;
  at: number;
  r: number;
  damage: number;
}

/** Quanto tempo a teia prende o herói (s) e a velocidade dele preso. */
export const WEB = { time: 1.6, speed: 0.45 };

export class EnemySkills {
  private shots: Shot[] = [];
  private strikes: Strike[] = [];

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
    if (skill.kind === 'burrow' && e.attackPhase === 'attack') return this.burrowing(e, skill);
    // bote em andamento: corre em linha reta até o ponto mirado
    if (e.attackPhase === 'attack') {
      const dt = this.scene.game.loop.delta / 1000;
      const a = Math.atan2(e.attackY - e.y, e.attackX - e.x);
      e.x += Math.cos(a) * skill.speed * Math.min(dt, 0.05);
      e.y += Math.sin(a) * skill.speed * Math.min(dt, 0.05);
      if (d < e.radius + 12) this.scene.hurtPlayer(e.damage * skill.damage);
      if (t >= e.attackTimer || Math.hypot(e.attackX - e.x, e.attackY - e.y) < 8) {
        e.attackPhase = 'walk';
        e.attackTimer = t + skill.cooldown * (0.85 + Math.random() * 0.3);
      }
      return { forward: 0, side: 0 };
    }
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
      if (skill.kind === 'charge') {
        // bote: passa um pouco do ponto onde o herói estava
        const a = Math.atan2(e.attackY - e.y, e.attackX - e.x);
        const dist = Math.hypot(e.attackX - e.x, e.attackY - e.y) + 40;
        e.attackX = e.x + Math.cos(a) * dist;
        e.attackY = e.y + Math.sin(a) * dist;
        e.attackPhase = 'attack';
        e.attackTimer = t + dist / skill.speed;
        sfx('whoosh');
        return { forward: 0, side: 0 };
      }
      if (skill.kind === 'burrow') {
        // enterrou: vai por baixo da areia até onde o herói está agora; o círculo marca a saída
        const p = this.scene.player;
        e.attackX = p.x;
        e.attackY = p.y;
        e.burrowed = true;
        e.attackPhase = 'attack';
        const travel = Math.hypot(p.x - e.x, p.y - e.y) / skill.speed;
        e.attackTimer = t + travel + 0.7;
        this.ring(p.x, p.y, skill.radius, 0xe8a040, travel + 0.7);
        this.scene.impact(e.x, e.y, 0xd8b880, 1);
        return { forward: 0, side: 0 };
      }
      this.release(e, skill);
      e.attackTimer = t + skill.cooldown * (0.85 + Math.random() * 0.3);
      return { forward: 0, side: 0 };
    }
    if (skill.kind === 'charge') {
      if (d < skill.range && t >= e.attackTimer && this.scene.cameras.main.worldView.contains(e.x, e.y)) this.windup(e, skill, p.x, p.y);
      return { forward: 1, side: 0 };
    }
    if (skill.kind === 'explode') {
      if (d < skill.range + e.radius) this.windup(e, skill, p.x, p.y);
      return { forward: 1, side: 0 };
    }
    if (skill.kind === 'burrow') {
      if (d < skill.range && d > 50 && t >= e.attackTimer && this.scene.cameras.main.worldView.contains(e.x, e.y)) this.windup(e, skill, p.x, p.y);
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

  /** Verme enterrado: um monte de areia que anda até o ponto marcado e irrompe na hora certa. */
  private burrowing(e: Enemy, skill: EnemySkill): { forward: number; side: number } {
    const sc = this.scene;
    const t = sc.elapsed;
    const dt = Math.min(sc.game.loop.delta / 1000, 0.05);
    if (e.burrowed) {
      const dx = e.attackX - e.x;
      const dy = e.attackY - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 3) {
        const step = Math.min(d, skill.speed * dt);
        e.x += (dx / d) * step;
        e.y += (dy / d) * step;
        if (Math.random() < 0.25) sc.impact(e.x + (Math.random() - 0.5) * 14, e.y + 4, 0xd8b880, 0.35);
      }
      if (t < e.attackTimer) return { forward: 0, side: 0 };
      // irrompe: fere o herói no círculo (a areia também acerta os inimigos que estão em cima)
      e.burrowed = false;
      e.x = e.attackX;
      e.y = e.attackY;
      e.attackTimer = t + 0.5;
      const r = skill.radius;
      const dmg = e.damage * skill.damage;
      sc.impact(e.x, e.y, 0xe8c070, 2);
      sc.cameras.main.shake(70, 0.0015);
      sfx('boom');
      const p = sc.player;
      if ((p.x - e.x) ** 2 + ((p.y - e.y) / 0.8) ** 2 < (r + 6) ** 2) sc.hurtPlayer(dmg);
      sc.queryEnemies(e.x, e.y, r + 16, (o) => {
        if (o !== e && o.active && !o.boss && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < (r + o.radius) ** 2) sc.elementalDamage(o, dmg, '#e8c070');
      });
      return { forward: 0, side: 0 };
    }
    // fora da areia, mostra a mordida por um instante e volta a andar
    if (t >= e.attackTimer) {
      e.attackPhase = 'walk';
      e.attackTimer = t + skill.cooldown * (0.85 + Math.random() * 0.3);
    }
    return { forward: 0, side: 0 };
  }

  /** Círculo de aviso no chão que se enche até a hora do golpe. */
  private ring(x: number, y: number, r: number, color: number, time: number) {
    const g = this.scene.add.graphics().setDepth(LAYER.groundFx + 1);
    g.lineStyle(2, color, 0.9).strokeEllipse(x, y, r * 2, r * 1.6);
    g.fillStyle(color, 0.2).fillEllipse(x, y, r * 2, r * 1.6);
    this.scene.tweens.add({ targets: g, alpha: { from: 0.25, to: 1 }, duration: time * 1000, onComplete: () => g.destroy() });
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
    } else if (skill.kind === 'charge' || skill.kind === 'wave') {
      // aviso: a faixa do bote ou da onda no chão
      const lvl = this.level(skill);
      const a = Math.atan2(ty - e.y, tx - e.x);
      const len = skill.kind === 'charge' ? Math.hypot(tx - e.x, ty - e.y) + 40 : skill.range + 60;
      const half = skill.kind === 'charge' ? e.radius : skill.radius * (1 + (lvl - 1) * 0.1);
      const color = skill.kind === 'charge' ? 0xff5a2a : 0x41a6f6;
      const g = this.scene.add.graphics().setDepth(LAYER.groundFx + 1);
      const nx = -Math.sin(a) * half;
      const ny = Math.cos(a) * half;
      const ex = e.x + Math.cos(a) * len;
      const ey = e.y + Math.sin(a) * len;
      g.fillStyle(color, 0.18).fillPoints([{ x: e.x + nx, y: e.y + ny }, { x: ex + nx, y: ey + ny }, { x: ex - nx, y: ey - ny }, { x: e.x - nx, y: e.y - ny }] as Phaser.Math.Vector2[], true);
      this.scene.tweens.add({ targets: g, alpha: { from: 0.3, to: 1 }, duration: skill.windup * 1000, onComplete: () => g.destroy() });
    } else if (skill.kind === 'strike') {
      // aviso: um círculo onde cada raio vai cair (o primeiro no herói; com nível, mais raios em volta)
      const lvl = this.level(skill);
      const n = 1 + Math.floor((lvl - 1) / 3);
      const r = skill.radius * (1 + (lvl - 1) * 0.1);
      const at = this.scene.elapsed + skill.windup;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = i ? 40 + Math.random() * 40 : 0;
        const x = tx + Math.cos(a) * d;
        const y = ty + Math.sin(a) * d * 0.8;
        this.strikes.push({ x, y, at: at + i * 0.12, r, damage: e.damage * skill.damage });
        this.ring(x, y, r, 0xffe066, skill.windup + i * 0.12);
      }
    } else if (skill.kind === 'tornado') {
      // aviso: o vento rodando em volta do xamã
      this.ring(e.x, e.y, 22, 0x9ad050, skill.windup);
    } else if (skill.kind === 'spit') {
      // estufa antes de cuspir
      this.scene.tweens.add({ targets: e, scaleY: e.baseScale * 1.25, scaleX: e.baseScale * 0.85, duration: skill.windup * 900, yoyo: true });
    }
  }

  private release(e: Enemy, skill: EnemySkill) {
    const dmg = e.damage * skill.damage;
    // o raio já foi marcado no chão na preparação
    if (skill.kind === 'strike') return;
    if (skill.kind === 'explode') {
      this.explode(e.x, e.y, skill.radius, dmg);
      this.scene.elementalDamage(e, e.hp + 1, '#ffffff');
      return;
    }
    const lvl = this.level(skill);
    const n = skill.count ?? (skill.kind === 'fireball' || skill.kind === 'wave' || skill.kind === 'tornado' ? 1 + Math.floor((lvl - 1) / 3) : 1);
    const base = Math.atan2(e.attackY - e.y, e.attackX - e.x);
    const dist = Math.hypot(e.attackX - e.x, e.attackY - e.y);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * (skill.kind === 'wave' || skill.kind === 'tornado' ? 0.45 : skill.kind === 'spit' ? 0.22 : 0.28);
      this.fire(e, skill, a, dist, dmg, lvl);
    }
    sfx(skill.kind === 'fireball' || skill.kind === 'tornado' ? 'whoosh' : 'splash');
  }

  private fire(e: Enemy, skill: EnemySkill, angle: number, dist: number, dmg: number, lvl: number) {
    if (this.shots.length >= MAX_SHOTS) return;
    const fireball = skill.kind === 'fireball';
    const wave = skill.kind === 'wave';
    const tornado = skill.kind === 'tornado';
    const area = skill.radius * (1 + (lvl - 1) * 0.1);
    // esporos verdes do cogumelo; espinhos amarelos do cacto; teia branca da aranha; gosma roxa do slime
    const color = e.def.kind === 'sporeshroom' ? 0x9ad050 : e.def.kind === 'cactus_spitter' ? 0xe8e070 : skill.kind === 'web' ? 0xf4f4ff : 0xb060e0;
    let img: Phaser.GameObjects.Image;
    if (tornado) img = this.scene.add.image(e.x, e.y, 'atlas', frameName('fx_tornado')).setOrigin(0.5, 0.92).setTint(0xe8d8a0).setScale((area * 2.4) / 60);
    else if (fireball) img = this.scene.add.image(e.x, e.y - 6, 'atlas', frameName('fx_fireball')).setTint(0xffb08a).setScale(0.9).setRotation(angle);
    else if (wave) img = this.scene.add.image(e.x, e.y, 'atlas', frameName('fx_wave')).setOrigin(0.5, 0.86).setFlipX(Math.cos(angle) < 0).setScale((area * 2) / 64).setAlpha(0.9);
    else img = this.scene.add.image(e.x, e.y - 6, 'atlas', frameName('glow')).setTint(color).setScale(0.35);
    img.setDepth(wave || tornado ? e.y : LAYER.fx);
    const life = fireball ? dist / skill.speed : wave ? (skill.range + 60) / skill.speed : tornado ? 4.5 : 2.4;
    this.shots.push({
      img, vx: Math.cos(angle) * skill.speed, vy: Math.sin(angle) * skill.speed, total: life, nextHit: 0,
      life, damage: dmg, r: fireball ? 8 : wave || tornado ? area : skill.radius, kind: skill.kind,
      tx: e.x + Math.cos(angle) * dist, ty: e.y + Math.sin(angle) * dist, area, color,
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
      if (s.kind === 'tornado') {
        // persegue o herói devagar, puxa quem chega perto e fere a cada instante dentro dele
        const want = Math.atan2(p.y - s.img.y, p.x - s.img.x);
        const sp = Math.hypot(s.vx, s.vy);
        const cur = Math.atan2(s.vy, s.vx);
        const a = cur + Phaser.Math.Angle.Wrap(want - cur) * Math.min(1, dt * 1.2);
        s.vx = Math.cos(a) * sp;
        s.vy = Math.sin(a) * sp;
        const k = 1 - s.life / s.total!;
        s.img.setFrame(loopFrame('fx_tornado', s.life, 12)).setDepth(s.img.y).setRotation(Math.sin(s.life * 14) * 0.1)
          .setAlpha(Math.min(1, s.life * 2, k * 8));
        const d = Math.hypot(p.x - s.img.x, p.y - s.img.y);
        if (d < s.r * 2.4 && d > 4) {
          const pull = (1 - d / (s.r * 2.4)) * 60 * dt;
          p.x += ((s.img.x - p.x) / d) * pull;
          p.y += ((s.img.y - p.y) / d) * pull;
        }
        if (hitPlayer && this.scene.elapsed >= s.nextHit!) {
          s.nextHit = this.scene.elapsed + 0.8;
          if (this.scene.hurtPlayer(s.damage)) this.scene.impact(p.x, p.y - 6, 0x9ad050, 0.8);
        }
        if (s.life <= 0) s.img.destroy();
        else keep.push(s);
        continue;
      }
      if (s.kind === 'wave') {
        // a onda atravessa: fere o herói uma vez e segue até sumir
        s.img.setFrame(loopFrame('fx_wave', s.life, 8)).setDepth(s.img.y).setAlpha(Math.min(0.9, s.life * 3));
        if (hitPlayer && !s.hit) {
          s.hit = this.scene.hurtPlayer(s.damage) || s.hit;
          if (s.hit) this.scene.impact(p.x, p.y - 6, 0x41a6f6, 0.8);
        }
        if (s.life <= 0) s.img.destroy();
        else keep.push(s);
        continue;
      }
      if (s.kind === 'fireball' && (s.life <= 0 || hitPlayer)) {
        this.explode(s.img.x, s.img.y + 6, s.area, s.damage);
        s.img.destroy();
        continue;
      }
      if (hitPlayer) {
        // teia: prende o herói mesmo quando o dano é esquivado
        if (s.kind === 'web') {
          if (this.scene.elapsed >= this.scene.webUntil) this.scene.floatText(p.x, p.y - 20, 'PRESO!', '#f4f4ff', false);
          this.scene.webUntil = this.scene.elapsed + WEB.time;
        }
        this.scene.hurtPlayer(s.damage);
        this.scene.impact(s.img.x, s.img.y, s.color, 0.6);
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
    this.updateStrikes();
  }

  private updateStrikes() {
    if (!this.strikes.length) return;
    const sc = this.scene;
    const t = sc.elapsed;
    const p = sc.player;
    this.strikes = this.strikes.filter((s) => {
      if (t < s.at) return true;
      sc.weapons.drawBolt(s.x, s.y, sc.cameras.main.worldView.y - 10, false, 0xffe066);
      sfx('zap');
      if ((p.x - s.x) ** 2 + ((p.y - s.y) / 0.8) ** 2 < (s.r + 6) ** 2) sc.hurtPlayer(s.damage);
      return false;
    });
  }

  destroy() {
    for (const s of this.shots) s.img.destroy();
    this.shots = [];
    this.strikes = [];
  }
}
