// Comportamento dos chefes: escolhem golpes do repertório (data/bosses.ts) conforme a distância,
// sempre com aviso; ficam furiosos com pouca vida; o chefe final se transforma ao "morrer" e volta
// para a fase 2 com a vida enchendo de novo.
import Phaser from 'phaser';
import { bossDef, type BossDef, type BossMove } from '../data/bosses';
import { ENEMIES } from '../data/enemies';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import { sfx } from './sfx';

type Step = 'windup' | 'act' | 'recover';

interface BossState {
  def: BossDef;
  phase: 0 | 1;
  enraged: boolean;
  move: BossMove | null;
  step: Step;
  until: number;
  /** próximo golpe permitido (s) */
  next: number;
  /** quando cada golpe pode se repetir (s) */
  ready: Map<BossMove, number>;
  /** repetições restantes (saltos e investidas seguidos) */
  left: number;
  /** salto e investida: de onde, para onde, início e duração */
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t0: number;
  dur: number;
  /** a investida já acertou o herói */
  hit: boolean;
  /** aviso no chão do golpe atual */
  warn: Phaser.GameObjects.Graphics | null;
  /** transformação para a fase 2 em andamento até este instante (s) */
  transformUntil: number;
  /** origem vertical normal do sprite (o salto a desloca para cima) */
  originY: number;
  baseSpeed: number;
}

/**
 * Números gerais dos golpes. Regra: toda área marcada dá tempo de fugir andando (o herói anda
 * 60 px/s sem melhorias): raio ≤ velocidade × tempo de aviso.
 */
const MOVES = {
  slam: { windup: 1, reach: 40, radius: 50, maxRadius: 62, recover: 0.45 },
  leap: { windup: 0.5, again: 0.4, air: 1.1, height: 90, radius: 55, maxRadius: 72, recover: 0.5 },
  charge: { windup: 0.75, again: 0.5, speed: 430, overshoot: 70, halfWidth: 30, recover: 0.6 },
  volley: { windup: 0.7, recover: 0.45 },
  nova: { windup: 0.9, recover: 0.5 },
  rain: { windup: 0.5, recover: 0.7 },
  summon: { windup: 0.8, recover: 0.4 },
  blink: { fade: 0.3 },
  /** transformação da fase 2: duração (s) e vida que volta (fração) */
  transform: { time: 2.4, heal: 0.75 },
  /** fúria: velocidade e pausa entre golpes */
  enrage: { speed: 1.3, pause: 0.6, tint: 0xff8a7a },
};

export class BossAI {
  private states = new Map<Enemy, BossState>();

  constructor(private sc: GameScene) {}

  /** Liga o comportamento de chefe num inimigo (chefe da fase ou, com `def`, o chefe surpresa). */
  start(e: Enemy, def: BossDef = bossDef(e.def.id)) {
    this.states.set(e, {
      def, phase: 0, enraged: false, move: null, step: 'recover',
      until: 0, next: this.sc.elapsed + 2, ready: new Map(), left: 0, sx: 0, sy: 0, tx: 0, ty: 0, t0: 0, dur: 0, hit: false,
      warn: null, transformUntil: 0, originY: e.originY, baseSpeed: e.speed,
    });
    e.attackPhase = 'walk';
  }

  /** Nome do chefe na barra (o da fase 2 e "FURIOSO" quando for o caso). */
  label(e: Enemy) {
    const st = this.states.get(e);
    const name = st?.phase === 1 && st.def.phase2Name ? st.def.phase2Name : e.def.name;
    return `${name.toUpperCase()}${e.tag === 'surprise' ? ' GIGANTE' : ''}${st?.enraged ? ' · FURIOSO' : ''}`;
  }

  /** Não leva dano (transformando). */
  invulnerable(e: Enemy) {
    const st = this.states.get(e);
    return !!st && this.sc.elapsed < st.transformUntil;
  }

