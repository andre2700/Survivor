// Eventos aleatórios dentro da partida (Marco 3): baú guardado, prisioneiro que vira aliado, chefe
// surpresa, goblin dourado, chuva de meteoros, emboscada, guerra de tribos e tempestade de areia.
// Também espalha itens pelo mapa (ímã, bomba, cura) e diz à HUD para onde apontar as setas de borda.
// Cada fase escolhe os seus eventos.
import Phaser from 'phaser';
import { walkPose } from '../art/motion';
import { frameName, slotsOf } from '../art/textures';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { WEAPONS, weaponStatsAt } from '../data/weapons';
import { damageMult } from '../core/stats';
import type { RunEventId, Tribe } from '../data/stages';
import { waveAt } from '../data/waves';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import { moveSpeed } from '../core/stats';
import { waveClock } from './dev';
import { loadSave, writeSave } from './save';
import { sfx } from './sfx';

/** Ponto de interesse: a HUD mostra uma seta na borda da tela quando ele está fora da vista. */
export interface Poi {
  x: number;
  y: number;
  color: number;
}

interface Chest {
  img: Phaser.GameObjects.Image;
}

interface Captive {
  hero: CharacterDef;
  img: Phaser.GameObjects.Image;
  cage: Phaser.GameObjects.Graphics;
  ring: Phaser.GameObjects.Graphics;
  progress: number;
}

interface Ally {
  hero: CharacterDef;
  img: Phaser.GameObjects.Image;
  until: number;
  cooldown: number;
  slots: Record<string, number>;
}

/** Nomes que aparecem no anúncio de cada evento. */
const TITLES: Record<RunEventId, string> = {
  chest: 'UM BAÚ GUARDADO APARECEU!',
  captive: 'UM PRISIONEIRO PEDE AJUDA!',
  surpriseBoss: 'CHEFE SURPRESA!',
  goldenGoblin: 'UM GOBLIN DOURADO! PEGUE-O!',
  meteors: 'CHUVA DE METEOROS!',
  ambush: 'EMBOSCADA!',
  tribeWar: 'GUERRA DE TRIBOS!',
  sandstorm: 'TEMPESTADE DE AREIA!',
};

/** Tribos da guerra quando a fase não define as suas. */
const DEFAULT_TRIBES: [Tribe, Tribe] = [
  { name: 'Goblins', pool: ['goblin', 'goblin_earth'] },
  { name: 'Esqueletos', pool: ['skeleton'] },
];

/** Tempestade de areia: dura isto (s) e fere todos a cada `tick` (s). */
const STORM = { time: 16, tick: 2, streaks: 110 };

export class RunEvents {
  private next = 70;
  private chests: Chest[] = [];
  private captive: Captive | null = null;
  private ally: Ally | null = null;
  private golden: Enemy | null = null;
  /** chefes surpresa vivos (para as setas, sem percorrer todos os inimigos) */
  private surprises: Enemy[] = [];
  private goldenUntil = 0;
  private nextItem = 40;
  private done = new Set<RunEventId>();
  /** guerreiros vivos de cada tribo, o campo de batalha e o fim da guerra */
  private tribes: [Enemy[], Enemy[]] = [[], []];
  private war: { x: number; y: number; until: number } | null = null;
  /** tempestade de areia: fim, próximo dano, lado do vento, véu e grãos (posição na tela, 0 a 1) */
  private storm: { until: number; next: number; wind: number; veil: Phaser.GameObjects.Graphics; grains: { u: number; v: number; len: number; sp: number }[] } | null = null;

  constructor(private scene: GameScene) {}

  /** Relógio dos eventos: o da linha de 15 min (encurta junto quando a partida é mais curta no DEV). */
  private get clock() {
    return waveClock(this.scene.elapsed);
  }

  update(dt: number) {
    const sc = this.scene;
    if (!sc.endless && !sc.bossSpawned && this.clock >= this.next) {
      this.next = this.clock + 60 + Math.random() * 40;
      this.start(this.pick());
    }
    if (this.clock >= this.nextItem) {
      this.nextItem = this.clock + 35 + Math.random() * 20;
      this.dropItem();
    }
    this.updateChests();
    this.updateCaptive(dt);
    this.updateAlly(dt);
    this.updateWar();
    this.updateStorm(dt);
    if (this.golden && (!this.golden.active || sc.elapsed > this.goldenUntil)) {
      if (this.golden.active) {
        // escapou: some numa nuvem
        sc.impact(this.golden.x, this.golden.y, 0xffd86a, 1.2);
        this.golden.kill();
        sc.events.emit('announce', 'O GOBLIN DOURADO FUGIU...');
      }
      this.golden = null;
    }
  }

