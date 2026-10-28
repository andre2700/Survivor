// Efeitos únicos dos itens equipados (a partir do Raro), na partida. Todos se veem na tela: rastro
// de fogo, sopro de dragão, nova de gelo, raios ao levar dano, espinhos, escudo dourado... O dano
// acompanha a força do herói e da fase, para o item continuar útil nas fases avançadas.
import Phaser from 'phaser';
import { frameName } from '../art/textures';
import { damageMult } from '../core/stats';
import type { EffectId } from '../data/items';
import { stageScaling } from '../data/stages';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import { sfx } from './sfx';

interface Flame {
  img: Phaser.GameObjects.Image;
  life: number;
}

export class ItemEffects {
  private t: Partial<Record<string, number>> = {};
  private flames: Flame[] = [];
  private lastTrail = { x: 0, y: 0 };

  constructor(private sc: GameScene, private fx: Partial<Record<EffectId, number>>) {}

  has(id: EffectId) {
    return (this.fx[id] ?? 0) > 0;
  }

  power(id: EffectId) {
    return this.fx[id] ?? 0;
  }

  /** Dano de um efeito: base × força do efeito × dano do herói × força da fase. */
  private dmg(base: number, k: number) {
    const sc = this.sc;
    return base * k * damageMult(sc.stats) * Math.pow(stageScaling(sc.stage, sc.elapsed / 900).hp, 0.85);
  }

  private ready(key: string, period: number) {
    const t = this.sc.elapsed;
    if ((this.t[key] ?? 0) > t) return false;
    this.t[key] = t + period;
    return true;
  }

  update(dt: number) {
    const sc = this.sc;
    const p = sc.player;
    // Passos Ígneos: rastro de chamas que queima quem pisa
    if (this.has('fireTrail')) {
      if (Math.hypot(p.x - this.lastTrail.x, p.y - this.lastTrail.y) > 14) {
        this.lastTrail = { x: p.x, y: p.y };
        const img = sc.add.image(p.x, p.y + 6, 'atlas', frameName('glow')).setTint(0xff7a2a).setScale(0.7, 0.45).setAlpha(0.8).setDepth(LAYER.groundFx);
        this.flames.push({ img, life: 2.5 });
      }
      if (this.ready('trailTick', 0.4)) {
        const d = this.dmg(15 * 0.4, this.power('fireTrail'));
        for (const f of this.flames) {
          sc.emitFlame(f.img.x, f.img.y - 4);
          sc.queryEnemies(f.img.x, f.img.y, 22, (e) => {
            if ((e.x - f.img.x) ** 2 + (e.y - f.img.y) ** 2 < 20 * 20) sc.elementalDamage(e, d, '#ff9a5a');
          });
        }
      }
    }
    this.flames = this.flames.filter((f) => {
      f.life -= dt;
      f.img.setAlpha(Math.min(0.8, f.life));
      if (f.life > 0) return true;
      f.img.destroy();
      return false;
    });
    // Sopro do Dragão: cone de fogo na direção em que o herói anda
    if (this.has('dragonBreath') && this.ready('breath', Math.max(3, 9 - this.power('dragonBreath')))) this.breath();
    // Nova de Gelo: congela quem está em volta
    if (this.has('frostNova') && this.ready('nova', Math.max(4, 11 - this.power('frostNova')))) this.frostNova();
    // Ímã Ancestral: puxa todas as gemas
    if (this.has('magnetPulse') && this.ready('magnet', Math.max(8, 24 - 2 * this.power('magnetPulse')))) {
      sc.pullAllGems();
      sc.impact(p.x, p.y, 0x7fc4ff, 1.4);
    }
  }

  private breath() {
    const sc = this.sc;
    const p = sc.player;
    const a = Math.atan2(sc.facing.y, sc.facing.x);
    const k = this.power('dragonBreath');
    const range = 120 + 15 * k;
    for (let i = 0; i < 7; i++) {
      const ai = a + (i - 3) * 0.12;
      const img = sc.add.image(p.x, p.y - 8, 'atlas', frameName('fx_fireball')).setRotation(ai).setScale(0.7).setDepth(LAYER.fx);
      sc.tweens.add({ targets: img, x: p.x + Math.cos(ai) * range, y: p.y - 8 + Math.sin(ai) * range, scale: 1.4, alpha: 0, duration: 420, onComplete: () => img.destroy() });
    }
    sfx('whoosh');
    const d = this.dmg(60, k);
    sc.queryEnemies(p.x, p.y, range, (e) => {
      const ea = Math.atan2(e.y - p.y, e.x - p.x);
      if (Math.abs(Phaser.Math.Angle.Wrap(ea - a)) < 0.45) sc.elementalDamage(e, d, '#ff9a5a');
    });
  }