  /**
   * Chamado quando a vida do chefe chega a zero. Se ele tem fase 2 e ainda não a usou, se transforma
   * em vez de morrer (devolve true).
   */
  intercept(e: Enemy): boolean {
    const st = this.states.get(e);
    if (!st || st.phase === 1 || st.def.phases.length < 2) {
      this.end(e);
      return false;
    }
    const sc = this.sc;
    this.clearMove(e, st);
    st.phase = 1;
    st.enraged = false;
    st.transformUntil = sc.elapsed + MOVES.transform.time;
    st.next = st.transformUntil + 0.8;
    e.hp = 1;
    e.baseTint = st.def.phase2Tint ?? 0;
    sc.cameras.main.flash(500, 255, 255, 255);
    sc.cameras.main.shake(700, 0.014);
    sfx('boss');
    sc.events.emit('announce', `${(st.def.phase2Name ?? e.def.name).toUpperCase()}!`);
    // cresce, troca de cor e a vida enche de novo enquanto se transforma
    sc.tweens.add({ targets: e, baseScale: e.baseScale * 1.12, duration: MOVES.transform.time * 1000, ease: 'Sine.InOut' });
    sc.tweens.addCounter({
      from: 1, to: e.maxHp * MOVES.transform.heal, duration: MOVES.transform.time * 1000,
      onUpdate: (tw) => {
        if (e.active) e.hp = tw.getValue() ?? 1;
      },
    });
    for (let i = 0; i < 6; i++) sc.time.delayedCall(i * 350, () => e.active && sc.impact(e.x + Phaser.Math.Between(-30, 30), e.y - Phaser.Math.Between(0, 60), st.def.phase2Tint ?? 0xffffff, 2));
    const phase = st.def.phases[1]!;
    st.baseSpeed *= phase.speed;
    e.speed = st.baseSpeed;
    return true;
  }

  /** O chefe morreu de vez (ou saiu): limpa avisos e o estado. */
  end(e: Enemy) {
    const st = this.states.get(e);
    if (!st) return;
    this.clearMove(e, st);
    this.states.delete(e);
  }

  /** Atualiza o chefe; devolve true enquanto ele está parado (preparando, golpeando ou no ar). */
  update(e: Enemy, d: number, dt: number): boolean {
    const st = this.states.get(e);
    if (!st) return false;
    const sc = this.sc;
    const t = sc.elapsed;
    if (t < st.transformUntil) {
      e.attackPhase = 'windup';
      return true;
    }
    const phase = st.def.phases[st.phase] ?? st.def.phases[0];
    // fúria: só na última fase
    if (!st.enraged && st.phase === st.def.phases.length - 1 && e.hp / e.maxHp < st.def.enrageAt) {
      st.enraged = true;
      e.baseTint = MOVES.enrage.tint;
      sc.restoreTint(e);
      e.speed = st.baseSpeed * MOVES.enrage.speed;
      sc.events.emit('announce', `${this.label(e).replace(' · FURIOSO', '')} ESTÁ FURIOSO!`);
      sc.cameras.main.shake(300, 0.008);
      sfx('boss');
    }
    if (!st.move) {
      e.attackPhase = 'walk';
      if (t < st.next) return false;
      const move = this.pick(e, st, phase.moves, d);
      if (!move) return false;
      st.move = move;
      st.left = move.times ?? 1;
      st.ready.set(move, t + move.cooldown);
      this.begin(e, st, move, false);
      return true;
    }
    this.run(e, st, st.move, d, dt);
    if (!st.move) st.next = t + phase.pause * (st.enraged ? MOVES.enrage.pause : 1);
    return true;
  }

  /** Sorteia um golpe possível agora (pela distância e pelo tempo de recarga de cada um). */
  private pick(e: Enemy, st: BossState, moves: BossMove[], d: number): BossMove | null {
    const t = this.sc.elapsed;
    const onScreen = this.sc.cameras.main.worldView.contains(e.x, e.y);
    const ok = moves.filter((m) => {
      if ((st.ready.get(m) ?? 0) > t) return false;
      switch (m.kind) {
        case 'slam':
          return d < e.radius + MOVES.slam.reach + MOVES.slam.radius;
        case 'leap':
          return d > 60 && d < 380;
        case 'charge':
          return d > 50 && d < 330 && onScreen;
        case 'blink':
          return d > 90;
        default:
          return onScreen;
      }
    });
    if (!ok.length) return null;
    let r = Math.random() * ok.reduce((a, m) => a + m.weight, 0);
    for (const m of ok) if ((r -= m.weight) < 0) return m;
    return ok[ok.length - 1];
  }