  /** O evento do objetivo da fase sai primeiro; depois, sorteio entre os da fase. */
  private pick(): RunEventId {
    const st = this.scene.stage;
    const goal = st.objectives.find((o) => o.kind === 'event');
    if (goal && goal.kind === 'event' && !this.done.has(goal.event)) return goal.event;
    const pool = st.events.filter((e) => !(e === 'captive' && (this.captive || this.ally)) && !(e === 'goldenGoblin' && this.golden)
      && !(e === 'tribeWar' && this.war) && !(e === 'sandstorm' && this.storm));
    return pool[Math.floor(Math.random() * pool.length)] ?? 'ambush';
  }

  start(id: RunEventId) {
    this.done.add(id);
    // o mapa-múndi passa a mostrar este mistério da fase
    const save = loadSave();
    const seen = (save.seen[this.scene.stage.id] ??= []);
    if (!seen.includes(id)) {
      seen.push(id);
      writeSave(save);
    }
    this.scene.events.emit('announce', TITLES[id]);
    sfx('boss');
    switch (id) {
      case 'chest':
        return this.startChest();
      case 'captive':
        return this.startCaptive();
      case 'surpriseBoss':
        return this.startSurpriseBoss();
      case 'goldenGoblin':
        return this.startGolden();
      case 'meteors':
        return this.startMeteors();
      case 'ambush':
        return this.startAmbush();
      case 'tribeWar':
        return this.startWar();
      case 'sandstorm':
        return this.startStorm();
    }
  }

  /** Inimigos da onda atual da fase. */
  private pool(): EnemyId[] {
    return waveAt(Math.min(this.clock, 899), this.scene.stage.waves).pool.filter((id) => !ENEMIES[id].boss);
  }