  private frostNova() {
    const sc = this.sc;
    const p = sc.player;
    const r = 90;
    const g = sc.add.graphics().setDepth(LAYER.fx);
    sc.tweens.addCounter({
      from: 0.2, to: 1, duration: 280,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 1;
        g.clear().lineStyle(4, 0xbff0ff, 1 - k * 0.6).strokeEllipse(p.x, p.y, r * 2 * k, r * 1.6 * k);
        g.fillStyle(0xbff0ff, 0.25 * (1 - k)).fillEllipse(p.x, p.y, r * 2 * k, r * 1.6 * k);
      },
      onComplete: () => g.destroy(),
    });
    sfx('freeze');
    const t = sc.elapsed;
    sc.queryEnemies(p.x, p.y, r, (e) => {
      if ((e.x - p.x) ** 2 + ((e.y - p.y) / 0.8) ** 2 > r * r) return;
      const f = sc.control(e);
      if (!f) return;
      e.frozenUntil = Math.max(e.frozenUntil, t + 1.6 * f);
      e.statusEnd = Math.max(e.statusEnd, e.frozenUntil);
      e.setTint(0x9fe8ff);
    });
  }

  /** O herói levou dano: espinhos, raios e o segundo fôlego. */
  onHurt() {
    const sc = this.sc;
    const p = sc.player;
    if (this.has('thornBurst') && this.ready('thorns', 0.6)) {
      const r = 70;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        sc.weapons.spike(p.x + Math.cos(a) * 34, p.y + Math.sin(a) * 26, 0.7);
      }
      const d = this.dmg(40, this.power('thornBurst'));
      sc.queryEnemies(p.x, p.y, r, (e) => {
        if ((e.x - p.x) ** 2 + ((e.y - p.y) / 0.8) ** 2 < r * r) sc.elementalDamage(e, d, '#c08040');
      });
    }
    if (this.has('stormCloak') && this.ready('storm', 0.5)) {
      const k = this.power('stormCloak');
      const d = this.dmg(50, k);
      for (const e of sc.nearestEnemies(p.x, p.y, Math.min(10, 2 + Math.round(k)), 240)) {
        sc.weapons.drawBolt(e.x, e.y, sc.cameras.main.worldView.y - 10, false);
        sc.elementalDamage(e, d, '#73eff7');
      }
      sfx('zap');
    }
    if (this.has('secondWind') && sc.hp < sc.stats.maxHp * 0.3 && this.ready('wind', 60)) {
      const dur = 1.5 + 0.5 * this.power('secondWind');
      sc.invulnUntil = Math.max(sc.invulnUntil, sc.elapsed + dur);
      const ring = sc.add.image(p.x, p.y - 6, 'atlas', frameName('aura')).setTint(0xffd86a).setBlendMode(Phaser.BlendModes.ADD).setDepth(LAYER.fx).setScale(0.6);
      sc.tweens.add({ targets: ring, scale: 0.75, alpha: 0.4, duration: 300, yoyo: true, repeat: Math.ceil((dur * 1000) / 600), onUpdate: () => ring.setPosition(sc.player.x, sc.player.y - 6), onComplete: () => ring.destroy() });
      sc.floatText(p.x, p.y - 30, 'SEGUNDO FÔLEGO!', '#ffd86a', true);
    }
  }

  /** Um inimigo morreu: Vampiro cura. */
  onKill() {
    if (!this.has('vampire')) return;
    const sc = this.sc;
    sc.hp = Math.min(sc.stats.maxHp, sc.hp + 0.4 + 0.3 * this.power('vampire'));
  }

  /** Carrasco: inimigo comum com pouca vida morre na hora. */
  executes(e: Enemy) {
    if (!this.has('executioner') || e.boss || e.hp <= 0) return false;
    return e.hp / e.maxHp < (8 + 6 * this.power('executioner')) / 100;
  }

  /** Espelho: chance de refletir um tiro que ia acertar o herói. */
  reflects() {
    return this.has('mirror') && Math.random() < Math.min(0.8, 0.2 + 0.15 * this.power('mirror'));
  }

  /** Dano do tiro refletido (no inimigo mais próximo). */
  reflectDamage(base: number) {
    return this.dmg(base * 0.6, Math.max(1, this.power('mirror')));
  }

  destroy() {
    for (const f of this.flames) f.img.destroy();
    this.flames = [];
  }
}