  /** Começa (ou repete) um golpe: postura de preparo e o aviso no chão. */
  private begin(e: Enemy, st: BossState, move: BossMove, again: boolean) {
    const sc = this.sc;
    const p = sc.player;
    const t = sc.elapsed;
    st.step = 'windup';
    st.hit = false;
    e.attackPhase = 'windup';
    const g = sc.add.graphics().setDepth(LAYER.groundFx + 1);
    st.warn = g;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    switch (move.kind) {
      case 'slam': {
        const reach = Math.max(MOVES.slam.reach, e.radius + 10);
        st.tx = e.x + Math.cos(a) * reach;
        st.ty = e.y + Math.sin(a) * reach;
        const r = this.slamRadius(e);
        g.fillStyle(0xff3020, 0.2).fillEllipse(st.tx, st.ty, r * 2, r * 1.6);
        g.lineStyle(3, 0xff3020, 0.9).strokeEllipse(st.tx, st.ty, r * 2, r * 1.6);
        st.until = t + MOVES.slam.windup;
        break;
      }
      case 'leap': {
        // o círculo de pouso aparece já na preparação, onde o herói está agora
        st.tx = p.x;
        st.ty = p.y;
        st.until = t + (again ? MOVES.leap.again : MOVES.leap.windup);
        const r = this.landRadius(e);
        g.fillStyle(0xff3020, 0.22).fillEllipse(st.tx, st.ty, r * 2, r * 1.6);
        g.lineStyle(3, 0xff3020, 0.9).strokeEllipse(st.tx, st.ty, r * 2, r * 1.6);
        sc.tweens.add({ targets: e, scaleY: e.baseScale * 0.82, duration: (st.until - t) * 900, yoyo: true });
        break;
      }
      case 'charge': {
        // faixa no chão até um pouco depois do herói
        const len = Math.hypot(p.x - e.x, p.y - e.y) + MOVES.charge.overshoot;
        st.sx = e.x;
        st.sy = e.y;
        st.tx = e.x + Math.cos(a) * len;
        st.ty = e.y + Math.sin(a) * len;
        const half = Math.min(e.radius * 0.8, MOVES.charge.halfWidth);
        const nx = -Math.sin(a) * half;
        const ny = Math.cos(a) * half;
        g.fillStyle(0xff5a2a, 0.22).fillPoints([{ x: e.x + nx, y: e.y + ny }, { x: st.tx + nx, y: st.ty + ny }, { x: st.tx - nx, y: st.ty - ny }, { x: e.x - nx, y: e.y - ny }] as Phaser.Math.Vector2[], true);
        st.until = t + (again ? MOVES.charge.again : MOVES.charge.windup);
        break;
      }
      case 'volley':
        g.lineStyle(2, move.color ?? 0xff5a2a, 0.6).lineBetween(e.x, e.y, p.x, p.y);
        st.tx = p.x;
        st.ty = p.y;
        st.until = t + MOVES.volley.windup;
        break;
      case 'nova':
        g.lineStyle(3, move.color ?? 0xffd86a, 0.8).strokeCircle(e.x, e.y - 10, e.radius * 1.6);
        st.until = t + MOVES.nova.windup;
        break;
      case 'rain':
        st.until = t + MOVES.rain.windup;
        break;
      case 'summon':
        g.lineStyle(3, 0xd6a6ff, 0.8).strokeEllipse(e.x, e.y, e.radius * 4, e.radius * 3);
        st.until = t + MOVES.summon.windup;
        break;
      case 'blink':
        st.until = t + MOVES.blink.fade;
        e.intangible = true;
        sc.tweens.add({ targets: e, alpha: 0, duration: MOVES.blink.fade * 1000 });
        break;
    }
    sc.tweens.add({ targets: g, alpha: { from: 0.35, to: 1 }, duration: Math.max(1, (st.until - t) * 1000) });
  }

