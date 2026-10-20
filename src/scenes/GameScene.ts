import Phaser from 'phaser';
import { VIEW } from '../ui/view';
import { walkPose } from '../art/motion';
import { ElementSystem } from '../systems/elements';
import { dev, runDuration, waveClock } from '../systems/dev';
import { REACTIONS } from '../data/elements';
import { frameName, groundSprite, scrollGround, slotsOf, type Slots } from '../art/textures';
import { formatNumber } from '../core/format';
import { SpatialGrid } from '../core/grid';
import {
  BASE_STATS, combine, critMultiplier, damageTaken, dodgeChance, goldMult, moveSpeed, rollCritTier, xpMult,
  type Modifier, type Stats,
} from '../core/stats';
import { getCharacter, type CharacterDef } from '../data/characters';
import { DEATH_TINT, ENEMIES, controlRoll, type EnemyDef, type EnemyId } from '../data/enemies';
import { metaModifiers } from '../data/meta';
import { tierName, tierScaling } from '../data/difficulty';
import { ELEMENT_COLORS, WEAPON_IDS, type Element, type WeaponId } from '../data/weapons';
import {
  ENDLESS_CYCLE, MAX_ENEMIES, RUN_DURATION, damageMultiplier, endlessScaling, hpMultiplier, isEliteTime, waveAt, xpToNext,
} from '../data/waves';
import { Enemy, Pickup, Pool, Projectile, type PickupKind } from '../entities';
import { loadSave, writeSave } from '../systems/save';
import { STAGES, finalBoss, getStage, stageScaling, type RunEventId, type StageDef, type StageId } from '../data/stages';
import { sfx } from '../systems/sfx';
import {
  applyOption, loadoutModifiers, optionKey, rollOptions, type Loadout, type UpgradeOption,
} from '../systems/upgrades';
import { WeaponSystem } from '../systems/weapons';
import { BossAI } from '../systems/bossAI';
import { EnemySkills, WEB } from '../systems/enemySkills';
import { RunEvents } from '../systems/runEvents';
import { FONT, px } from '../ui/theme';

/**
 * Camadas de desenho. Personagens usam a coordenada Y como profundidade (quem está mais
 * abaixo na tela fica na frente), então as camadas do chão precisam ficar bem abaixo de
 * qualquer Y possível e as de efeitos/interface bem acima.
 */
/** Aproximação extra da câmera do jogo: personagens maiores na tela do celular. */
export const WORLD_ZOOM = 1.2;
/** Decoração de pé (ordem de profundidade pela base), as demais ficam rente ao chão. */
const UPRIGHT = new Set(['bush', 'stump', 'rock', 'mossy_log', 'cactus', 'desert_rock', 'thorn_bush', 'gravestone']);
/** Limites do zoom do jogador: afastar mostra mais da tela (e pesa mais), aproximar mostra o herói maior. */
export const ZOOM_RANGE = [0.7, 1.8];
const ZOOM_KEY = 'survivor-zoom';

function loadZoom() {
  try {
    const z = Number(localStorage.getItem(ZOOM_KEY));
    return z ? Phaser.Math.Clamp(z, ZOOM_RANGE[0], ZOOM_RANGE[1]) : 1;
  } catch {
    return 1;
  }
}

export const LAYER = {
  ground: -3e9,
  groundDecor: -2e9,
  groundFx: -1.5e9,
  pickups: -1e9,
  fx: 1e9,
  text: 1.5e9,
  overlay: 2e9,
};

/** Ouro de fim de partida: por minuto sobrevivido e por chefe da fase vencido. */
const RUN_GOLD = { perMinute: 8, perBoss: 40 };
/** Chefes: intervalo mínimo (s) entre os sinais de golpe (tom avermelhado e quadro de dano). */
const BOSS_FLASH = { every: 0.9 };
/** Corpos caídos visíveis ao mesmo tempo (os demais inimigos só somem). */
const MAX_CORPSES = 60;

export interface RunResult {
  victory: boolean;
  stage: StageId;
  /** dificuldade (0 = Normal) */
  tier: number;
  /** chefes da fase vencidos (0 a 3) */
  bosses: number;
  /** objetivos da fase cumpridos nesta partida (estrelas) */
  stars: boolean[];
  /** o que a vitória liberou (próxima fase, próxima dificuldade) */
  unlocked?: string;
  endless: boolean;
  cycle: number;
  time: number;
  kills: number;
  level: number;
  gold: number;
  character: string;
  weapons: { id: string; level: number; dealt: number }[];
  /** dano por reação elemental (só as que aconteceram) */
  reactions: { name: string; dealt: number }[];
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
  sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  flames!: Phaser.GameObjects.Particles.ParticleEmitter;
  private motes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dmgTexts: Phaser.GameObjects.Text[] = [];
  weapons!: WeaponSystem;
  elements!: ElementSystem;

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
  private hurtUntil = 0;
  private playerFrame = 0;
  private playerSlots: Slots = {};
  private corpses: { img: Phaser.GameObjects.Image; life: number; total: number }[] = [];
  private spawnAcc = 0;
  private eventsDone = new Set<number>();
  /** chefe da fase com a barra grande na tela (o mais antigo vivo) */
  boss: Enemy | null = null;
  /** chefes da fase vivos (o do início pode ainda estar vivo quando chega o do meio) */
  private mainBosses: Enemy[] = [];
  /** chefes da fase já chamados (0 a 3) e vencidos nesta partida */
  private bossesCalled = 0;
  bossesDown = 0;
  /** dificuldade da partida (0 = Normal) */
  tier = 0;
  private bonusPaid = false;
  /** chefe surpresa vivo (barra pequena sobre a cabeça) */
  miniBoss: Enemy | null = null;
  /** fase da partida (escolhida no mapa-múndi) */
  stage!: StageDef;
  /** habilidades dos inimigos à distância, conjuradores e explosivos */
  enemySkills!: EnemySkills;
  bossAI!: BossAI;
  /** eventos aleatórios, aliado e itens do mapa */
  runEvents!: RunEvents;

