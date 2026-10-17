import Phaser from 'phaser';
import { VIEW } from '../ui/view';
import { HERO_ATTACK_FRAME, walkPose } from '../art/motion';
import { frameName, groundSprite, scrollGround } from '../art/textures';
import { formatNumber } from '../core/format';
import { SpatialGrid } from '../core/grid';
import {
  BASE_STATS, combine, critMultiplier, damageTaken, dodgeChance, goldMult, moveSpeed, rollCritTier, xpMult,
  type Modifier, type Stats,
} from '../core/stats';
import { getCharacter, type CharacterDef } from '../data/characters';
import { DEATH_TINT, ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies';
import { metaModifiers } from '../data/meta';
import { ELEMENT_COLORS, type Element } from '../data/weapons';
import {
  ENDLESS_CYCLE, MAX_ENEMIES, RUN_DURATION, WAVES, endlessScaling, hpMultiplier, isEliteTime, waveAt, xpToNext,
} from '../data/waves';
import { Enemy, Pickup, Pool, Projectile, type PickupKind } from '../entities';
import { loadSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import {
  applyOption, loadoutModifiers, optionKey, rollOptions, type Loadout, type UpgradeOption,
} from '../systems/upgrades';
import { WeaponSystem } from '../systems/weapons';
import { FONT, px } from '../ui/theme';

/**
 * Camadas de desenho. Personagens usam a coordenada Y como profundidade (quem está mais
 * abaixo na tela fica na frente), então as camadas do chão precisam ficar bem abaixo de
 * qualquer Y possível e as de efeitos/interface bem acima.
 */
/** Aproximação extra da câmera do jogo: personagens maiores na tela do celular. */
export const WORLD_ZOOM = 1.2;

export const LAYER = {
  ground: -3e9,
  groundDecor: -2e9,
  groundFx: -1.5e9,
  pickups: -1e9,
  fx: 1e9,
  text: 1.5e9,
  overlay: 2e9,
};

export interface RunResult {
  victory: boolean;
  endless: boolean;
  cycle: number;
  time: number;
  kills: number;
  level: number;
  gold: number;
  character: string;
  weapons: { id: string; level: number; dealt: number }[];
}

export interface LevelUpData {
  options: UpgradeOption[];
}

export class GameScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Image;
  private hpBar!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.TileSprite;
  private vignette!: Phaser.GameObjects.Image;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

  enemies!: Pool<Enemy>;
  projectiles!: Pool<Projectile>;
  private pickups!: Pool<Pickup>;
  private grid = new SpatialGrid<Enemy>(32);
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private flames!: Phaser.GameObjects.Particles.ParticleEmitter;
  private motes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dmgTexts: Phaser.GameObjects.Text[] = [];
  private weapons!: WeaponSystem;

  char!: CharacterDef;
  stats: Stats = { ...BASE_STATS };
  private baseMods: Modifier[] = [];
  loadout: Loadout = { weapons: {}, stats: {} };

  hp = 100;
  xp = 0;
  level = 1;
  kills = 0;
  gold = 0;
  elapsed = 0;
  rerolls = 0;
  banishes = 0;
  locks = 0;
  numOptions = 3;
  banned = new Set<string>();
  lockedNext: UpgradeOption[] = [];
  currentOptions: UpgradeOption[] = [];
  private revivesLeft = 0;
  private pendingLevels = 0;
  private invulnUntil = 0;
  private attackUntil = 0;
  private playerFrame = 0;
  private spawnAcc = 0;
  private eventsDone = new Set<number>();
  boss: Enemy | null = null;
  private bossSpawned = false;
  endless = false;
  private endlessStart = 0;
  private bossesSpawned = 0;
  state: 'playing' | 'levelup' | 'paused' | 'victory' | 'over' = 'playing';

  facing = new Phaser.Math.Vector2(1, 0);
  /** Vetor do joystick virtual (preenchido pela HUD). */
  joy = { x: 0, y: 0 };
  private active: Enemy[] = [];
  private frame = 0;
  private decor = new Map<string, Phaser.GameObjects.Image[]>();
  private tallDecor: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Game');
  }

  /** Área visível do mundo (unidades do jogo). */
  get viewW() {
    return VIEW.width / WORLD_ZOOM;
  }

  get viewH() {
    return VIEW.height / WORLD_ZOOM;
  }

  create() {
    const save = loadSave();
    this.char = getCharacter(save.selected);
    this.baseMods = [...this.char.mods, ...metaModifiers(save.meta)];
    this.loadout = { weapons: { [this.char.weapon]: 1 }, stats: {} };
    this.recomputeStats();
    this.hp = this.stats.maxHp;
    this.xp = 0;
    this.level = 1;
    this.kills = 0;
    this.gold = 0;
    this.elapsed = 0;
    this.pendingLevels = 0;
    this.invulnUntil = 0;
    this.attackUntil = 0;
    this.playerFrame = 0;
    this.spawnAcc = 0;
    this.eventsDone.clear();
    this.boss = null;
    this.bossSpawned = false;
    this.endless = false;
    this.endlessStart = 0;
    this.bossesSpawned = 0;
    this.state = 'playing';
    this.revivesLeft = Math.floor(this.stats.revives);
    this.rerolls = save.meta.reroll ?? 0;
    this.banishes = save.meta.banish ?? 0;
    this.locks = save.meta.lock ?? 0;
    this.numOptions = 3 + (save.meta.choices ?? 0);
    this.banned = new Set();
    this.lockedNext = [];
    this.currentOptions = [];
    this.joy = { x: 0, y: 0 };
    this.facing.set(1, 0);
    this.dmgTexts = [];
    this.active = [];
    this.decor.clear();

    const width = this.viewW;
    const height = this.viewH;
    // chão e vinheta acompanham a câmera (com margem para não aparecer borda)
    this.ground = groundSprite(this, 0, 0, width + 128, height + 128).setOrigin(0).setDepth(LAYER.ground);
    this.player = this.add.image(0, 0, 'atlas', frameName(this.char.texture)).setOrigin(0.5, 0.68);
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(width + 40, height + 40).setDepth(LAYER.overlay);
    this.hpBar = this.add.graphics().setDepth(LAYER.fx + 4);

    this.enemies = new Pool(this, (s) => new Enemy(s), MAX_ENEMIES + 1500);
    this.projectiles = new Pool(this, (s) => new Projectile(s), 3000);
    this.pickups = new Pool(this, (s) => new Pickup(s), 500);

    this.particles = this.add.particles(0, 0, 'atlas', {
      frame: frameName('px'),
      speed: { min: 40, max: 120 },
      lifespan: { min: 250, max: 500 },
      scale: { start: 1.4, end: 0 },
      gravityY: 120,
      emitting: false,
    });
    this.particles.setDepth(LAYER.fx);
    this.sparks = this.add.particles(0, 0, 'atlas', {
      frame: frameName('px'),
      speed: { min: 60, max: 160 },
      lifespan: 200,
      scale: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.sparks.setDepth(LAYER.fx + 2);
    this.flames = this.add.particles(0, 0, 'atlas', {
      frame: frameName('glow'),
      speedY: { min: -40, max: -15 },
      speedX: { min: -6, max: 6 },
      lifespan: 450,
      scale: { start: 0.32, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffe48a, 0xffa22e, 0xe8551a],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.flames.setDepth(LAYER.fx + 1);
    // vaga-lumes/pólen flutuando no ar (dão vida ao cenário)
    this.motes = this.add.particles(0, 0, 'atlas', {
      frame: frameName('glow'),
      x: { min: -width / 2, max: width / 2 },
      y: { min: -height / 2, max: height / 2 },
      lifespan: 5000,
      speedX: { min: -6, max: 6 },
      speedY: { min: -10, max: 2 },
      scale: { min: 0.08, max: 0.16 },
      alpha: { values: [0, 0.8, 0.8, 0] },
      tint: [0xfff2a8, 0xd8ffb0],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 700,
    });
    this.motes.setDepth(LAYER.fx + 3);

    this.weapons = new WeaponSystem(this);
    this.weapons.sync(this.loadout.weapons);

    this.cameras.main.setZoom(VIEW.zoom * WORLD_ZOOM);
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
    this.cameras.main.setBackgroundColor('#2f6a3a');
    this.cameras.main.setRoundPixels(true);
    this.updateDecor();
    for (let i = 0; i < 6; i++) this.spawnEnemy(ENEMIES.slime);

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

  /** Atributos atuais = base + personagem + progressão permanente + cartas da partida. */
  recomputeStats() {
    this.stats = combine(BASE_STATS, [...this.baseMods, ...loadoutModifiers(this.loadout)]);
  }

  /** Atributos se `extra` fosse somado (para mostrar "antes → depois" nas cartas). */
  statsWith = (extra: Modifier[]): Stats => combine(BASE_STATS, [...this.baseMods, ...loadoutModifiers(this.loadout), ...extra]);

  update(_time: number, deltaMs: number) {
    if (this.state !== 'playing') return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const prev = this.elapsed;
    this.elapsed += dt;
    this.frame++;

    this.updatePlayer();
    this.updateEnemies(dt);
    this.weapons.update(dt);
    this.updateProjectiles(dt);
    this.checkContact();
    this.updatePickups(dt);
    this.updateSpawns(prev, dt);
    this.updateDamageTexts(dt);

    if (this.stats.regen > 0) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);

    const cam = this.cameras.main;
    const vx = Math.floor(this.player.x - this.viewW / 2);
    const vy = Math.floor(this.player.y - this.viewH / 2);
    this.ground.setPosition(vx - 64, vy - 64);
    scrollGround(this.ground, vx - 64, vy - 64);
    this.vignette.setPosition(cam.midPoint.x - this.viewW / 2 - 20, cam.midPoint.y - this.viewH / 2 - 20);
    this.motes.setPosition(cam.midPoint.x, cam.midPoint.y);
    this.drawPlayerHp();
    if (this.frame % 15 === 0) this.updateDecor();
    this.fadeTrees();
  }

  // ---------- Jogador ----------

  /** Mostra o quadro de ataque do herói por um instante (arma inicial disparou). */
  playerAttack() {
    this.attackUntil = this.elapsed + 0.18;
  }

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
    const speed = moveSpeed(this.stats);
    const dt = Math.min(this.game.loop.delta, 50) / 1000;
    this.player.x += x * speed * dt;
    this.player.y += y * speed * dt;
    const moving = len > 0.1;
    if (moving) {
      this.facing.set(x, y).normalize();
      if (Math.abs(x) > 0.1) this.player.setFlipX(x < 0);
    }
    const pose = walkPose('hero', this.elapsed, moving);
    const frame = this.elapsed < this.attackUntil ? HERO_ATTACK_FRAME : pose.frame;
    if (frame !== this.playerFrame) {
      this.playerFrame = frame;
      this.player.setFrame(frameName(this.char.texture, frame));
    }
    this.player.setScale(pose.sx, pose.sy).setRotation(this.player.flipX ? -pose.rot : pose.rot);
    this.player.setDepth(this.player.y);
    const blinking = this.elapsed < this.invulnUntil;
    this.player.setAlpha(blinking && Math.floor(this.elapsed * 20) % 2 === 0 ? 0.4 : 1);
  }

  private drawPlayerHp() {
    const g = this.hpBar;
    g.clear();
    const w = 16;
    const x = Math.round(this.player.x - w / 2);
    const y = Math.round(this.player.y + 17);
    const frac = Phaser.Math.Clamp(this.hp / this.stats.maxHp, 0, 1);
    g.fillStyle(0x140c1c, 0.85).fillRect(x - 1, y - 1, w + 2, 5);
    g.fillStyle(0x4a1424, 1).fillRect(x, y, w, 3);
    g.fillStyle(frac > 0.35 ? 0x4fd06a : 0xe8463a, 1).fillRect(x, y, Math.round(w * frac), 3);
    g.fillStyle(0xffffff, 0.35).fillRect(x, y, Math.round(w * frac), 1);
  }

  private checkContact() {
    if (this.elapsed < this.invulnUntil) return;
    const px = this.player.x;
    const py = this.player.y;
    let touched: Enemy | null = null;
    this.grid.query(px, py, 40, (e) => {
      if (!e.active) return;
      const r = e.radius + 8;
      if ((e.x - px) ** 2 + (e.y - py) ** 2 < r * r) {
        touched = e;
        return true;
      }
    });
    if (touched) this.onPlayerTouched(touched);
  }

  private onPlayerTouched(e: Enemy) {
    if (this.state !== 'playing' || !e.active || this.elapsed < this.invulnUntil) return;
    this.invulnUntil = this.elapsed + 0.5;
    if (Math.random() < dodgeChance(this.stats)) {
      this.floatText(this.player.x, this.player.y - 16, 'ESQUIVA', '#a7f070');
      return;
    }
    const dmg = damageTaken(e.damage, this.stats);
    this.hp -= dmg;
    if (this.stats.thorns > 0) this.hitEnemy(e, this.stats.thorns, 0.5, 'physical', false);
    this.cameras.main.shake(80, 0.004);
    this.player.setTintFill(0xffffff);
    this.time.delayedCall(80, () => this.player.clearTint());
    sfx('hurt');
    if (this.hp <= 0) this.onPlayerDeath();
  }

  private onPlayerDeath() {
    if (this.revivesLeft > 0) {
      this.revivesLeft--;
      this.hp = this.stats.maxHp * 0.5;
      this.invulnUntil = this.elapsed + 3;
      this.cameras.main.flash(400, 255, 255, 255);
      this.queryEnemies(this.player.x, this.player.y, 120, (e) => {
        if (!e.boss) this.killEnemy(e, false);
      });
      this.floatText(this.player.x, this.player.y - 20, 'RENASCEU!', '#ffcd75');
      return;
    }
    this.hp = 0;
    this.endRun(this.endless);
  }

  // ---------- Inimigos ----------

  activeEnemies(): Enemy[] {
    return this.active;
  }

  /** Chama `fn` para inimigos ativos perto de (x, y) — consulta a grade espacial. */
  queryEnemies(x: number, y: number, r: number, fn: (e: Enemy) => void) {
    this.grid.query(x, y, r, (e) => {
      if (e.active) fn(e);
    });
  }

  nearestEnemies(x: number, y: number, count: number, maxDist: number): Enemy[] {
    const list: { e: Enemy; d: number }[] = [];
    // começa perto e expande o raio até achar o suficiente
    for (let r = 64; r <= maxDist * 2 && list.length < count; r *= 2) {
      list.length = 0;
      const lim = Math.min(r, maxDist);
      this.queryEnemies(x, y, lim, (e) => {
        const d = (e.x - x) ** 2 + (e.y - y) ** 2;
        if (d < lim * lim) list.push({ e, d });
      });
      if (lim >= maxDist) break;
    }
    list.sort((a, b) => a.d - b.d);
    return list.slice(0, count).map((l) => l.e);
  }

  private difficulty() {
    if (!this.endless) return { hp: hpMultiplier(this.elapsed), damage: 1, reward: 1 };
    const s = endlessScaling(this.cycle);
    return { hp: hpMultiplier(RUN_DURATION) * s.hp, damage: s.damage, reward: s.reward };
  }

  /** Ciclo atual do modo infinito (1 = primeiros 5 min após a vitória). */
  get cycle() {
    return this.endless ? 1 + Math.floor((this.elapsed - this.endlessStart) / ENDLESS_CYCLE) : 0;
  }

  spawnEnemy(def: EnemyDef, x?: number, y?: number, elite = false): Enemy | null {
    if (x === undefined || y === undefined) {
      const p = this.spawnPoint();
      x = p.x;
      y = p.y;
    }
    const e = this.enemies.get();
    if (!e) return null;
    const d = this.difficulty();
    const curse = 1 + this.stats.curse;
    e.spawn(def, x, y, d.hp * (def.id === 'demon' ? 1 : curse), d.damage, elite);
    e.alpha = 0;
    this.active.push(e);
    return e;
  }

  /** Ponto logo fora da borda visível, na direção `angle`. */
  private spawnPoint(angle = Math.random() * Math.PI * 2) {
    const hw = this.viewW / 2 + 20;
    const hh = this.viewH / 2 + 20;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const t = Math.min(Math.abs(hw / (cos || 1e-6)), Math.abs(hh / (sin || 1e-6)));
    return { x: this.player.x + cos * t, y: this.player.y + sin * t };
  }

  private updateEnemies(dt: number) {
    const px = this.player.x;
    const py = this.player.y;
    const farX = this.viewW * 0.75 + 40;
    const farY = this.viewH * 0.75 + 40;
    const decay = Math.exp(-8 * dt);
    const t = this.elapsed;
    this.grid.clear();
    const list = this.active;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      list[w++] = e;
      let dx = px - e.x;
      let dy = py - e.y;
      if (!e.boss && (Math.abs(dx) > farX || Math.abs(dy) > farY)) {
        const p = this.spawnPoint(Math.atan2(this.facing.y, this.facing.x) + (Math.random() - 0.5) * 1.6);
        e.x = p.x;
        e.y = p.y;
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
      e.x += (vx + e.kbX) * dt;
      e.y += (vy + e.kbY) * dt;
      e.kbX *= decay;
      e.kbY *= decay;
      e.flipX = dx < 0;
      e.depth = e.y;
      if (e.alpha < 1) e.alpha = Math.min(1, e.alpha + dt * 3);
      const pose = walkPose(e.def.id, t + e.phase);
      if (pose.frame !== e.animFrame) {
        e.animFrame = pose.frame;
        e.setFrame(frameName(e.def.texture, pose.frame));
      }
      e.scaleX = e.baseScale * pose.sx;
      e.scaleY = e.baseScale * pose.sy;
      e.rotation = e.flipX ? -pose.rot : pose.rot;
      if (e.flashUntil && t > e.flashUntil) {
        e.flashUntil = 0;
        if (e.elite) e.setTint(0xffcd75);
        else e.clearTint();
      }
      this.grid.insert(e);
    }
    list.length = w;
    this.separate(list);
  }

  /** Empurra inimigos sobrepostos (um terço por frame, para escalar). */
  private separate(list: Enemy[]) {
    const part = this.frame % 3;
    for (let i = part; i < list.length; i += 3) {
      const e = list[i];
      if (e.boss) continue;
      this.grid.query(e.x, e.y, e.radius * 2, (o) => {
        if (o === e) return;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const min = e.radius + o.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) return;
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.35;
        e.x += dx * push;
        e.y += dy * push;
      });
    }
  }

  /** Aplica dano (com crítico); retorna o dano causado. */
  hitEnemy(e: Enemy, amount: number, knock = 1, element: Element = 'physical', canCrit = true): number {
    if (!e.active) return 0;
    const tier = canCrit ? rollCritTier(this.stats.critChance) : 0;
    const dmg = amount * critMultiplier(this.stats, tier);
    e.hp -= dmg;
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
    if (this.stats.lifesteal > 0) this.hp = Math.min(this.stats.maxHp, this.hp + dmg * this.stats.lifesteal * 0.1);
    const color = tier >= 2 ? '#ef7d57' : tier === 1 ? '#ffcd75' : ELEMENT_COLORS[element];
    this.floatText(e.x, e.y - 16 * e.baseScale, formatNumber(dmg) + (tier >= 2 ? '!!' : tier === 1 ? '!' : ''), color, tier > 0);
    if (this.frame % 2 === 0) this.sparks.explode(tier > 0 ? 4 : 2, e.x, e.y - 4);
    sfx('hit');
    if (e.hp <= 0) this.killEnemy(e, true);
    return dmg;
  }

  private killEnemy(e: Enemy, drops: boolean) {
    const { x, y } = e;
    this.particles.setParticleTint(DEATH_TINT[e.def.id]);
    this.particles.explode(e.boss ? 60 : e.elite ? 20 : 6, x, y);
    if (e.boss || e.elite) this.impact(x, y, 0xffcd75, e.boss ? 3 : 1.6);
    e.kill();
    this.kills++;
    sfx('kill');
    const reward = this.difficulty().reward;
    if (e === this.boss) {
      this.boss = null;
      this.cameras.main.flash(600, 255, 205, 117);
      for (let i = 0; i < 30; i++) this.dropPickup('coin', x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-30, 30), 3 * reward);
      this.dropPickup('gem', x, y, e.xp * reward);
      if (!this.endless) {
        this.time.delayedCall(1500, () => this.openVictory());
      } else {
        this.events.emit('announce', 'CHEFE DERROTADO!');
      }
      return;
    }
    if (!drops) return;
    this.dropPickup('gem', x, y, e.xp);
    if (e.elite) {
      for (let i = 0; i < 8; i++) this.dropPickup('coin', x + Phaser.Math.Between(-16, 16), y + Phaser.Math.Between(-16, 16), 2 * reward);
      this.dropPickup('heart', x + 10, y, 30);
    } else if (Math.random() < 0.05) {
      this.dropPickup('coin', x + 4, y + 2, reward);
    } else if (Math.random() < 0.006) {
      this.dropPickup('heart', x + 4, y + 2, 20);
    }
  }

  private updateSpawns(prev: number, dt: number) {
    const t = this.elapsed;
    // chefe da partida padrão
    if (!this.endless && t >= RUN_DURATION && !this.bossSpawned) {
      this.bossSpawned = true;
      this.spawnBoss();
    }
    // chefes do modo infinito: um no fim de cada ciclo
    if (this.endless) {
      const due = Math.floor((t - this.endlessStart) / ENDLESS_CYCLE);
      if (due > this.bossesSpawned) {
        this.bossesSpawned = due;
        this.spawnBoss();
        this.events.emit('announce', `CICLO ${this.cycle}: INIMIGOS MAIS FORTES!`);
      }
    }

    let rate: number;
    let max: number;
    let wave = waveAt(Math.min(t, RUN_DURATION - 1));
    if (this.endless) {
      const s = endlessScaling(this.cycle);
      wave = WAVES[WAVES.length - 1];
      rate = wave.rate * s.rate;
      max = s.max;
    } else {
      rate = this.bossSpawned ? 2 : wave.rate;
      max = this.bossSpawned ? 120 : wave.max;
    }
    rate *= 1 + this.stats.curse;
    max = Math.min(MAX_ENEMIES, Math.round(max * (1 + this.stats.curse)));
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.active.length >= max) continue;
      const id = wave.pool[Math.floor(Math.random() * wave.pool.length)];
      this.spawnEnemy(ENEMIES[id]);
    }
    if (isEliteTime(prev, t) && (this.endless || t < RUN_DURATION)) {
      const id = wave.pool[wave.pool.length - 1];
      this.spawnEnemy(ENEMIES[id], undefined, undefined, true);
      this.events.emit('announce', 'UM INIMIGO ELITE SURGIU!');
    }
    const minute = Math.floor(t / 60);
    const event = this.endless ? (minute % 2 === 0 ? 'swarm' : 'ring') : wave.minute === minute ? wave.event : undefined;
    if (event && !this.eventsDone.has(minute) && t - minute * 60 > 5) {
      this.eventsDone.add(minute);
      this.runEvent(event);
    }
  }

  private spawnBoss() {
    const scale = this.endless ? endlessScaling(this.cycle).hp : 1;
    const e = this.spawnEnemy(ENEMIES.demon);
    if (e) {
      e.maxHp = Math.round(ENEMIES.demon.hp * scale);
      e.hp = e.maxHp;
      this.boss = e;
    }
    this.cameras.main.shake(500, 0.01);
    sfx('boss');
    this.events.emit('announce', 'O CHEFE CHEGOU!');
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
      const n = 28;
      const id: EnemyId = this.elapsed > 400 ? 'orc' : 'skeleton';
      // deixa uma brecha no anel para o jogador conseguir escapar
      const gap = Math.floor(Math.random() * n);
      for (let i = 0; i < n; i++) {
        if ((i - gap + n) % n < 5) continue;
        const a = (i / n) * Math.PI * 2;
        this.spawnEnemy(ENEMIES[id], this.player.x + Math.cos(a) * 190, this.player.y + Math.sin(a) * 190);
      }
    }
  }

  // ---------- Projéteis ----------

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles.items) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.kill();
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rotation += p.spin * dt;
      this.grid.query(p.x, p.y, p.radius + 16, (e) => {
        if (!e.active || p.hits.has(e.uid)) return;
        const r = p.radius + e.radius;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 >= r * r) return;
        p.hits.add(e.uid);
        const dealt = this.hitEnemy(e, p.damage, p.kind === 'axe' ? 0.5 : 0.8, p.element);
        if (p.owner) this.weapons.credit(p.owner, dealt);
        p.pierce--;
        if (p.pierce <= 0) {
          p.kill();
          return true;
        }
      });
    }
  }

  // ---------- Coletáveis ----------

  private dropPickup(kind: PickupKind, x: number, y: number, value: number) {
    if (kind === 'gem' && this.pickups.countActive() > 300) {
      // muitas gemas: soma o valor numa gema existente
      const gems = this.pickups.items.filter((p) => p.active && p.kind === 'gem');
      const g = gems[Math.floor(Math.random() * gems.length)];
      if (g) {
        g.value += value;
        this.setGemTexture(g);
        return;
      }
    }
    const p = this.pickups.get();
    if (!p) return;
    p.setActive(true).setVisible(true).setPosition(x, y).setScale(1).setDepth(LAYER.pickups);
    p.kind = kind;
    p.value = value;
    p.magnet = false;
    p.vel = 0;
    if (kind === 'gem') this.setGemTexture(p);
    else p.setFrame(frameName(kind));
  }

  private setGemTexture(p: Pickup) {
    p.setFrame(frameName(p.value >= 10 ? 'gem_red' : p.value >= 3 ? 'gem_green' : 'gem'));
  }

  private updatePickups(dt: number) {
    const px = this.player.x;
    const py = this.player.y;
    const mag2 = this.stats.magnet * this.stats.magnet;
    for (const p of this.pickups.items) {
      if (!p.active) continue;
      // moeda girando
      if (p.kind === 'coin') p.scaleX = 0.25 + 0.75 * Math.abs(Math.cos(this.elapsed * 4 + p.x * 0.05));
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
      this.addXp(p.value * xpMult(this.stats));
      sfx('pickup');
    } else if (p.kind === 'coin') {
      this.gold += p.value * goldMult(this.stats);
      sfx('pickup');
    } else {
      this.hp = Math.min(this.stats.maxHp, this.hp + p.value);
      this.floatText(this.player.x, this.player.y - 14, `+${p.value}`, '#38b764');
      sfx('select');
    }
  }

  // ---------- Experiência, nível e cartas ----------

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

  private rollCurrent() {
    this.currentOptions = rollOptions(this.loadout, this.numOptions, this.stats.luck, this.banned, this.lockedNext);
  }

  private openLevelUp() {
    this.state = 'levelup';
    this.joy.x = this.joy.y = 0;
    sfx('levelup');
    this.rollCurrent();
    this.scene.pause();
    this.scene.pause('Hud');
    this.scene.launch('LevelUp');
  }

  reroll(): boolean {
    if (this.rerolls <= 0) return false;
    this.rerolls--;
    this.rollCurrent();
    return true;
  }

  /** Remove a opção do sorteio desta partida e troca a carta por outra. */
  banish(index: number): boolean {
    const opt = this.currentOptions[index];
    if (!opt || this.banishes <= 0 || opt.kind === 'gold' || opt.kind === 'heal') return false;
    this.banishes--;
    const key = optionKey(opt);
    this.banned.add(key);
    this.lockedNext = this.lockedNext.filter((o) => optionKey(o) !== key);
    const others = this.currentOptions.filter((_, i) => i !== index);
    const [replacement] = rollOptions(this.loadout, 1, this.stats.luck, new Set([...this.banned, ...others.map(optionKey)]));
    this.currentOptions[index] = replacement;
    return true;
  }

  /** Fixa a carta: ela volta na próxima tela de nível. */
  lock(index: number): boolean {
    const opt = this.currentOptions[index];
    if (!opt || this.locks <= 0 || this.isLocked(opt)) return false;
    this.locks--;
    this.lockedNext.push(opt);
    return true;
  }

  isLocked(opt: UpgradeOption) {
    return this.lockedNext.some((o) => optionKey(o) === optionKey(opt));
  }

  chooseUpgrade(opt: UpgradeOption) {
    if (opt.kind === 'gold') this.gold += 25;
    else if (opt.kind === 'heal') this.hp = Math.min(this.stats.maxHp, this.hp + 40);
    else applyOption(this.loadout, opt);
    this.lockedNext = this.lockedNext.filter((o) => optionKey(o) !== optionKey(opt));
    const oldMax = this.stats.maxHp;
    this.recomputeStats();
    if (this.stats.maxHp > oldMax) this.hp += this.stats.maxHp - oldMax;
    this.weapons.sync(this.loadout.weapons);
    this.pendingLevels--;
    if (this.pendingLevels > 0) {
      this.rollCurrent();
      this.scene.get('LevelUp').scene.restart();
      return;
    }
    this.scene.stop('LevelUp');
    this.state = 'playing';
    this.scene.resume();
    this.scene.resume('Hud');
    this.levelUpBurst();
  }

  // ---------- Pausa, vitória e fim ----------

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

  private openVictory() {
    if (this.state !== 'playing') {
      // se uma tela de nível estiver aberta, tenta de novo logo depois
      this.time.delayedCall(500, () => this.openVictory());
      return;
    }
    this.state = 'victory';
    this.joy.x = this.joy.y = 0;
    this.scene.pause();
    this.scene.pause('Hud');
    this.scene.launch('Victory', this.result(true));
  }

  /** Escolha na tela de vitória: seguir no modo infinito. */
  continueEndless() {
    this.scene.stop('Victory');
    this.endless = true;
    this.endlessStart = this.elapsed;
    this.bossesSpawned = 0;
    this.state = 'playing';
    this.scene.resume();
    this.scene.resume('Hud');
    this.events.emit('announce', 'MODO INFINITO: CICLO 1');
  }

  result(victory: boolean): RunResult {
    return {
      victory,
      endless: this.endless,
      cycle: this.cycle,
      time: this.elapsed,
      kills: this.kills,
      level: this.level,
      gold: Math.floor(this.gold),
      character: this.char.id,
      weapons: this.weapons.owned,
    };
  }

  endRun(victory: boolean) {
    if (this.state === 'over') return;
    this.state = 'over';
    const result = this.result(victory);
    this.time.delayedCall(victory ? 0 : 600, () => {
      this.scene.pause();
      this.scene.stop('Hud');
      this.scene.launch('GameOver', result);
    });
    if (!victory || this.endless) {
      this.player.setTint(0xb13e53);
      this.tweens.add({ targets: this.player, angle: 90, alpha: 0.5, duration: 500 });
    }
  }

  // ---------- Textos flutuantes ----------

  floatText(x: number, y: number, str: string, color: string, big = false) {
    let t = this.dmgTexts.find((d) => !d.active);
    if (!t) {
      if (this.dmgTexts.length >= 40) return;
      t = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: px(11), fontStyle: 'bold', color: '#ffffff', stroke: '#140c1c', strokeThickness: 3 }).setOrigin(0.5);
      this.dmgTexts.push(t);
    }
    t.setActive(true).setVisible(true).setPosition(Math.round(x), Math.round(y)).setText(str).setColor(color).setAlpha(1).setDepth(LAYER.text);
    t.setData('big', big ? 1.5 : 1);
    t.setScale((big ? 1.5 : 1) * 1.6);
    t.setData('life', 0.7);
  }

  private updateDamageTexts(dt: number) {
    for (const t of this.dmgTexts) {
      if (!t.active) continue;
      const life = (t.getData('life') as number) - dt;
      t.setData('life', life);
      t.y -= 26 * dt;
      // "pop": começa grande e assenta no tamanho normal
      const base = t.getData('big') as number;
      t.setScale(base * (life > 0.6 ? 1 + (life - 0.6) * 6 : 1));
      if (life < 0.2) t.setAlpha(life / 0.2);
      if (life <= 0) t.setActive(false).setVisible(false);
    }
  }

  // ---------- Cenário ----------

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
        const n = 3 + Math.floor(rnd() * 4);
        for (let i = 0; i < n; i++) {
          const r = rnd();
          const tex = r < 0.07 ? 'tree' : r < 0.1 ? 'tree2' : r < 0.2 ? 'bush' : r < 0.3 ? 'rock' : r < 0.34 ? 'stump' : r < 0.52 ? 'flowers' : r < 0.6 ? 'mushroom' : 'tallgrass';
          const px = x * CHUNK + rnd() * CHUNK;
          const py = y * CHUNK + rnd() * CHUNK;
          if (Math.hypot(px, py) < 60) continue;
          const img = this.add.image(Math.round(px), Math.round(py), 'atlas', frameName(tex)).setOrigin(0.5, 1);
          const tall = tex === 'tree' || tex === 'tree2';
          img.setDepth(tall || tex === 'bush' || tex === 'stump' || tex === 'rock' ? py - 6 : LAYER.groundDecor);
          if (tall) img.setData('tall', true);
          imgs.push(img);
        }
        // trechos de terra quebram a monotonia da grama
        if (rnd() < 0.35) {
          const dx = x * CHUNK + rnd() * CHUNK;
          const dy = y * CHUNK + rnd() * CHUNK;
          if (Math.hypot(dx, dy) > 80) {
            const patch = this.add.image(Math.round(dx), Math.round(dy), 'atlas', frameName(rnd() < 0.5 ? 'dirt' : 'dirt2'));
            patch.setDepth(LAYER.groundDecor - 1).setFlipX(rnd() < 0.5);
            imgs.push(patch);
          }
        }
        this.decor.set(key, imgs);
      }
    }
    for (const [key, imgs] of this.decor) {
      if (needed.has(key)) continue;
      imgs.forEach((i) => i.destroy());
      this.decor.delete(key);
    }
    this.tallDecor = [...this.decor.values()].flat().filter((i) => i.getData('tall'));
  }

  /** Árvores ficam translúcidas quando o herói passa por trás delas. */
  private fadeTrees() {
    const px = this.player.x;
    const py = this.player.y;
    for (const t of this.tallDecor) {
      const behind = Math.abs(t.x - px) < 22 && py < t.y && py > t.y - 62;
      const target = behind ? 0.45 : 1;
      if (t.alpha !== target) t.setAlpha(t.alpha + (target - t.alpha) * 0.3);
    }
  }

  // ---------- Efeitos ----------

  /** Chamas subindo (aura de fogo). */
  emitFlame(x: number, y: number) {
    this.flames.emitParticleAt(x, y, 1);
  }

  /** Impacto: clarão circular + faíscas. */
  impact(x: number, y: number, color: number, size = 1) {
    const g = this.add.image(x, y, 'atlas', frameName('glow')).setBlendMode(Phaser.BlendModes.ADD).setTint(color).setDepth(LAYER.fx + 5).setScale(0.4 * size);
    this.tweens.add({ targets: g, scale: 1.6 * size, alpha: 0, duration: 260, ease: 'Quad.Out', onComplete: () => g.destroy() });
    this.sparks.explode(Math.round(6 * size), x, y);
  }

  /** Clarão em volta do herói ao subir de nível. */
  private levelUpBurst() {
    const p = this.player;
    for (let i = 0; i < 2; i++) {
      const ring = this.add.image(p.x, p.y, 'atlas', frameName('aura')).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0a0).setDepth(LAYER.fx + 6).setScale(0.2);
      this.tweens.add({ targets: ring, scale: 1.4 + i * 0.6, alpha: 0, duration: 450 + i * 150, ease: 'Quad.Out', onComplete: () => ring.destroy() });
    }
    this.sparks.explode(18, p.x, p.y - 8);
  }

  // ---------- Depuração e testes ----------

  /** Gera `n` inimigos de uma vez (teste de estresse). */
  debugSpawn(n: number, id: EnemyId = 'skeleton') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * 400;
      this.spawnEnemy(ENEMIES[id], this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r);
    }
  }

  get ownedWeapons() {
    return this.weapons.owned;
  }

  get tagCounts() {
    return this.weapons.tagCounts;
  }

  refreshWeapons() {
    this.weapons.sync(this.loadout.weapons);
  }
}