  private run(e: Enemy, st: BossState, move: BossMove, d: number, dt: number) {
    const sc = this.sc;
    const t = sc.elapsed;
    if (st.step === 'recover') {
      e.attackPhase = 'walk';
      if (t >= st.until) this.clearMove(e, st);
      return;
    }
    if (st.step === 'windup') {
      if (t < st.until) return;
      st.step = 'act';
      e.attackPhase = 'attack';
      this.act(e, st, move);
      return;
    }
    // golpes que duram: salto e investida
    if (move.kind === 'leap') {
      const k = Math.min(1, (t - st.t0) / st.dur);
      e.x = Phaser.Math.Linear(st.sx, st.tx, k);
      e.y = Phaser.Math.Linear(st.sy, st.ty, k);
      // sobe e desce: a origem do sprite desloca a figura para cima
      const lift = Math.sin(k * Math.PI) * MOVES.leap.height;
      e.setOrigin(0.5, st.originY + lift / (e.height * e.scaleY));
      if (k < 1) return;
      e.setOrigin(0.5, st.originY);
      e.intangible = false;
      this.land(e, move);
      if (--st.left > 0) return this.begin(e, st, move, true);
      this.recover(e, st, MOVES.leap.recover);
      return;
    }
    if (move.kind === 'charge') {
      const dx = st.tx - e.x;
      const dy = st.ty - e.y;
      const len = Math.hypot(dx, dy);
      const sp = MOVES.charge.speed * (st.enraged ? 1.15 : 1) * Math.min(dt, 0.05);
      if (len > sp) {
        e.x += (dx / len) * sp;
        e.y += (dy / len) * sp;
      } else {
        e.x = st.tx;
        e.y = st.ty;
      }
      if (!st.hit && d < e.radius + 12 && sc.hurtPlayer(e.damage * (move.damage ?? 1.4))) st.hit = true;
      if (Math.random() < 0.4) sc.impact(e.x, e.y + 4, 0xd8c8a0, 0.5);
      if (len > sp) return;
      if (--st.left > 0) return this.begin(e, st, move, true);
      this.recover(e, st, MOVES.charge.recover);
      return;
    }
    if (move.kind === 'blink') {
      if (t < st.until) return;
      e.intangible = false;
      this.recover(e, st, 0.2);
      return;
    }
    if (t >= st.until) this.clearMove(e, st);
  }