  /** posição da fase na trilha (0 = primeira): sobe o nível das habilidades inimigas */
  get stageIndex() {
    return STAGES.indexOf(this.stage);
  }
  /** eventos aleatórios concluídos (objetivos de estrela) */
  completed = new Set<RunEventId>();
  /** o chefe final da fase foi vencido nesta partida */
  private bossDown = false;
  /** o chefe final já foi chamado */
  bossSpawned = false;
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
  /** poças de lama visíveis (deixam o herói lento) */
  private mud: Phaser.GameObjects.Image[] = [];
  /** névoa do pântano: nuvens nas bordas da tela */
  private fog: { img: Phaser.GameObjects.Image; a: number; r: number; speed: number }[] = [];
  /** escuridão da floresta: só a área em volta do herói fica clara */
  private darkness: Phaser.GameObjects.Image | null = null;
  /** teia da aranha: herói preso (bem mais lento) até este instante (s) */
  webUntil = 0;
  /** santuário maldito: inimigos mais fortes e rápidos até este instante (s) */
  cursedUntil = 0;

  constructor() {
    super('Game');
  }

  /** Zoom escolhido pelo jogador (pinça ou roda do mouse), multiplicando o zoom padrão. */
  userZoom = loadZoom();

  /** Área visível do mundo (unidades do jogo). */
  get viewW() {
    return VIEW.screenWidth / (WORLD_ZOOM * this.userZoom);
  }

  get viewH() {
    return VIEW.height / (WORLD_ZOOM * this.userZoom);
  }

  /** Aproxima ou afasta a câmera (limitado a ZOOM_RANGE); fica salvo para as próximas partidas. */
  setUserZoom(z: number) {
    this.userZoom = Phaser.Math.Clamp(z, ZOOM_RANGE[0], ZOOM_RANGE[1]);
    this.cameras.main.setZoom(VIEW.zoom * WORLD_ZOOM * this.userZoom);
    this.onResize();
    try {
      localStorage.setItem(ZOOM_KEY, String(this.userZoom));
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
  }

  create() {
    const save = loadSave();
    this.char = getCharacter(save.selected);
    const stage = getStage(save.stage);
    this.stage = stage.playable ? stage : STAGES[0];
    this.completed = new Set();
    this.bossDown = false;
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
    this.hurtUntil = 0;
    this.playerFrame = 0;
    this.spawnAcc = 0;
    this.eventsDone.clear();
    this.boss = null;
    this.mainBosses = [];
    this.bossesCalled = 0;
    this.bossesDown = 0;
    this.bonusPaid = false;
    this.tier = save.tier[this.stage.id] ?? 0;
    this.miniBoss = null;
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
    this.corpses = [];
    this.decor.clear();
    this.fog = [];
    this.mud = [];
    this.darkness = null;
    this.webUntil = 0;
    this.cursedUntil = 0;

    const width = this.viewW;
    const height = this.viewH;
    // chão e vinheta acompanham a câmera (com margem para não aparecer borda)
    this.ground = groundSprite(this, 0, 0, width + 128, height + 128, this.stage.ground).setOrigin(0).setDepth(LAYER.ground);
    this.player = this.add.image(0, 0, 'atlas', frameName(this.char.texture)).setOrigin(0.5, 0.68);
    this.playerSlots = slotsOf(this.char.texture);
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
    this.enemySkills = new EnemySkills(this);
    this.bossAI = new BossAI(this);
    this.runEvents = new RunEvents(this);
    this.elements = new ElementSystem(this);
    this.weapons.sync(this.loadout.weapons);
    this.applyDevSpeed();

    this.cameras.main.setZoom(VIEW.zoom * WORLD_ZOOM * this.userZoom);
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
    this.cameras.main.setBackgroundColor(this.stage.tint.sky);
    this.ground.setTint(this.stage.tint.ground);
    this.cameras.main.setRoundPixels(true);
    this.updateDecor();
    // primeiros inimigos: os da primeira onda da fase
    const first = this.stage.waves[0].pool;
    for (let i = 0; i < 6; i++) this.spawnEnemy(ENEMIES[first[i % first.length]]);

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
    const dt = (Math.min(deltaMs, 50) / 1000) * dev.speed;
    const prev = this.elapsed;
    this.elapsed += dt;
    this.frame++;

    this.updatePlayer();
    this.updateEnemies(dt);
    this.weapons.update(dt);
    this.enemySkills.update(dt);
    this.runEvents.update(dt);
    this.updateProjectiles(dt);
    this.checkContact();
    this.updatePickups(dt);
    this.updateSpawns(prev, dt);
    this.updateDamageTexts(dt);
    this.updateCorpses(dt);
    this.elements.tick(dt);

    if (this.stats.regen > 0) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);

    const cam = this.cameras.main;
    const vx = Math.floor(this.player.x - this.viewW / 2);
    const vy = Math.floor(this.player.y - this.viewH / 2);
    this.ground.setPosition(vx - 64, vy - 64);
    scrollGround(this.ground, vx - 64, vy - 64);
    this.vignette.setPosition(cam.midPoint.x - this.viewW / 2 - 20, cam.midPoint.y - this.viewH / 2 - 20);
    this.updateFog(cam.midPoint.x, cam.midPoint.y);
    this.updateDarkness();
    this.motes.setPosition(cam.midPoint.x, cam.midPoint.y);
    this.drawPlayerHp();
    if (this.frame % 15 === 0) this.updateDecor();
    this.fadeTrees();
  }

