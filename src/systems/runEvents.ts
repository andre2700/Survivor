// Eventos aleatórios dentro da partida (Marco 3): baú guardado, prisioneiro que vira aliado, chefe
// surpresa, goblin dourado, chuva de meteoros e emboscada. Também espalha itens pelo mapa (ímã, bomba,
// cura) e diz à HUD para onde apontar as setas de borda. Cada fase escolhe os seus eventos.
import Phaser from 'phaser';
import { walkPose } from '../art/motion';
import { frameName, slotsOf } from '../art/textures';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { ENEMIES, type EnemyId } from '../data/enemies';
import type { RunEventId } from '../data/stages';
import { waveAt } from '../data/waves';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import { moveSpeed } from '../core/stats';
import { waveClock } from './dev';
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
};

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
    const pool = st.events.filter((e) => !(e === 'captive' && (this.captive || this.ally)) && !(e === 'goldenGoblin' && this.golden));
    return pool[Math.floor(Math.random() * pool.length)] ?? 'ambush';
  }

  start(id: RunEventId) {
    this.done.add(id);
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
    a.cooldown = 0.6;
    const dmg = 6 + sc.level * 1.5;
    const ang = Math.atan2(target.y - a.img.y, target.x - a.img.x);
    a.img.setFlipX(Math.cos(ang) < 0);
    const ranged = a.hero.weapon === 'wand' || a.hero.weapon === 'knives';
    if (ranged) {
      const pr = sc.projectiles.get();
      if (!pr) return;
      const tex = a.hero.weapon === 'wand' ? 'proj_bolt' : 'proj_knife';
      pr.fire(a.hero.weapon === 'wand' ? 'bolt' : 'knife', tex, a.img.x, a.img.y - 6, Math.cos(ang) * 280, Math.sin(ang) * 280, dmg, 1, 1.2, 1, a.hero.weapon === 'wand' ? 'light' : 'physical', 0.5);
      pr.owner = null;
    } else if (Math.hypot(target.x - a.img.x, target.y - a.img.y) < 40) {
      sc.hitEnemy(target, dmg * 1.6, 1, 'physical', true, 0.5);
      sc.impact(target.x, target.y - 4, 0xffffff, 0.6);
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
    e.tag = 'surprise';
    e.baseScale *= 1.5;
    e.radius *= 1.5;
    e.maxHp *= 3;
    e.hp = e.maxHp;
    e.setTint(0xff9a8a);
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
        if ((p.x - x) ** 2 + ((p.y - y) / 0.75) ** 2 < (r + 6) ** 2) sc.hurtPlayer(20 * sc.stage.difficulty);
        sc.queryEnemies(x, y, r + 16, (e) => {
          if (e.active && (e.x - x) ** 2 + (e.y - y) ** 2 < (r + e.radius) ** 2) sc.elementalDamage(e, 60 + sc.level * 8, '#ff9a5a');
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
    return list;
  }
}