  private away(min: number, max: number) {
    const p = this.scene.player;
    const a = Math.random() * Math.PI * 2;
    const d = min + Math.random() * (max - min);
    return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.8 };
  }

  private guard(x: number, y: number, n: number, r: number) {
    const pool = this.pool();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const e = this.scene.spawnEnemy(ENEMIES[pool[i % pool.length]], x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
      if (e) e.tag = 'guard';
    }
  }

  // ---------- Baú ----------

  private startChest() {
    const { x, y } = this.away(260, 340);
    this.placeChest(x, y);
    this.guard(x, y, 7, 46);
    if (this.clock > 300) {
      const pool = this.pool();
      this.scene.spawnEnemy(ENEMIES[pool[pool.length - 1]], x + 30, y, true);
    }
  }

  private placeChest(x: number, y: number) {
    const img = this.scene.add.image(x, y, 'atlas', frameName('chest')).setOrigin(0.5, 0.9).setDepth(y).setScale(1.2);
    this.scene.tweens.add({ targets: img, y: y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.chests.push({ img });
  }

  private updateChests() {
    const p = this.scene.player;
    this.chests = this.chests.filter((c) => {
      if ((p.x - c.img.x) ** 2 + (p.y - c.img.y) ** 2 > 22 * 22) return true;
      this.openChest(c.img.x, c.img.y);
      c.img.destroy();
      return false;
    });
  }

  /** Recompensa do baú: +1 nível numa arma, ouro ou cura completa. */
  private openChest(x: number, y: number) {
    const sc = this.scene;
    sc.completed.add('chest');
    sc.impact(x, y, 0xffd86a, 2);
    sfx('levelup');
    const r = Math.random();
    const owned = sc.ownedWeapons;
    if (r < 0.5 && owned.length) {
      const w = owned[Math.floor(Math.random() * owned.length)];
      sc.devWeapon(1, w.id);
      sc.floatText(x, y - 20, 'ARMA +1 NÍVEL!', '#ffd86a', true);
    } else if (r < 0.8) {
      for (let i = 0; i < 16; i++) sc.dropPickup('coin', x + Phaser.Math.Between(-24, 24), y + Phaser.Math.Between(-18, 18), 3);
      sc.floatText(x, y - 20, 'TESOURO!', '#ffd86a', true);
    } else {
      sc.hp = sc.stats.maxHp;
      sc.floatText(x, y - 20, 'VIDA CHEIA!', '#38b764', true);
    }
  }

  // ---------- Prisioneiro e aliado ----------

  private startCaptive() {
    const sc = this.scene;
    const others = CHARACTERS.filter((c) => c.id !== sc.char.id);
    const hero = others[Math.floor(Math.random() * others.length)];
    const { x, y } = this.away(280, 360);
    const img = sc.add.image(x, y, 'atlas', frameName(hero.texture, 0)).setOrigin(0.5, 0.68).setDepth(y);
    // jaula: grades na frente do herói preso
    const cage = sc.add.graphics().setDepth(y + 1);
    cage.lineStyle(3, 0x4a3a2a, 1).strokeRect(x - 16, y - 34, 32, 40);
    for (let i = 1; i < 5; i++) cage.lineStyle(2, 0x6a5a4a, 1).lineBetween(x - 16 + i * 6.4, y - 34, x - 16 + i * 6.4, y + 6);
    cage.fillStyle(0x4a3a2a, 1).fillRect(x - 18, y - 37, 36, 5);
    const ring = sc.add.graphics().setDepth(LAYER.groundFx);
    this.captive = { hero, img, cage, ring, progress: 0 };
    this.guard(x, y, 9, 56);
  }

  private updateCaptive(dt: number) {
    const c = this.captive;
    if (!c) return;
    const p = this.scene.player;
    const near = (p.x - c.img.x) ** 2 + (p.y - c.img.y) ** 2 < 34 * 34;
    // fique perto por um instante para abrir a jaula
    c.progress = Phaser.Math.Clamp(c.progress + (near ? dt / 1.2 : -dt), 0, 1);
    c.ring.clear();
    c.ring.lineStyle(3, 0xffffff, 0.25).strokeCircle(c.img.x, c.img.y, 30);
    if (c.progress > 0) c.ring.lineStyle(4, 0x8cf08a, 1).beginPath().arc(c.img.x, c.img.y, 30, -Math.PI / 2, -Math.PI / 2 + c.progress * Math.PI * 2).strokePath();
    if (c.progress < 1) return;
    c.cage.destroy();
    c.ring.destroy();
    this.captive = null;
    this.scene.completed.add('captive');
    this.scene.impact(c.img.x, c.img.y, 0x8cf08a, 1.6);
    this.scene.events.emit('announce', `${c.hero.name.toUpperCase()} SE JUNTA A VOCÊ!`);
    sfx('levelup');
    this.ally = { hero: c.hero, img: c.img, until: this.scene.elapsed + 75, cooldown: 0, slots: { ...slotsOf(c.hero.texture) } };
  }

  /** Aliado: acompanha o herói e ataca o inimigo mais próximo com a arma inicial dele. */
  private updateAlly(dt: number) {
    const a = this.ally;
    if (!a) return;
    const sc = this.scene;
    const p = sc.player;
    if (sc.elapsed > a.until) {
      sc.floatText(a.img.x, a.img.y - 24, 'Obrigado!', '#8cf08a', true);
      sc.tweens.add({ targets: a.img, alpha: 0, y: a.img.y - 10, duration: 500, onComplete: () => a.img.destroy() });
      this.ally = null;
      return;
    }
    // fica um pouco atrás e ao lado do herói
    const tx = p.x - sc.facing.x * 26 + 14;
    const ty = p.y - sc.facing.y * 26 + 6;
    const dx = tx - a.img.x;
    const dy = ty - a.img.y;
    const d = Math.hypot(dx, dy);
    const moving = d > 6;
    if (moving) {
      const sp = Math.min(d, Math.max(110, d * 3) * dt);
      a.img.x += (dx / d) * sp;
      a.img.y += (dy / d) * sp;
      a.img.setFlipX(dx < 0);
    }
    const pose = walkPose('hero', sc.elapsed + 0.3, moving);
    a.img.setFrame(frameName(a.hero.texture, a.slots[pose.slot] ?? 0)).setScale(pose.sx, pose.sy).setDepth(a.img.y);
    a.cooldown -= dt;
    if (a.cooldown > 0) return;
    const target = sc.nearestEnemies(a.img.x, a.img.y, 1, 170)[0];
    if (!target) return;
    // força relevante: a arma inicial dele num nível que acompanha o seu, com os seus bônus de dano
    const w = WEAPONS[a.hero.weapon];
    const lvl = Math.max(3, Math.ceil(sc.level * 0.7) + sc.stageIndex * 2);
    const st = weaponStatsAt(w, lvl);
    const dmg = st.damage * damageMult(sc.stats) * 1.3;
    a.cooldown = Math.max(0.3, st.cooldown * 0.6);
    const ang = Math.atan2(target.y - a.img.y, target.x - a.img.x);
    a.img.setFlipX(Math.cos(ang) < 0);
    const ranged = a.hero.weapon === 'wand' || a.hero.weapon === 'knives';
    if (ranged) {
      // leque de projéteis (a quantidade da arma no nível dele)
      const n = Math.min(6, Math.floor(st.amount) + 1);
      for (let i = 0; i < n; i++) {
        const pr = sc.projectiles.get();
        if (!pr) break;
        const ai = ang + (i - (n - 1) / 2) * 0.18;
        const tex = a.hero.weapon === 'wand' ? 'proj_bolt' : 'proj_knife';
        pr.fire(a.hero.weapon === 'wand' ? 'bolt' : 'knife', tex, a.img.x, a.img.y - 6, Math.cos(ai) * 300, Math.sin(ai) * 300, dmg, 2 + Math.floor(st.pierce), 1.2, 1, w.element, 0.6);
        pr.owner = null;
      }
    } else if (Math.hypot(target.x - a.img.x, target.y - a.img.y) < 44) {
      // golpe em área em volta do alvo
      sc.queryEnemies(target.x, target.y, 56, (o) => {
        if (o.active && (o.x - target.x) ** 2 + (o.y - target.y) ** 2 < 46 * 46) sc.hitEnemy(o, dmg * 1.4, 1.2, w.element, true, 0.6);
      });
      sc.impact(target.x, target.y - 4, 0xffffff, 1.2);
    } else {
      a.cooldown = 0.1;
      // corre até o alvo
      a.img.x += Math.cos(ang) * 140 * dt * 3;
      a.img.y += Math.sin(ang) * 140 * dt * 3;
    }
  }

  // ---------- Chefe surpresa, goblin dourado, meteoros, emboscada ----------

  private startSurpriseBoss() {
    const sc = this.scene;
    const pool = this.pool();
    const id = pool[pool.length - 1];
    const { x, y } = this.away(180, 220);
    const e = sc.spawnEnemy(ENEMIES[id], x, y, true);
    if (!e) return;
    // desafiador: um elite gigante com vida de chefe, golpe de chefe (pancada com aviso no chão),
    // dano dobrado e Resistência alta
    e.tag = 'surprise';
    e.boss = true;
    e.baseScale *= 1.8;
    e.radius *= 1.8;
    e.maxHp *= 8;
    e.hp = e.maxHp;
    e.damage *= 2;
    e.speed *= 1.1;
    e.resist = Math.max(e.resist, 0.6);
    e.attackPhase = 'walk';
    e.attackTimer = 2;
    e.setTint(0xff9a8a);
    sc.miniBoss = e;
    this.surprises.push(e);
    sc.events.emit('announce', `CHEFE SURPRESA: ${ENEMIES[id].name.toUpperCase()} GIGANTE!`);
  }

  private startGolden() {
    const sc = this.scene;
    const { x, y } = this.away(200, 240);
    const e = sc.spawnEnemy(ENEMIES.goblin, x, y);
    if (!e) return;
    e.tag = 'golden';
    e.maxHp = e.hp = ENEMIES.goblin.hp * 40 * sc.stage.difficulty;
    // um pouco mais lento que o herói: dá para alcançar, mas exige perseguir
    e.speed = moveSpeed(sc.stats) * 0.92;
    e.setTint(0xffd84a);
    this.golden = e;
    this.goldenUntil = sc.elapsed + 22;
  }

  private startMeteors() {
    const sc = this.scene;
    for (let i = 0; i < 26; i++) {
      sc.time.delayedCall(i * 380, () => {
        if (sc.state === 'over') return;
        // a maioria cai perto do herói; algumas em inimigos (ajudam a limpar a tela)
        const foe = Math.random() < 0.4 ? sc.nearestEnemies(sc.player.x, sc.player.y, 6, 260)[Math.floor(Math.random() * 6)] : undefined;
        const t = foe ? { x: foe.x, y: foe.y } : this.away(0, 150);
        this.meteor(t.x, t.y);
      });
    }
  }

  private meteor(x: number, y: number) {
    const sc = this.scene;
    const r = 34;
    const warn = sc.add.graphics().setDepth(LAYER.groundFx);
    warn.fillStyle(0xff5a2a, 0.2).fillEllipse(x, y, r * 2, r * 1.5);
    warn.lineStyle(2, 0xff5a2a, 0.9).strokeEllipse(x, y, r * 2, r * 1.5);
    sc.tweens.add({ targets: warn, alpha: { from: 0.4, to: 1 }, duration: 900 });
    const view = sc.cameras.main.worldView;
    const ball = sc.add.image(x + 70, view.y - 30, 'atlas', frameName('fx_fireball')).setScale(2.2).setDepth(LAYER.fx + 2)
      .setRotation(Math.atan2(y - (view.y - 30), -70));
    sc.tweens.add({
      targets: ball, x, y, duration: 900, ease: 'Quad.In',
      onComplete: () => {
        ball.destroy();
        warn.destroy();
        sc.elements.vfx('vfx_explosion', x, y + r * 0.5, r * 2.1, [[0, 0.04], [1, 0.06], [2, 0.12], [3, 0.28]]);
        sfx('boom');
        const p = sc.player;
        // cataclismo: fere o herói e os inimigos igualmente (todo cataclismo segue esta regra)
        if ((p.x - x) ** 2 + ((p.y - y) / 0.75) ** 2 < (r + 6) ** 2) sc.hurtPlayer(Math.max(15, sc.stats.maxHp * 0.12) * sc.stage.difficulty);
        sc.queryEnemies(x, y, r + 16, (e) => {
          if (e.active && (e.x - x) ** 2 + (e.y - y) ** 2 < (r + e.radius) ** 2) sc.elementalDamage(e, Math.max(80, e.maxHp * 0.35), '#ff9a5a');
        });
      },
    });
  }

  private startAmbush() {
    const sc = this.scene;
    const pool = this.pool();
    const p = sc.player;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.random();
      sc.spawnEnemy(ENEMIES[pool[pool.length - 1]], p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 140, true);
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      sc.spawnEnemy(ENEMIES[pool[i % pool.length]], p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 165);
    }
  }

  // ---------- Guerra de tribos ----------

  /**
   * Duas tribos lutam entre si num campo perto do herói. As duas são hostis a ele: quem chega perto
   * leva ataque dos dois lados. Quando uma tribo é derrotada, fica um baú no campo.
   */
  private startWar() {
    const sc = this.scene;
    const tribes = sc.stage.tribes ?? DEFAULT_TRIBES;
    const { x, y } = this.away(250, 310);
    this.war = { x, y, until: sc.elapsed + 55 };
    this.tribes = [[], []];
    tribes.forEach((tribe, side) => {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const id = tribe.pool[i % tribe.pool.length];
        const ex = x + (side ? 1 : -1) * (60 + Math.random() * 40);
        const ey = y + (i / (n - 1) - 0.5) * 120;
        // o líder de cada tribo é um elite
        const e = sc.spawnEnemy(ENEMIES[id], ex, ey, i === 0);
        if (!e) continue;
        e.tag = 'tribe';
        e.faction = side + 1;
        this.tribes[side].push(e);
      }
    });
    sc.events.emit('announce', `GUERRA: ${tribes[0].name.toUpperCase()} x ${tribes[1].name.toUpperCase()}!`);
  }

  /** Rival mais próximo de um guerreiro (fica com o mesmo enquanto ele estiver vivo). */
  foeOf(e: Enemy): Enemy | null {
    if (e.foe?.active && e.foe.faction === 3 - e.faction) return e.foe;
    let best: Enemy | null = null;
    let bd = 260 * 260;
    for (const o of this.tribes[2 - e.faction] ?? []) {
      if (!o.active || o.faction !== 3 - e.faction) continue;
      const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    e.foe = best;
    return best;
  }

  private updateWar() {
    const w = this.war;
    if (!w) return;
    const sc = this.scene;
    this.tribes = this.tribes.map((list) => list.filter((e) => e.active && e.faction)) as [Enemy[], Enemy[]];
    const wiped = !this.tribes[0].length || !this.tribes[1].length;
    if (!wiped && sc.elapsed < w.until) return;
    // fim da guerra: quem sobrou vira inimigo comum
    for (const e of [...this.tribes[0], ...this.tribes[1]]) {
      e.faction = 0;
      e.foe = null;
      e.tag = '';
    }
    this.tribes = [[], []];
    this.war = null;
    if (!wiped) return;
    sc.completed.add('tribeWar');
    this.placeChest(w.x, w.y);
    sc.events.emit('announce', 'A GUERRA ACABOU! UM BAÚ FICOU NO CAMPO');
  }

  // ---------- Tempestade de areia ----------

  /** Cataclismo: a areia esconde a vista, o vento empurra o herói e todos (herói e inimigos) se ferem. */
  private startStorm() {
    const sc = this.scene;
    const grains = Array.from({ length: STORM.streaks }, () => ({ u: Math.random(), v: Math.random(), len: 6 + Math.random() * 18, sp: 0.5 + Math.random() * 0.7 }));
    this.storm?.veil.destroy();
    this.storm = { until: sc.elapsed + STORM.time, next: sc.elapsed + STORM.tick, wind: Math.random() < 0.5 ? -1 : 1, veil: sc.add.graphics().setDepth(LAYER.fx + 5), grains };
  }

  private updateStorm(dt: number) {
    const s = this.storm;
    if (!s) return;
    const sc = this.scene;
    const t = sc.elapsed;
    if (t >= s.until || sc.state === 'over') {
      s.veil.destroy();
      this.storm = null;
      return;
    }
    // véu de areia: entra e sai suave
    const left = s.until - t;
    const k = Math.min(1, (STORM.time - left) / 1.5, left / 1.5);
    const v = sc.cameras.main.worldView;
    const g = s.veil.clear();
    g.fillStyle(0xc89850, 0.45 * k).fillRect(v.x - 20, v.y - 20, v.width + 40, v.height + 40);
    for (const p of s.grains) {
      p.u += s.wind * p.sp * dt;
      p.v += Math.sin(t * 2 + p.len) * 0.02 * dt;
      if (p.u > 1.05) p.u -= 1.1;
      if (p.u < -0.05) p.u += 1.1;
      const x = v.x + p.u * v.width;
      const y = v.y + ((p.v % 1) + 1) % 1 * v.height;
      g.lineStyle(p.len > 16 ? 2.5 : 1.5, 0xfff0c8, 0.7 * k).lineBetween(x, y, x - s.wind * p.len * 1.6, y + p.len * 0.15);
    }
    // o vento empurra o herói de lado
    sc.player.x += s.wind * 16 * dt;
    if (t < s.next) return;
    s.next = t + STORM.tick;
    // cataclismo: fere o herói e os inimigos (chefes resistem mais)
    sc.hurtPlayer(Math.max(6, sc.stats.maxHp * 0.05) * sc.stage.difficulty);
    sc.queryEnemies(v.centerX, v.centerY, Math.hypot(v.width, v.height) / 2, (e) => {
      if (e.active && v.contains(e.x, e.y)) sc.elementalDamage(e, e.boss ? e.maxHp * 0.01 : Math.max(20, e.maxHp * 0.12), '#e8c070');
    });
  }

  /** Um inimigo de evento morreu: recompensas do goblin dourado e do chefe surpresa. */
  onKill(e: Enemy) {
    const sc = this.scene;
    if (e.tag === 'golden') {
      sc.completed.add('goldenGoblin');
      sc.events.emit('announce', 'GOBLIN DOURADO PEGO!');
      for (let i = 0; i < 30; i++) sc.dropPickup('coin', e.x + Phaser.Math.Between(-30, 30), e.y + Phaser.Math.Between(-24, 24), 4);
      this.golden = null;
    } else if (e.tag === 'surprise') {
      sc.completed.add('surpriseBoss');
      this.placeChest(e.x, e.y);
    }
  }

  // ---------- Itens no mapa ----------

  private dropItem() {
    const { x, y } = this.away(180, 300);
    const r = Math.random();
    const kind = r < 0.4 ? 'magnet' : r < 0.75 ? 'bomb' : 'heart';
    this.scene.dropPickup(kind, x, y, kind === 'heart' ? 40 : 0);
  }

  /** Para onde as setas da HUD apontam. */
  pois(): Poi[] {
    const list: Poi[] = this.chests.map((c) => ({ x: c.img.x, y: c.img.y, color: 0xffd86a }));
    if (this.captive) list.push({ x: this.captive.img.x, y: this.captive.img.y, color: 0x8cf08a });
    if (this.golden?.active) list.push({ x: this.golden.x, y: this.golden.y, color: 0xffd84a });
    this.surprises = this.surprises.filter((e) => e.active && e.tag === 'surprise');
    for (const e of this.surprises) list.push({ x: e.x, y: e.y, color: 0xff6a5a });
    if (this.war) list.push({ x: this.war.x, y: this.war.y, color: 0xffa040 });
    return list;
  }
}