  // ---------- Jogador ----------

  /** Troca o quadro do herói pelo nome (idle, walk_a, attack, hurt, death, victory). */
  private setPlayerSlot(slot: string) {
    const f = this.playerSlots[slot] ?? 0;
    if (f === this.playerFrame) return;
    this.playerFrame = f;
    this.player.setFrame(frameName(this.char.texture, f));
  }

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
    // poça de lama e areia movediça: o herói anda mais devagar
    const inMud = this.mud.find((m) => ((this.player.x - m.x) / (m.displayWidth * 0.45)) ** 2 + ((this.player.y - m.y) / (m.displayHeight * 0.4)) ** 2 < 1);
    const webbed = this.elapsed < this.webUntil ? WEB.speed : 1;
    const speed = moveSpeed(this.stats) * (inMud ? (inMud.getData('mud') as number) : 1) * webbed;
    const dt = Math.min(this.game.loop.delta, 50) / 1000;
    this.player.x += x * speed * dt;
    this.player.y += y * speed * dt;
    const moving = len > 0.1;
    if (moving) {
      this.facing.set(x, y).normalize();
      if (Math.abs(x) > 0.1) this.player.setFlipX(x < 0);
    }
    const pose = walkPose('hero', this.elapsed, moving);
    this.setPlayerSlot(this.elapsed < this.hurtUntil ? 'hurt' : this.elapsed < this.attackUntil ? 'attack' : pose.slot);
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
    // chefe surpresa: barra pequena sobre a cabeça (a barra grande da tela é só dos chefes da fase)
    const m = this.miniBoss;
    if (m?.active && m.tag === 'surprise') {
      const mw = 34;
      const mx = Math.round(m.x - mw / 2);
      const my = Math.round(m.y - m.displayHeight * 0.75 - 6);
      g.fillStyle(0x140c1c, 0.85).fillRect(mx - 1, my - 1, mw + 2, 5);
      g.fillStyle(0xff6a5a, 1).fillRect(mx, my, Math.round(mw * Phaser.Math.Clamp(m.hp / m.maxHp, 0, 1)), 3);
    }
  }

  private checkContact() {
    if (this.elapsed < this.invulnUntil) return;
    const px = this.player.x;
    const py = this.player.y;
    let touched: Enemy | null = null;
    this.grid.query(px, py, 40, (e) => {
      // o verme enterrado passa por baixo sem ferir (só fere ao irromper)
      if (!e.active || e.burrowed || e.intangible) return;
      const r = e.radius + 8;
      if ((e.x - px) ** 2 + (e.y - py) ** 2 < r * r) {
        touched = e;
        return true;
      }
    });
    if (touched) this.onPlayerTouched(touched);
  }

  private onPlayerTouched(e: Enemy, mult = 1) {
    if (!e.active || !this.hurtPlayer(e.damage * mult)) return;
    if (this.stats.thorns > 0) this.hitEnemy(e, this.stats.thorns, 0.5, 'physical', false);
  }

  /** Dano no herói (encostão, tiro, explosão): invulnerabilidade curta, esquiva e defesa. Devolve se acertou. */
  hurtPlayer(amount: number): boolean {
    if (this.state !== 'playing' || this.elapsed < this.invulnUntil) return false;
    this.invulnUntil = this.elapsed + 0.5;
    if (Math.random() < dodgeChance(this.stats)) {
      this.floatText(this.player.x, this.player.y - 16, 'ESQUIVA', '#a7f070');
      return false;
    }
    // maldição do santuário: os golpes inimigos ferem 30% a mais
    const dmg = damageTaken(amount * (this.elapsed < this.cursedUntil ? 1.3 : 1), this.stats);
    if (!dev.heroImmortal) this.hp -= dmg;
    this.hurtUntil = this.elapsed + 0.25;
    this.cameras.main.shake(80, 0.004);
    this.player.setTintFill(0xffffff);
    this.time.delayedCall(80, () => this.player.clearTint());
    sfx('hurt');
    if (this.hp <= 0) this.onPlayerDeath();
    return true;
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

  /** Multiplicadores da partida: tempo, fase, dificuldade escolhida e ciclo do modo infinito. */
  private difficulty() {
    const clock = waveClock(this.elapsed);
    const k = stageScaling(this.stage, this.endless ? 1 : clock / RUN_DURATION);
    const tier = tierScaling(this.tier);
    if (!this.endless) return { hp: hpMultiplier(clock) * k.hp * tier.hp, damage: damageMultiplier(clock) * k.damage * tier.damage, reward: k.reward * tier.reward };
    const s = endlessScaling(this.cycle);
    return { hp: hpMultiplier(RUN_DURATION) * s.hp * k.hp * tier.hp, damage: s.damage * k.damage * tier.damage, reward: s.reward * k.reward * tier.reward };
  }

  /** Nome do chefe na barra da HUD. */
  bossLabel(e: Enemy) {
    return this.bossAI.label(e);
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
    e.spawn(def, x, y, d.hp * (def.boss ? 1 : curse), d.damage, elite);
    // primeiro ataque de quem tem habilidade: um pouco depois de aparecer, sem todos juntos
    if (def.skill && !def.boss) e.attackTimer = this.elapsed + 1 + Math.random() * 2;
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
      // longe demais: reaparece à frente do herói (menos os de eventos, que ficam no lugar deles)
      if (!e.boss && !e.tag && (Math.abs(dx) > farX || Math.abs(dy) > farY)) {
        const p = this.spawnPoint(Math.atan2(this.facing.y, this.facing.x) + (Math.random() - 0.5) * 1.6);
        e.x = p.x;
        e.y = p.y;
        dx = px - e.x;
        dy = py - e.y;
      }
      const d = Math.hypot(dx, dy) || 1;
      // congelado, o chefe também não ataca
      const still = e.boss && t >= e.frozenUntil && this.bossAI.update(e, d, dt);
      this.elements.update(e, t, dt);
      if (!e.active) continue;
      // maldição do santuário: todos os inimigos 30% mais rápidos
      const slow = still ? 0 : this.elements.speedFactor(e, t) * (t < this.cursedUntil ? 1.3 : 1);
      let vx = (dx / d) * e.speed * slow;
      let vy = (dy / d) * e.speed * slow;
      // guerra de tribos: com o herói longe, cada guerreiro luta com o rival mais próximo
      const foe = e.faction && d > 90 ? this.runEvents.foeOf(e) : null;
      let fight = false;
      if (foe) {
        const fx = foe.x - e.x;
        const fy = foe.y - e.y;
        const fd = Math.hypot(fx, fy) || 1;
        if (fd > e.radius + foe.radius + 4) {
          vx = (fx / fd) * e.speed * slow;
          vy = (fy / fd) * e.speed * slow;
        } else {
          vx = vy = 0;
          fight = slow > 0;
          if (fight && t >= e.foeAt) {
            e.foeAt = t + 0.7;
            this.elementalDamage(foe, e.damage * 2.5, '#ffb070');
          }
        }
      }
      // à distância, conjurador e explosivo: mantêm distância, andam de lado ou param para atacar
      if (!foe && e.def.skill && !e.boss && slow > 0 && t >= e.frozenUntil) {
        const m = this.enemySkills.think(e, d);
        const side = (e.uid % 2 ? 1 : -1) * m.side;
        vx = ((dx / d) * m.forward - (dy / d) * side) * e.speed * slow;
        vy = ((dy / d) * m.forward + (dx / d) * side) * e.speed * slow;
      }
      // guardas esperam no posto até o herói chegar perto
      if (e.tag === 'guard' && d > 200) vx = vy = 0;
      // goblin dourado: foge do herói
      if (e.tag === 'golden') {
        vx = -vx;
        vy = -vy;
      }
      if (e.def.kind === 'bat' || e.def.kind === 'vulture' || e.def.kind === 'wisp') {
        const wob = Math.sin(t * 6 + e.phase) * 25;
        vx += (-dy / d) * wob;
        vy += (dx / d) * wob;
      }
      e.x += (vx + e.kbX) * dt;
      e.y += (vy + e.kbY) * dt;
      e.kbX *= decay;
      e.kbY *= decay;
      e.flipX = foe ? foe.x < e.x : dx < 0;
      e.depth = e.y;
      if (e.alpha < 1) e.alpha = Math.min(1, e.alpha + dt * 3);
      const pose = walkPose(e.def.kind, t + e.phase, slow > 0 && (vx !== 0 || vy !== 0));
      // colado no herói, mostra o quadro de ataque (mordida, golpe); quem não tem, segue andando
      // o verme enterrado aparece como o monte de areia (quadro de se enterrar)
      const slot = e.burrowed ? 'windup' : e.attackPhase !== 'walk' ? e.attackPhase : t < e.hurtUntil ? 'hurt' : fight || (slow > 0 && d < e.radius + 14) ? 'attack' : pose.slot;
      const f = e.slots[slot] ?? e.slots[pose.slot] ?? 0;
      if (f !== e.animFrame) {
        e.animFrame = f;
        e.setFrame(frameName(e.def.texture, f));
      }
      e.scaleX = e.baseScale * pose.sx;
      e.scaleY = e.baseScale * pose.sy;
      e.rotation = e.flipX ? -pose.rot : pose.rot;
      if (e.flashUntil && t > e.flashUntil) {
        e.flashUntil = 0;
        this.restoreTint(e);
      }
      this.grid.insert(e);
    }
    list.length = w;
    this.separate(list);
  }

  /** Corpo caído no quadro de morte, que some em seguida. */
  private spawnCorpse(e: Enemy) {
    const f = e.slots.death;
    if (f === undefined) return;
    let c = this.corpses.find((k) => k.life <= 0);
    if (!c) {
      if (this.corpses.length >= MAX_CORPSES) return;
      c = { img: this.add.image(0, 0, 'atlas', frameName(e.def.texture, f)), life: 0, total: 0 };
      this.corpses.push(c);
    }
    c.life = c.total = e.boss ? 2.5 : 0.6;
    c.img.setFrame(frameName(e.def.texture, f)).setPosition(e.x, e.y).setOrigin(e.originX, e.originY).setScale(e.baseScale)
      .setFlipX(e.flipX).setAlpha(1).setVisible(true).setDepth(e.y - 1);
    if (e.elite) c.img.setTint(0xffcd75);
    else c.img.clearTint();
  }

  private updateCorpses(dt: number) {
    for (const c of this.corpses) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.img.setAlpha(Math.min(1, (c.life / c.total) * 2));
      if (c.life <= 0) c.img.setVisible(false);
    }
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

  /**
   * Teste de Resistência a controle de um inimigo: 0 = ignorou (mostra "RESISTIU" nos elites e no
   * chefe, sem repetir demais); senão, o fator de força/duração do controle.
   */
  control(e: Enemy): number {
    const f = controlRoll(e.resist);
    if (f === 0 && (e.boss || e.elite) && this.elapsed - e.resistShownAt > 1.2) {
      e.resistShownAt = this.elapsed;
      this.floatText(e.x, e.y - 24 * e.baseScale, 'RESISTIU', '#c8b8ff', false);
    }
    return f;
  }

  /** Golpe de arma: crítico, vantagem elemental, empurrão e chance de aplicar o efeito do elemento. */
  hitEnemy(e: Enemy, amount: number, knock = 1, element: Element = 'physical', canCrit = true, effect = 0): number {
    if (!e.active) return 0;
    const tier = canCrit ? rollCritTier(this.stats.critChance + this.elements.critBonus(e, this.elapsed)) : 0;
    const dmg = amount * critMultiplier(this.stats, tier) * this.elements.damageMultiplier(e, element, this.elapsed);
    const resisted = knock > 0 && e.def.knockback > 0 ? this.control(e) : 0;
    if (resisted > 0) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = 90 * knock * e.def.knockback * (e.elite ? 0.3 : 1) * resisted;
      e.kbX += (dx / d) * f;
      e.kbY += (dy / d) * f;
    }
    if (this.stats.lifesteal > 0) this.hp = Math.min(this.stats.maxHp, this.hp + dmg * this.stats.lifesteal * 0.1);
    const color = tier >= 2 ? '#ef7d57' : tier === 1 ? '#ffcd75' : ELEMENT_COLORS[element];
    if (this.frame % 2 === 0) this.sparks.explode(tier > 0 ? 4 : 2, e.x, e.y - 4);
    sfx('hit');
    this.damage(e, dmg, formatNumber(dmg) + (tier >= 2 ? '!!' : tier === 1 ? '!' : ''), color, tier > 0);
    if (effect > 0 && e.active) this.elements.onHit(e, element, dmg, effect);
    return dmg;
  }

  /** Dano de efeitos e reações elementais: sem crítico, sem empurrão e sem aplicar novos efeitos. */
  elementalDamage(e: Enemy, amount: number, color: string): number {
    if (!e.active) return 0;
    const dmg = amount * this.elements.damageMultiplier(e, 'physical', this.elapsed);
    this.damage(e, dmg, formatNumber(dmg), color, false);
    return dmg;
  }

  private damage(e: Enemy, dmg: number, label: string, color: string, big: boolean) {
    // chefe se transformando para a fase 2: não leva dano
    if (e.boss && this.bossAI.invulnerable(e)) return;
    e.hp -= dmg;
    if (e.boss) {
      // chefe leva golpes o tempo todo: só um leve tom avermelhado e o quadro de dano de vez em quando,
      // nunca o branco (senão fica branco direto)
      if (this.elapsed - e.flashAt > BOSS_FLASH.every) {
        e.flashAt = this.elapsed;
        e.setTint(0xffb4a8);
        e.flashUntil = this.elapsed + 0.08;
        e.hurtUntil = this.elapsed + 0.18;
      }
    } else {
      e.setTintFill(0xffffff);
      e.flashUntil = this.elapsed + 0.06;
      e.hurtUntil = this.elapsed + 0.15;
    }
    this.floatText(e.x, e.y - 16 * e.baseScale, label, color, big);
    if (e.hp <= 0 && dev.enemiesImmortal) e.hp = e.maxHp;
    // o chefe final "morre", se transforma e volta para a fase 2
    if (e.hp <= 0 && e.boss && this.bossAI.intercept(e)) return;
    if (e.hp <= 0) this.killEnemy(e, true);
  }

  private tintVeil?: Phaser.GameObjects.Rectangle;

  /** Véu colorido e translúcido sobre a tela, que some rápido (reações elementais). */
  screenTint(color: number) {
    if (!this.tintVeil?.active) {
      // fixo na tela (sem rolagem); o zoom da câmera é em torno do centro dela
      const cam = this.cameras.main;
      this.tintVeil = this.add.rectangle(cam.width / 2, cam.height / 2, cam.width * 2, cam.height * 2, color, 1)
        .setScrollFactor(0).setDepth(LAYER.overlay - 1).setBlendMode(Phaser.BlendModes.ADD);
    }
    this.tweens.killTweensOf(this.tintVeil);
    this.tintVeil.setFillStyle(color, 1).setAlpha(0.22);
    this.tweens.add({ targets: this.tintVeil, alpha: 0, duration: 260 });
  }

  /** Cor de base do inimigo: congelado, elite ou natural. */
  restoreTint(e: Enemy) {
    if (e.frozenUntil > this.elapsed) e.setTint(0x9fe8ff);
    else if (e.baseTint) e.setTint(e.baseTint);
    else if (e.elite) e.setTint(0xffcd75);
    else e.clearTint();
  }

  private killEnemy(e: Enemy, drops: boolean) {
    const { x, y } = e;
    this.particles.setParticleTint(DEATH_TINT[e.def.id]);
    this.particles.explode(e.boss ? 60 : e.elite ? 20 : 6, x, y);
    if (e.boss || e.elite) this.impact(x, y, 0xffcd75, e.boss ? 3 : 1.6);
    this.spawnCorpse(e);
    e.kill();
    this.kills++;
    sfx('kill');
    const reward = this.difficulty().reward;
    if (e.tag) this.runEvents.onKill(e);
    if (e.boss) this.bossAI.end(e);
    if (this.mainBosses.includes(e)) {
      this.mainBosses = this.mainBosses.filter((b) => b !== e);
      this.boss = this.mainBosses[0] ?? null;
      this.bossesDown++;
      this.cameras.main.flash(600, 255, 205, 117);
      const final = e.def.id === finalBoss(this.stage);
      const coins = final ? 30 : 16;
      for (let i = 0; i < coins; i++) this.dropPickup('coin', x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-30, 30), (final ? 3 : 2) * reward);
      this.dropPickup('gem', x, y, e.xp * reward);
      if (final && !this.endless) {
        this.bossDown = true;
        this.time.delayedCall(1500, () => this.openVictory());
      } else if (!final) {
        // chefe do início ou do meio: baú de recompensa e um respiro de vida
        this.runEvents.placeChest(x, y);
        this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.3);
        this.events.emit('announce', 'CHEFE DERROTADO! UM BAÚ FICOU PARA TRÁS');
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
    } else if (Math.random() < 0.08) {
      this.dropPickup('coin', x + 4, y + 2, reward);
    } else if (Math.random() < 0.006) {
      this.dropPickup('heart', x + 4, y + 2, 20);
    }
  }

  private updateSpawns(prev: number, dt: number) {
    const t = this.elapsed;
    // três chefes por partida: no fim de cada terço (início, meio e final)
    while (!this.endless && this.bossesCalled < 3 && t >= (runDuration() / 3) * (this.bossesCalled + 1)) {
      this.spawnBoss(this.bossesCalled);
      this.bossesCalled++;
      this.bossSpawned = this.bossesCalled >= 3;
    }
    // chefes do modo infinito: um no fim de cada ciclo
    if (this.endless) {
      const due = Math.floor((t - this.endlessStart) / ENDLESS_CYCLE);
      if (due > this.bossesSpawned) {
        this.bossesSpawned = due;
        this.spawnBoss(2);
        this.events.emit('announce', `CICLO ${this.cycle}: INIMIGOS MAIS FORTES!`);
      }
    }

    let rate: number;
    let max: number;
    let wave = waveAt(Math.min(waveClock(t), RUN_DURATION - 1), this.stage.waves);
    if (this.endless) {
      const s = endlessScaling(this.cycle);
      wave = this.stage.waves[this.stage.waves.length - 1];
      rate = wave.rate * s.rate;
      max = s.max;
    } else if (this.bossSpawned) {
      rate = 2;
      max = 120;
    } else {
      // com um chefe na tela, menos inimigos chegando (o chefe é o foco)
      const fight = this.mainBosses.length ? 0.5 : 1;
      rate = wave.rate * fight;
      max = Math.round(wave.max * (fight < 1 ? 0.6 : 1));
    }
    rate *= tierScaling(this.tier).rate;
    rate *= 1 + this.stats.curse;
    max = Math.min(MAX_ENEMIES, Math.round(max * (1 + this.stats.curse)));
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.active.length >= max) continue;
      const id = wave.pool[Math.floor(Math.random() * wave.pool.length)];
      this.spawnEnemy(ENEMIES[id]);
    }
    if (isEliteTime(waveClock(prev), waveClock(t)) && (this.endless || t < runDuration())) {
      const id = wave.pool[wave.pool.length - 1];
      this.spawnEnemy(ENEMIES[id], undefined, undefined, true);
      this.events.emit('announce', 'UM INIMIGO ELITE SURGIU!');
    }
    const clock = this.endless ? t : waveClock(t);
    const minute = Math.floor(clock / 60);
    const event = this.endless ? (minute % 2 === 0 ? 'swarm' : 'ring') : wave.minute === minute ? wave.event : undefined;
    if (event && !this.eventsDone.has(minute) && clock - minute * 60 > 5) {
      this.eventsDone.add(minute);
      // revoada e cerco não acontecem durante a luta com um chefe da fase
      if (!this.mainBosses.length) this.runEvent(event);
    }
  }

  /** Chama o chefe do início (0), do meio (1) ou o final (2). */
  private spawnBoss(index: number) {
    const scale = this.endless ? endlessScaling(this.cycle).hp : 1;
    const def = ENEMIES[this.stage.bosses[index]];
    const e = this.spawnEnemy(def);
    if (e) {
      // a vida do chefe acompanha o momento em que ele chega (meio e final bem mais fortes)
      const at = Math.sqrt(hpMultiplier((RUN_DURATION / 3) * (index + 1)));
      e.maxHp = Math.round(def.hp * scale * at * stageScaling(this.stage).hp * tierScaling(this.tier).hp);
      e.hp = e.maxHp;
      this.bossAI.start(e);
      this.mainBosses.push(e);
      this.boss = this.mainBosses[0];
    }
    this.cameras.main.shake(500, 0.01);
    sfx('boss');
    this.events.emit('announce', `${['CHEFE DO INÍCIO', 'CHEFE DO MEIO', 'CHEFE FINAL'][index]}: ${def.name.toUpperCase()}!`);
  }

  private runEvent(kind: 'swarm' | 'ring') {
    if (kind === 'swarm') {
      this.events.emit('announce', 'UMA REVOADA SE APROXIMA!');
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < 30; i++) {
        const p = this.spawnPoint(base + (Math.random() - 0.5) * 0.8);
        const e = this.spawnEnemy(ENEMIES[this.stage.swarm ?? 'bat'], p.x + Phaser.Math.Between(-30, 30), p.y + Phaser.Math.Between(-30, 30));
        if (e) e.speed *= 1.4;
      }
    } else {
      this.events.emit('announce', 'VOCÊ ESTÁ CERCADO!');
      const n = 28;
      const [early, late] = this.stage.ring ?? ['skeleton', 'orc'];
      const id: EnemyId = this.elapsed > 400 ? late : early;
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
        const dealt = this.hitEnemy(e, p.damage, p.kind === 'axe' ? 0.5 : 0.8, p.element, true, p.effect);
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

  dropPickup(kind: PickupKind, x: number, y: number, value: number) {
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
    else p.setFrame(frameName(kind === 'magnet' ? 'icon_magnet' : kind));
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
    } else if (p.kind === 'magnet') {
      // ímã: puxa todas as gemas do mapa
      for (const g of this.pickups.items) if (g.active && g.kind === 'gem') g.magnet = true;
      this.floatText(this.player.x, this.player.y - 14, 'ÍMÃ!', '#7fc4ff', true);
      sfx('select');
    } else if (p.kind === 'bomb') {
      // bomba: fere todos os inimigos da tela
      const view = this.cameras.main.worldView;
      for (const e of this.activeEnemies()) if (view.contains(e.x, e.y)) this.elementalDamage(e, 40 + this.level * 12, '#ff9a5a');
      this.cameras.main.flash(250, 255, 200, 120);
      this.impact(this.player.x, this.player.y, 0xffb070, 3);
      sfx('boom');
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

  // ---------- Ferramentas de desenvolvedor (painel DEV na pausa) ----------

  /** A tela girou: chão e vinheta acompanham o novo tamanho da área visível. */
  onResize() {
    this.ground.setSize(this.viewW + 128, this.viewH + 128);
    this.vignette.setDisplaySize(this.viewW + 40, this.viewH + 40);
  }

  /** Velocidade do jogo, timers e animações. */
  applyDevSpeed() {
    this.time.timeScale = dev.speed;
    this.tweens.timeScale = dev.speed;
  }

  devLevelUp(n: number) {
    for (let i = 0; i < n; i++) this.addXp(this.xpNext - this.xp);
  }

  /** Sobe `n` níveis de uma arma (ou de todas as do jogo, se `id` não for dado). */
  devWeapon(n: number, id?: WeaponId) {
    for (const w of id ? [id] : WEAPON_IDS) this.loadout.weapons[w] = (this.loadout.weapons[w] ?? 0) + n;
    this.weapons.sync(this.loadout.weapons);
  }

  private devEventIndex = 0;

  /** Dispara o próximo evento da fase (testes). */
  devEvent() {
    const list = this.stage.events;
    this.runEvents.start(list[this.devEventIndex++ % list.length]);
  }

  devBoss() {
    this.spawnBoss(Math.min(2, this.bossesCalled++));
  }

  devKillAll() {
    for (const e of [...this.active]) if (e.active && !e.boss) this.killEnemy(e, true);
  }

  /** Avança o relógio da partida (ondas, elites e chefe). */
  devSkip(seconds: number) {
    this.elapsed += seconds;
  }

  devHeal() {
    this.hp = this.stats.maxHp;
  }

  resumeFromPause() {
    this.scene.stop('Pause');
    this.state = 'playing';
    this.scene.resume();
    this.scene.resume('Hud');
    if (this.pendingLevels > 0) this.openLevelUp();
  }

  private openVictory() {
    if (this.state !== 'playing') {
      // se uma tela de nível estiver aberta, tenta de novo logo depois
      this.time.delayedCall(500, () => this.openVictory());
      return;
    }
    this.state = 'victory';
    this.payRunBonus();
    this.joy.x = this.joy.y = 0;
    this.setPlayerSlot('victory');
    this.player.setScale(1).setRotation(0);
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

  /** Névoa (perigo do Pântano): nuvens lentas que cobrem as bordas da tela e escondem quem se aproxima. */
  private updateFog(cx: number, cy: number) {
    if (this.stage.hazard !== 'fog') return;
    if (!this.fog.length) {
      for (let i = 0; i < 14; i++) {
        const img = this.add.image(0, 0, 'atlas', frameName('glow')).setTint(0xd6e6dc).setDepth(LAYER.overlay - 2);
        this.fog.push({ img, a: (i / 14) * Math.PI * 2, r: 0.42 + Math.random() * 0.2, speed: (Math.random() < 0.5 ? 1 : -1) * (0.02 + Math.random() * 0.03) });
      }
    }
    const w = this.viewW;
    const h = this.viewH;
    for (const f of this.fog) {
      f.a += f.speed * 0.016;
      const breathe = 1 + Math.sin(this.elapsed * 0.5 + f.a * 3) * 0.08;
      f.img.setPosition(cx + Math.cos(f.a) * w * f.r, cy + Math.sin(f.a) * h * f.r * 0.9)
        .setScale((w / 32) * 0.55 * breathe).setAlpha(0.5);
    }
  }

  /**
   * Escuridão da Floresta Sombria: um véu escuro com um furo em volta do herói (textura de gradiente
   * criada uma vez, em tamanho de mundo, que cobre a tela em qualquer zoom).
   */
  private updateDarkness() {
    if (this.stage.hazard !== 'dark') return;
    if (!this.darkness) {
      if (!this.textures.exists('darkness')) {
        const tex = this.textures.createCanvas('darkness', 512, 512)!;
        const ctx = tex.getContext();
        const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
        // centro claro até ~120 px de mundo, escuro a partir de ~300 px (a textura cobre 2400 px)
        g.addColorStop(0, 'rgba(8,6,20,0)');
        g.addColorStop(0.1, 'rgba(8,6,20,0)');
        g.addColorStop(0.25, 'rgba(8,6,20,0.78)');
        g.addColorStop(1, 'rgba(8,6,20,0.84)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 512, 512);
        tex.refresh();
      }
      this.darkness = this.add.image(0, 0, 'darkness').setDisplaySize(2400, 2400).setDepth(LAYER.fx + 4);
    }
    this.darkness.setPosition(this.player.x, this.player.y - 8);
  }

  /** Decoração da fase sorteada pelos pesos dela (r entre 0 e 1). */
  private pickDecor(r: number) {
    const entries = Object.entries(this.stage.decor) as [string, number][];
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let acc = 0;
    for (const [tex, w] of entries) {
      acc += w / total;
      if (r < acc) return tex;
    }
    return entries[entries.length - 1][0];
  }

  /** Objetivos da fase cumpridos até agora (o do chefe e o de vida só contam com o chefe vencido). */
  private starsNow(bossDown: boolean): boolean[] {
    return this.stage.objectives.map((o) => {
      if (o.kind === 'boss') return bossDown;
      if (o.kind === 'event') return this.completed.has(o.event);
      if (o.kind === 'hp') return bossDown && this.hp / this.stats.maxHp >= o.min;
      return this.kills >= o.n;
    });
  }

  /**
   * Guarda estrelas e chefes vencidos na dificuldade da partida (somando às partidas anteriores).
   * Devolve o que a vitória liberou pela primeira vez: a próxima fase (no Normal) e a próxima dificuldade.
   */
  private recordStars(stars: boolean[]): string | undefined {
    const save = loadSave();
    const list = (save.tiers[this.stage.id] ??= []);
    const before = list[this.tier] ?? { stars: [false, false, false], bosses: 0 };
    list[this.tier] = { stars: before.stars.map((b, i) => b || stars[i]), bosses: Math.max(before.bosses, this.bossesDown) };
    writeSave(save);
    if (before.stars[0] || !stars[0]) return undefined;
    const i = STAGES.findIndex((s) => s.id === this.stage.id);
    const parts = [`dificuldade ${tierName(this.tier + 1)}`];
    if (this.tier === 0 && STAGES[i + 1]) parts.unshift(STAGES[i + 1].name);
    return parts.join(' e ');
  }

  result(victory: boolean): RunResult {
    const stars = this.starsNow(this.bossDown);
    const unlocked = this.recordStars(stars);
    return {
      victory,
      stage: this.stage.id,
      tier: this.tier,
      bosses: this.bossesDown,
      stars,
      unlocked,
      endless: this.endless,
      cycle: this.cycle,
      time: this.elapsed,
      kills: this.kills,
      level: this.level,
      gold: Math.floor(this.gold),
      character: this.char.id,
      weapons: this.weapons.owned,
      reactions: REACTIONS.filter((r) => this.elements.dealt[r.id]).map((r) => ({ name: r.name, dealt: this.elements.dealt[r.id]! })),
    };
  }

  /**
   * Ouro de fim de partida: um tanto por minuto sobrevivido e por chefe vencido. Mesmo perdendo, a
   * partida rende melhorias (o ciclo de tentar de novo, mais forte, até vencer a fase).
   */
  private runBonus() {
    const reward = stageScaling(this.stage).reward * tierScaling(this.tier).reward;
    return Math.round(((this.elapsed / 60) * RUN_GOLD.perMinute + this.bossesDown * RUN_GOLD.perBoss) * reward);
  }

  /** Paga o ouro de fim de partida uma vez só (na vitória, antes do modo infinito, ou no fim). */
  private payRunBonus() {
    if (this.bonusPaid) return;
    this.bonusPaid = true;
    this.gold += this.runBonus();
  }

  endRun(victory: boolean) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.payRunBonus();
    const result = this.result(victory);
    this.time.delayedCall(victory ? 0 : 600, () => {
      this.scene.pause();
      this.scene.stop('Hud');
      this.scene.launch('GameOver', result);
    });
    if (!victory || this.endless) {
      this.setPlayerSlot('death');
      this.player.setScale(1).setRotation(0);
      this.tweens.add({ targets: this.player, alpha: 0.75, duration: 500 });
    }
  }

  // ---------- Textos flutuantes ----------

  floatText(x: number, y: number, str: string, color: string, big = false) {
    let t = this.dmgTexts.find((d) => !d.active);
    if (!t && this.dmgTexts.length >= 40) {
      // tela cheia: números comuns são descartados; destaques (crítico, reação) tomam o lugar do mais antigo
      if (!big) return;
      t = this.dmgTexts.reduce((a, b) => ((a.getData('life') as number) < (b.getData('life') as number) ? a : b));
    }
    if (!t) {
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
          const tex = this.pickDecor(r);
          const px = x * CHUNK + rnd() * CHUNK;
          const py = y * CHUNK + rnd() * CHUNK;
          if (Math.hypot(px, py) < 60) continue;
          const img = this.add.image(Math.round(px), Math.round(py), 'atlas', frameName(tex)).setOrigin(0.5, 1).setTint(this.stage.tint.decor);
          const tall = (this.stage.tall ?? ['tree', 'tree2']).includes(tex);
          img.setDepth(tall || UPRIGHT.has(tex) ? py - 6 : LAYER.groundDecor);
          if (tall) img.setData('tall', true);
          imgs.push(img);
        }
        // trechos de terra quebram a monotonia da grama
        if (rnd() < 0.35) {
          const dx = x * CHUNK + rnd() * CHUNK;
          const dy = y * CHUNK + rnd() * CHUNK;
          if (Math.hypot(dx, dy) > 80) {
            const kinds = this.stage.patches ?? ['dirt', 'dirt2'];
            const kind = kinds[Math.floor(rnd() * kinds.length)];
            const patch = this.add.image(Math.round(dx), Math.round(dy), 'atlas', frameName(kind)).setTint(this.stage.tint.decor);
            patch.setDepth(LAYER.groundDecor - 1).setFlipX(rnd() < 0.5);
            // fator de velocidade do herói dentro da mancha
            if (kind === 'mud') patch.setData('mud', 0.6);
            if (kind === 'quicksand') patch.setData('mud', 0.5);
            if (kind === 'cobweb') patch.setData('mud', 0.7);
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
    this.mud = [...this.decor.values()].flat().filter((i) => i.getData('mud'));
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
