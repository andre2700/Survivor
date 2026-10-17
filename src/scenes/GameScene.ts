import Phaser from 'phaser';
import { getCharacter, type CharacterDef } from '../data/characters';
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies';
import { MAX_ENEMIES, RUN_DURATION, hpMultiplier, isEliteTime, waveAt, xpToNext } from '../data/waves';
import { Enemy, Pickup, Projectile, type PickupKind } from '../entities';
import { loadSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import { computeStats, damageAfterArmor, type PlayerStats } from '../systems/stats';
import { applyOption, rollOptions, type Loadout, type UpgradeOption } from '../systems/upgrades';
import { WeaponSystem } from '../systems/weapons';
import { FONT } from '../ui/theme';

export interface RunResult {
  victory: boolean;
  time: number;
  kills: number;
  level: number;
  gold: number;
  character: string;
}

export class GameScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private hpBar!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.TileSprite;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

  enemies!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  pickups!: Phaser.GameObjects.Group;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dmgTexts: Phaser.GameObjects.Text[] = [];
  private weapons!: WeaponSystem;

  char!: CharacterDef;
  stats!: PlayerStats;
  loadout: Loadout = { weapons: {}, passives: {} };
  private meta = loadSave().meta;

  hp = 100;
  xp = 0;
  level = 1;
  kills = 0;
  gold = 0;
  elapsed = 0;
  rerolls = 0;
  private revives = 0;
  private pendingLevels = 0;
  private invulnUntil = 0;
  private spawnAcc = 0;
  private eventsDone = new Set<number>();
  boss: Enemy | null = null;
  private bossSpawned = false;
  state: 'playing' | 'levelup' | 'paused' | 'over' = 'playing';

  facing = new Phaser.Math.Vector2(1, 0);
  /** Vetor do joystick virtual (preenchido pela HUD). */
  joy = { x: 0, y: 0 };
  private decor = new Map<string, Phaser.GameObjects.Image[]>();
  private activeCache: Enemy[] = [];
  private activeCacheFrame = -1;

  constructor() {
    super('Game');
  }

  create() {
    const save = loadSave();
    this.meta = save.meta;
    this.char = getCharacter(save.selected);
    this.loadout = { weapons: { [this.char.weapon]: 1 }, passives: {} };
    this.stats = computeStats(this.char, this.meta, this.loadout.passives);
    this.hp = this.stats.maxHp;
    this.xp = 0;
    this.level = 1;
    this.kills = 0;
    this.gold = 0;
    this.elapsed = 0;
    this.pendingLevels = 0;
    this.invulnUntil = 0;
    this.spawnAcc = 0;
    this.eventsDone.clear();
    this.boss = null;
    this.bossSpawned = false;
    this.state = 'playing';
    this.revives = this.meta.revival ?? 0;
    this.rerolls = this.meta.reroll ?? 0;
    this.joy = { x: 0, y: 0 };
    this.facing.set(1, 0);
    this.dmgTexts = [];

    const { width, height } = this.scale;
    this.ground = this.add.tileSprite(0, 0, width, height, 'ground').setOrigin(0).setScrollFactor(0).setDepth(-10);

    this.decor.clear();
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(-2);
    this.player = this.physics.add.sprite(0, 0, this.char.texture, 0);
    this.player.play(`${this.char.texture}_walk`);
    (this.player.body as Phaser.Physics.Arcade.Body).setCircle(5, 3, 5);
    this.hpBar = this.add.graphics().setDepth(100003);

    this.enemies = this.physics.add.group({ classType: Enemy, maxSize: MAX_ENEMIES + 20, runChildUpdate: false });
    this.projectiles = this.physics.add.group({ classType: Projectile, maxSize: 200, runChildUpdate: false });
    this.pickups = this.add.group({ classType: Pickup, maxSize: 400 });

    this.particles = this.add.particles(0, 0, 'px', {
      speed: { min: 30, max: 90 },
      lifespan: 350,
      scale: { start: 1, end: 0 },
      emitting: false,
    });
    this.particles.setDepth(100004);

    this.weapons = new WeaponSystem(this);
    this.weapons.sync(this.loadout.weapons);

    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.updateDecor();
    // primeiros inimigos já perto da borda, para a ação começar logo
    for (let i = 0; i < 6; i++) this.spawnEnemy(ENEMIES.slime);
    this.cameras.main.setRoundPixels(true);

    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.onPlayerTouched(e as Enemy));
    this.physics.add.overlap(this.projectiles, this.enemies, (p, e) => this.onProjectileHit(p as Projectile, e as Enemy));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    }) as typeof this.keys;
    kb.on('keydown-ESC', () => this.openPause());
    kb.on('keydown-P', () => this.openPause());

    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
      this.weapons.destroy();
    });

    this.scene.launch('Hud');
  }

  private onHidden() {
    if (this.state === 'playing') this.openPause();
  }

  update(_time: number, deltaMs: number) {
    if (this.state !== 'playing') return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const prev = this.elapsed;
    this.elapsed += dt;

    this.updatePlayer();
    this.updateEnemies(dt);
    this.weapons.update(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateSpawns(prev, dt);
    this.updateDamageTexts(dt);

    if (this.stats.regen > 0) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);

    const cam = this.cameras.main;
    this.ground.tilePositionX = cam.scrollX;
    this.ground.tilePositionY = cam.scrollY;
    this.drawPlayerHp();
    if (this.game.getFrame() % 15 === 0) this.updateDecor();
  }

  /** Decoração gerada por blocos (determinística) ao redor do jogador. */
  private updateDecor() {
    const CHUNK = 192;
    const cx = Math.floor(this.player.x / CHUNK);
    const cy = Math.floor(this.player.y / CHUNK);
    const needed = new Set<string>();
    for (let x = cx - 2; x <= cx + 2; x++) {
      for (let y = cy - 3; y <= cy + 3; y++) {
        const key = `${x},${y}`;
        needed.add(key);
        if (this.decor.has(key)) continue;
        let seed = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
        const rnd = () => {
          seed = (seed ^ (seed >>> 13)) * 1274126177;
          seed ^= seed >>> 16;
          return (seed >>> 0) / 4294967296;
        };
        const imgs: Phaser.GameObjects.Image[] = [];
        const n = 2 + Math.floor(rnd() * 4);
        for (let i = 0; i < n; i++) {
          const r = rnd();
          const tex = r < 0.3 ? 'tree' : r < 0.55 ? 'rock' : r < 0.85 ? 'bush' : 'mushroom';
          const px = x * CHUNK + rnd() * CHUNK;
          const py = y * CHUNK + rnd() * CHUNK;
          if (Math.hypot(px, py) < 60) continue;
          const img = this.add.image(Math.round(px), Math.round(py), tex).setOrigin(0.5, 1);
          img.setDepth(tex === 'tree' ? py : -3);
          imgs.push(img);
        }
        this.decor.set(key, imgs);
      }
    }
    for (const [key, imgs] of this.decor) {
      if (needed.has(key)) continue;
      imgs.forEach((i) => i.destroy());
      this.decor.delete(key);
    }
  }

  // ---------- Jogador ----------

  private updatePlayer() {
    const k = this.keys;
    let x = this.joy.x;
    let y = this.joy.y;
    if (k.left.isDown || k.a.isDown) x = -1;
    if (k.right.isDown || k.d.isDown) x = 1;
    if (k.up.isDown || k.w.isDown) y = -1;
    if (k.down.isDown || k.s.isDown) y = 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.player.setVelocity(x * this.stats.speed, y * this.stats.speed);
    if (len > 0.1) {
      this.facing.set(x, y).normalize();
      if (Math.abs(x) > 0.1) this.player.setFlipX(x < 0);
      this.player.anims.resume();
    } else {
      this.player.anims.pause(this.player.anims.currentAnim?.frames[0]);
    }
    this.player.setDepth(this.player.y);
    this.shadow.setPosition(this.player.x, this.player.y + 8);
    const blinking = this.elapsed < this.invulnUntil;
    this.player.setAlpha(blinking && Math.floor(this.elapsed * 20) % 2 === 0 ? 0.4 : 1);
  }

  private drawPlayerHp() {
    const g = this.hpBar;
    g.clear();
    const w = 16;
    const x = Math.round(this.player.x - w / 2);
    const y = Math.round(this.player.y + 11);
    g.fillStyle(0x1a1c2c, 1).fillRect(x - 1, y - 1, w + 2, 4);
    g.fillStyle(0x5d275d, 1).fillRect(x, y, w, 2);
    g.fillStyle(0xb13e53, 1).fillRect(x, y, Math.round(w * Phaser.Math.Clamp(this.hp / this.stats.maxHp, 0, 1)), 2);
  }

  private onPlayerTouched(e: Enemy) {
    if (this.state !== 'playing' || !e.active || this.elapsed < this.invulnUntil) return;
    const dmg = damageAfterArmor(e.damage, this.stats.armor);
    this.hp -= dmg;
    this.invulnUntil = this.elapsed + 0.5;
    this.cameras.main.shake(80, 0.004);
    this.player.setTintFill(0xffffff);
    this.time.delayedCall(80, () => this.player.clearTint());
    sfx('hurt');
    if (this.hp <= 0) this.onPlayerDeath();
  }

  private onPlayerDeath() {
    if (this.revives > 0) {
      this.revives--;
      this.hp = this.stats.maxHp * 0.5;
      this.invulnUntil = this.elapsed + 3;
      this.cameras.main.flash(400, 255, 255, 255);
      for (const e of this.activeEnemies()) {
        if (!e.boss && Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 120) this.killEnemy(e, false);
      }
      this.floatText(this.player.x, this.player.y - 20, 'RENASCEU!', '#ffcd75');
      return;
    }
    this.hp = 0;
    this.endRun(false);
  }

  // ---------- Inimigos ----------

  /** Inimigos ativos (cache por frame). */
  activeEnemies(): Enemy[] {
    const frame = this.game.getFrame();
    if (frame !== this.activeCacheFrame) {
      this.activeCache = (this.enemies.getChildren() as Enemy[]).filter((e) => e.active);
      this.activeCacheFrame = frame;
    }
    return this.activeCache;
  }

  nearestEnemies(x: number, y: number, count: number, maxDist: number): Enemy[] {
    const max2 = maxDist * maxDist;
    const list: { e: Enemy; d: number }[] = [];
    for (const e of this.activeEnemies()) {
      const d = Phaser.Math.Distance.Squared(x, y, e.x, e.y);
      if (d < max2) list.push({ e, d });
    }
    list.sort((a, b) => a.d - b.d);
    return list.slice(0, count).map((l) => l.e);
  }

  private spawnEnemy(def: EnemyDef, x?: number, y?: number, elite = false): Enemy | null {
    if (x === undefined || y === undefined) {
      const p = this.spawnPoint();
      x = p.x;
      y = p.y;
    }
    const e = this.enemies.get(x, y, def.texture) as Enemy | null;
    if (!e) return null;
    e.spawn(def, x, y, hpMultiplier(this.elapsed), elite);
    return e;
  }

  /** Ponto logo fora da borda visível da tela, na direção `angle`. */
  private spawnPoint(angle = Math.random() * Math.PI * 2) {
    const hw = this.scale.width / 2 + 16;
    const hh = this.scale.height / 2 + 16;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const t = Math.min(Math.abs(hw / (cos || 1e-6)), Math.abs(hh / (sin || 1e-6)));
    return { x: this.player.x + cos * t, y: this.player.y + sin * t };
  }

  private updateEnemies(dt: number) {
    const px = this.player.x;
    const py = this.player.y;
    const { width, height } = this.scale;
    const farX = width * 0.75 + 40;
    const farY = height * 0.75 + 40;
    const decay = Math.exp(-8 * dt);
    const t = this.elapsed;
    const list = this.activeEnemies();
    for (const e of list) {
      let dx = px - e.x;
      let dy = py - e.y;
      // Inimigos muito longe reaparecem à frente do jogador
      if (!e.boss && (Math.abs(dx) > farX || Math.abs(dy) > farY)) {
        const ang = Math.atan2(this.facing.y, this.facing.x) + (Math.random() - 0.5) * 1.6;
        const p = this.spawnPoint(ang);
        e.setPosition(p.x, p.y);
        dx = px - e.x;
        dy = py - e.y;
      }
      const d = Math.hypot(dx, dy) || 1;
      let vx = (dx / d) * e.speed;
      let vy = (dy / d) * e.speed;
      if (e.def.id === 'bat') {
        const wob = Math.sin(t * 6 + e.phase) * 25;
        vx += (-dy / d) * wob;
        vy += (dx / d) * wob;
      }
      e.setVelocity(vx + e.kbX, vy + e.kbY);
      e.kbX *= decay;
      e.kbY *= decay;
      e.setFlipX(dx < 0);
      e.setDepth(e.y);
      if (e.flashUntil && t > e.flashUntil) {
        e.flashUntil = 0;
        if (e.elite) e.setTint(0xffcd75);
        else e.clearTint();
      }
    }
    if (this.game.getFrame() % 2 === 0) this.separate(list);
  }

  /** Empurra inimigos sobrepostos para que não virem um único bloco (hash espacial). */
  private separate(list: Enemy[]) {
    const cell = 14;
    const grid = new Map<number, Enemy[]>();
    const key = (cx: number, cy: number) => cx * 73856093 ^ cy * 19349663;
    for (const e of list) {
      const k = key(Math.floor(e.x / cell), Math.floor(e.y / cell));
      const arr = grid.get(k);
      if (arr) arr.push(e);
      else grid.set(k, [e]);
    }
    for (const e of list) {
      const cx = Math.floor(e.x / cell);
      const cy = Math.floor(e.y / cell);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const arr = grid.get(key(cx + ox, cy + oy));
          if (!arr) continue;
          for (const o of arr) {
            if (o === e) continue;
            const dx = e.x - o.x;
            const dy = e.y - o.y;
            const min = e.worldRadius + o.worldRadius;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 === 0) continue;
            const d = Math.sqrt(d2);
            const push = ((min - d) / d) * 0.25;
            if (!e.boss) e.setPosition(e.x + dx * push, e.y + dy * push);
          }
        }
      }
    }
  }

  damageEnemy(e: Enemy, amount: number, knock = 1) {
    if (!e.active) return;
    e.hp -= amount;
    e.setTintFill(0xffffff);
    e.flashUntil = this.elapsed + 0.06;
    if (knock > 0 && e.def.knockback > 0) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = 90 * knock * e.def.knockback * (e.elite ? 0.3 : 1);
      e.kbX += (dx / d) * f;
      e.kbY += (dy / d) * f;
    }
    this.floatText(e.x, e.y - 8 * e.scaleY, String(amount), '#f4f4f4');
    sfx('hit');
    if (e.hp <= 0) this.killEnemy(e, true);
  }

  private killEnemy(e: Enemy, drops: boolean) {
    const { x, y } = e;
    const tint = e.def.id === 'slime' ? 0x38b764 : e.def.id === 'bat' ? 0x5d275d : e.def.id === 'skeleton' ? 0xf4f4f4 : 0xb13e53;
    this.particles.setParticleTint(tint);
    this.particles.explode(e.boss ? 40 : 6, x, y);
    e.disableBody(true, true);
    this.activeCacheFrame = -1;
    this.kills++;
    sfx('kill');
    if (e === this.boss) {
      this.boss = null;
      this.cameras.main.flash(600, 255, 205, 117);
      for (let i = 0; i < 30; i++) this.dropPickup('coin', x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-30, 30), 3);
      this.time.delayedCall(2000, () => this.endRun(true));
      return;
    }
    if (!drops) return;
    this.dropPickup('gem', x, y, e.xp);
    if (e.elite) {
      for (let i = 0; i < 8; i++) this.dropPickup('coin', x + Phaser.Math.Between(-16, 16), y + Phaser.Math.Between(-16, 16), 2);
      this.dropPickup('heart', x + 10, y, 30);
    } else if (Math.random() < 0.05) {
      this.dropPickup('coin', x + 4, y + 2, 1);
    } else if (Math.random() < 0.006) {
      this.dropPickup('heart', x + 4, y + 2, 20);
    }
  }

  private updateSpawns(prev: number, dt: number) {
    const t = this.elapsed;
    if (t >= RUN_DURATION && !this.bossSpawned) {
      this.bossSpawned = true;
      this.boss = this.spawnEnemy(ENEMIES.demon);
      this.cameras.main.shake(500, 0.01);
      sfx('boss');
      this.events.emit('announce', 'O CHEFE CHEGOU!');
    }
    const wave = waveAt(Math.min(t, RUN_DURATION - 1));
    const rate = this.bossSpawned ? 2 : wave.rate;
    this.spawnAcc += rate * dt;
    const alive = this.activeEnemies().length;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (alive >= Math.min(MAX_ENEMIES, this.bossSpawned ? 120 : wave.max)) continue;
      const id = wave.pool[Math.floor(Math.random() * wave.pool.length)];
      this.spawnEnemy(ENEMIES[id]);
    }
    if (isEliteTime(prev, t)) {
      const id = wave.pool[wave.pool.length - 1];
      this.spawnEnemy(ENEMIES[id], undefined, undefined, true);
      this.events.emit('announce', 'UM INIMIGO ELITE SURGIU!');
    }
    const minute = Math.floor(t / 60);
    if (wave.event && wave.minute === minute && !this.eventsDone.has(minute) && t - minute * 60 > 5) {
      this.eventsDone.add(minute);
      this.runEvent(wave.event);
    }
  }

  private runEvent(kind: 'swarm' | 'ring') {
    if (kind === 'swarm') {
      this.events.emit('announce', 'UMA REVOADA SE APROXIMA!');
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < 30; i++) {
        const p = this.spawnPoint(base + (Math.random() - 0.5) * 0.8);
        const e = this.spawnEnemy(ENEMIES.bat, p.x + Phaser.Math.Between(-30, 30), p.y + Phaser.Math.Between(-30, 30));
        if (e) e.speed *= 1.4;
      }
    } else {
      this.events.emit('announce', 'VOCÊ ESTÁ CERCADO!');
      const n = 32;
      const id: EnemyId = this.elapsed > 400 ? 'orc' : 'skeleton';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.spawnEnemy(ENEMIES[id], this.player.x + Math.cos(a) * 190, this.player.y + Math.sin(a) * 190);
      }
    }
  }

  // ---------- Projéteis ----------

  private onProjectileHit(p: Projectile, e: Enemy) {
    if (!p.active || !e.active) return;
    if (!WeaponSystem.projectileHit(p, e)) return;
    this.damageEnemy(e, p.damage, p.kind === 'axe' ? 0.5 : 0.8);
    if (p.pierce <= 0) p.disableBody(true, true);
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles.getChildren() as Projectile[]) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.spin) p.rotation += p.spin * dt;
      if (p.life <= 0) p.disableBody(true, true);
    }
  }

  // ---------- Coletáveis ----------

  private dropPickup(kind: PickupKind, x: number, y: number, value: number) {
    const active = this.pickups.countActive(true);
    if (kind === 'gem' && active > 300) {
      // muitas gemas: soma o valor numa gema existente
      const gems = (this.pickups.getChildren() as Pickup[]).filter((p) => p.active && p.kind === 'gem');
      const g = gems[Math.floor(Math.random() * gems.length)];
      if (g) {
        g.value += value;
        this.setGemTexture(g);
        return;
      }
    }
    const p = this.pickups.get(x, y) as Pickup | null;
    if (!p) return;
    p.setActive(true).setVisible(true).setPosition(x, y);
    p.kind = kind;
    p.value = value;
    p.magnet = false;
    p.vel = 0;
    p.setDepth(-1);
    if (kind === 'gem') this.setGemTexture(p);
    else p.setTexture(kind);
  }

  private setGemTexture(p: Pickup) {
    p.setTexture(p.value >= 10 ? 'gem_red' : p.value >= 3 ? 'gem_green' : 'gem');
  }

  private updatePickups(dt: number) {
    const px = this.player.x;
    const py = this.player.y;
    const mag2 = this.stats.magnet * this.stats.magnet;
    for (const p of this.pickups.getChildren() as Pickup[]) {
      if (!p.active) continue;
      const dx = px - p.x;
      const dy = py - p.y;
      const d2 = dx * dx + dy * dy;
      if (!p.magnet && d2 < mag2) p.magnet = true;
      if (!p.magnet) continue;
      const d = Math.sqrt(d2);
      if (d < 8) {
        this.collect(p);
        continue;
      }
      p.vel = Math.min(p.vel + 600 * dt, 400);
      const step = Math.min(d, p.vel * dt);
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }

  private collect(p: Pickup) {
    p.setActive(false).setVisible(false);
    if (p.kind === 'gem') {
      this.addXp(p.value * this.stats.xpGain);
      sfx('pickup');
    } else if (p.kind === 'coin') {
      this.gold += p.value * this.stats.goldGain;
      sfx('pickup');
    } else {
      this.hp = Math.min(this.stats.maxHp, this.hp + p.value);
      this.floatText(this.player.x, this.player.y - 14, `+${p.value}`, '#38b764');
      sfx('select');
    }
  }

  /** Atrai todas as gemas (usado ao subir de nível com muitos itens ou por debug). */
  vacuum() {
    for (const p of this.pickups.getChildren() as Pickup[]) if (p.active) p.magnet = true;
  }

  // ---------- Experiência e nível ----------

  get xpNext() {
    return xpToNext(this.level);
  }

  addXp(v: number) {
    this.xp += v;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.pendingLevels++;
    }
    if (this.pendingLevels > 0 && this.state === 'playing') this.openLevelUp();
  }

  private openLevelUp() {
    this.state = 'levelup';
    this.joy.x = this.joy.y = 0;
    this.player.setVelocity(0, 0);
    sfx('levelup');
    this.scene.pause();
    this.scene.pause('Hud');
    this.scene.launch('LevelUp', { options: rollOptions(this.loadout, 3), rerolls: this.rerolls });
  }

  rerollOptions(): UpgradeOption[] | null {
    if (this.rerolls <= 0) return null;
    this.rerolls--;
    return rollOptions(this.loadout, 3);
  }

  chooseUpgrade(opt: UpgradeOption) {
    if (opt.kind === 'gold') this.gold += 25;
    else if (opt.kind === 'heal') this.hp = Math.min(this.stats.maxHp, this.hp + 40);
    else applyOption(this.loadout, opt);
    const oldMax = this.stats.maxHp;
    this.stats = computeStats(this.char, this.meta, this.loadout.passives);
    if (this.stats.maxHp > oldMax) this.hp += this.stats.maxHp - oldMax;
    this.weapons.sync(this.loadout.weapons);
    this.pendingLevels--;
    if (this.pendingLevels > 0) {
      this.scene.get('LevelUp').scene.restart({ options: rollOptions(this.loadout, 3), rerolls: this.rerolls });
      return;
    }
    this.scene.stop('LevelUp');
    this.state = 'playing';
    this.scene.resume();
    this.scene.resume('Hud');
  }

  // ---------- Pausa e fim ----------

  openPause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.joy.x = this.joy.y = 0;
    this.scene.pause();
    this.scene.pause('Hud');
    this.scene.launch('Pause');
  }

  resumeFromPause() {
    this.scene.stop('Pause');
    this.state = 'playing';
    this.scene.resume();
    this.scene.resume('Hud');
  }

  endRun(victory: boolean) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.physics.pause();
    this.player.setVelocity(0, 0);
    const result: RunResult = {
      victory,
      time: this.elapsed,
      kills: this.kills,
      level: this.level,
      gold: Math.floor(this.gold),
      character: this.char.id,
    };
    this.time.delayedCall(victory ? 0 : 600, () => {
      this.scene.pause();
      this.scene.stop('Hud');
      this.scene.launch('GameOver', result);
    });
    if (!victory) {
      this.player.setTint(0xb13e53);
      this.tweens.add({ targets: this.player, angle: 90, alpha: 0.5, duration: 500 });
    }
  }

  // ---------- Textos flutuantes ----------

  floatText(x: number, y: number, str: string, color: string) {
    let t = this.dmgTexts.find((d) => !d.active);
    if (!t) {
      if (this.dmgTexts.length >= 30) return;
      t = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '8px', color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 2 }).setOrigin(0.5);
      this.dmgTexts.push(t);
    }
    t.setActive(true).setVisible(true).setPosition(Math.round(x), Math.round(y)).setText(str).setColor(color).setAlpha(1).setDepth(100005);
    t.setData('life', 0.6);
  }

  private updateDamageTexts(dt: number) {
    for (const t of this.dmgTexts) {
      if (!t.active) continue;
      const life = (t.getData('life') as number) - dt;
      t.setData('life', life);
      t.y -= 20 * dt;
      if (life < 0.2) t.setAlpha(life / 0.2);
      if (life <= 0) t.setActive(false).setVisible(false);
    }
  }

  /** Itens possuídos, para a HUD. */
  get ownedWeapons() {
    return this.weapons.owned;
  }
}