  /** O golpe acontece (fim da preparação). */
  private act(e: Enemy, st: BossState, move: BossMove) {
    const sc = this.sc;
    const p = sc.player;
    const t = sc.elapsed;
    st.warn?.destroy();
    st.warn = null;
    const dmg = e.damage * (move.damage ?? 1.2);
    switch (move.kind) {
      case 'slam': {
        const r = this.slamRadius(e);
        sc.impact(st.tx, st.ty, 0xff6a2a, 2.5);
        sc.cameras.main.shake(160, 0.006);
        sfx('boss');
        if ((p.x - st.tx) ** 2 + ((p.y - st.ty) / 0.8) ** 2 < r * r) sc.hurtPlayer(dmg);
        return this.recover(e, st, MOVES.slam.recover);
      }
      case 'leap': {
        // pula até o círculo marcado na preparação (o aviso continua até o pouso)
        st.sx = e.x;
        st.sy = e.y;
        st.t0 = t;
        st.dur = MOVES.leap.air;
        e.intangible = true;
        const r = this.landRadius(e);
        const g = sc.add.graphics().setDepth(LAYER.groundFx + 1);
        g.fillStyle(0xff3020, 0.3).fillEllipse(st.tx, st.ty, r * 2, r * 1.6);
        g.lineStyle(3, 0xff3020, 1).strokeEllipse(st.tx, st.ty, r * 2, r * 1.6);
        sc.tweens.add({ targets: g, alpha: { from: 0.5, to: 1 }, duration: st.dur * 1000, onComplete: () => g.destroy() });
        sfx('whoosh');
        return;
      }
      case 'charge':
        sfx('whoosh');
        return;
      case 'volley': {
        const n = (move.count ?? 3) + (st.enraged ? 2 : 0);
        const base = Math.atan2(p.y - e.y, p.x - e.x);
        const spread = move.shot === 'wave' || move.shot === 'tornado' ? 0.42 : 0.2;
        for (let i = 0; i < n; i++) sc.enemySkills.bossShot(e, move.shot ?? 'spit', base + (i - (n - 1) / 2) * spread, dmg, move.color);
        sfx(move.shot === 'fireball' ? 'whoosh' : 'splash');
        return this.recover(e, st, MOVES.volley.recover);
      }
      case 'nova': {
        const n = (move.count ?? 10) + (st.enraged ? 4 : 0);
        const off = Math.random() * Math.PI;
        for (let i = 0; i < n; i++) sc.enemySkills.bossShot(e, move.shot ?? 'spit', off + (i / n) * Math.PI * 2, dmg, move.color, 200);
        sc.cameras.main.shake(120, 0.004);
        sfx('boom');
        return this.recover(e, st, MOVES.nova.recover);
      }
      case 'rain': {
        const n = (move.count ?? 6) + (st.enraged ? 3 : 0);
        const r = 26 + e.radius * 0.2;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const dist = i ? 30 + Math.random() * 130 : 0;
          sc.enemySkills.strikeAt(p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist * 0.8, i * 0.12, r, dmg, move.look ?? 'bolt');
        }
        return this.recover(e, st, MOVES.rain.recover);
      }
      case 'summon': {
        const ids = move.minions ?? ['slime'];
        const n = move.count ?? 4;
        if (sc.activeEnemies().length < 600) {
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const x = e.x + Math.cos(a) * (e.radius + 30);
            const y = e.y + Math.sin(a) * (e.radius + 24);
            sc.spawnEnemy(ENEMIES[ids[i % ids.length]], x, y);
            sc.impact(x, y, 0xd6a6ff, 0.9);
          }
        }
        sfx('boss');
        return this.recover(e, st, MOVES.summon.recover);
      }
      case 'blink': {
        // reaparece perto do herói, de um lado qualquer
        const a = Math.random() * Math.PI * 2;
        e.x = p.x + Math.cos(a) * 120;
        e.y = p.y + Math.sin(a) * 95;
        sc.impact(e.x, e.y, 0xd6a6ff, 1.6);
        sc.tweens.add({ targets: e, alpha: 1, duration: MOVES.blink.fade * 1000 });
        st.until = t + MOVES.blink.fade;
        // ataca logo em seguida
        st.next = t;
        return;
      }
    }
  }

  /** Pouso do salto: fere e empurra quem está no círculo; pedras sobem do chão. */
  private land(e: Enemy, move: BossMove) {
    const sc = this.sc;
    const p = sc.player;
    const r = this.landRadius(e);
    sc.impact(e.x, e.y, 0xd8c8a0, 3);
    sc.flames.explode(16, e.x, e.y);
    sc.cameras.main.shake(220, 0.01);
    sfx('boss');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      sc.weapons.spike(e.x + Math.cos(a) * r * 0.8, e.y + Math.sin(a) * r * 0.6, 0.9);
    }
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    if (dx * dx + (dy / 0.8) ** 2 < r * r && sc.hurtPlayer(e.damage * (move.damage ?? 1.6))) {
      // empurrão para fora do círculo
      const dd = Math.hypot(dx, dy) || 1;
      sc.player.x += (dx / dd) * 34;
      sc.player.y += (dy / dd) * 34;
    }
  }

  private recover(e: Enemy, st: BossState, time: number) {
    st.step = 'recover';
    st.until = this.sc.elapsed + time;
    e.attackPhase = 'attack';
  }

  private clearMove(e: Enemy, st: BossState) {
    st.warn?.destroy();
    st.warn = null;
    st.move = null;
    e.attackPhase = 'walk';
    e.intangible = false;
    e.setOrigin(0.5, st.originY);
    if (e.alpha < 1) e.setAlpha(1);
  }

  slamRadius(e: Enemy) {
    return Phaser.Math.Clamp(e.radius * 1.3, MOVES.slam.radius, MOVES.slam.maxRadius);
  }

  private landRadius(e: Enemy) {
    return Phaser.Math.Clamp(e.radius * 1.6, MOVES.leap.radius, MOVES.leap.maxRadius);
  }
}
