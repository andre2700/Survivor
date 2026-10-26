// Eventos aleatórios dentro da partida (Marco 3): baú guardado, prisioneiro que vira aliado, chefe
// surpresa, goblin dourado, chuva de meteoros, emboscada, guerra de tribos, tempestade de areia,
// santuário maldito (escolha arriscada) e lua de sangue.
// Também espalha itens pelo mapa (ímã, bomba, cura) e diz à HUD para onde apontar as setas de borda.
// Cada fase escolhe os seus eventos.
import Phaser from 'phaser';
import { warnCircle, warnLane } from './telegraph';
import { walkPose } from '../art/motion';
import { frameName, loopFrame, slotsOf } from '../art/textures';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { SURPRISE_BOSS } from '../data/bosses';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { WEAPONS, weaponStatsAt } from '../data/weapons';
import { damageMult } from '../core/stats';
import { STAGES, stageScaling, type RunEventId, type Tribe } from '../data/stages';
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
  cursedShrine: 'UM SANTUÁRIO MALDITO!',
  bloodMoon: 'LUA DE SANGUE!',
  blizzard: 'NEVASCA!',
  avalanche: 'AVALANCHE! SAIA DA FAIXA!',
  eruption: 'ERUPÇÃO! O CÉU ESTÁ CAINDO!',
  lavaRiver: 'RIO DE LAVA! SAIA DA FAIXA!',
  procession: 'PROCISSÃO FANTASMA! SAIA DO CAMINHO!',
  cursedBell: 'O SINO AMALDIÇOADO TOCA! DESTRUA-O!',
  treasureRoom: 'UMA SALA DO TESOURO! CUIDADO COM OS MÍMICOS',
  echoes: 'ECOS DO PASSADO: VELHOS INIMIGOS VOLTARAM!',
  hellRain: 'CHUVA INFERNAL! O CÉU QUEIMA!',
  abyssPortal: 'PORTAL ABISSAL! DESTRUA-O ANTES QUE A HORDA CRESÇA!',
};

/** Ecos do passado: quantos chefes de outras fases voltam e com que fração da vida de um chefe. */
const ECHOES = { count: 2, hp: 0.3 };

/** Procissão fantasma: aviso (s), meia altura da faixa (px), velocidade das almas e quantas. */
const PROCESSION = { warn: 2, half: 40, speed: 170, souls: 18 };
/** Sino amaldiçoado: badalada a cada `every` s (com 1 s de brilho antes), dano no herói e nos inimigos. */
const BELL = { every: 6, hero: 0.06, foes: 0.04, boost: 0.1, max: 100 };

/** Tribos da guerra quando a fase não define as suas. */
const DEFAULT_TRIBES: [Tribe, Tribe] = [
  { name: 'Goblins', pool: ['goblin', 'goblin_earth'] },
  { name: 'Esqueletos', pool: ['skeleton'] },
];

/** Tempestade de areia: dura isto (s) e fere todos a cada `tick` (s). */
const STORM = { time: 16, tick: 2, streaks: 110 };

/** Avalanche: aviso (s), meia altura da faixa, velocidade da neve e dano no herói (fração da vida). */
const AVALANCHE = { warn: 2.6, half: 46, speed: 520, hero: 0.35 };

/** Lua de sangue: dura isto (s); fração da vida que herói e inimigos perdem a cada `STORM.tick`. */
const BLOOD_MOON = { time: 20, hero: 0.04, foe: 0.1 };

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
  /** avalanche: faixa (centro e meia altura), direção, início, frente da neve e se acertou o herói */
  private avalanche: {
    y: number; half: number; dir: number; start: number; x: number; g: Phaser.GameObjects.Graphics; hit: boolean; left: number; right: number;
    /** ondas de neve animadas que formam a parede (deslocamento na faixa) */
    wall: { img: Phaser.GameObjects.Image; dx: number; dy: number; phase: number }[];
    /** rio de lava em vez de neve */
    lava: boolean;
    /** onde caiu a última poça de lava */
    poolAt?: number;
  } | null = null;
  /** santuário maldito esperando o herói */
  private shrine: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Graphics; progress: number } | null = null;
  private war: { x: number; y: number; until: number } | null = null;
  /** procissão fantasma: almas em marcha, quando elas chegam e se o herói foi pego */
  private procession: { souls: Enemy[]; start: number; until: number; y: number; dir: number; hit: boolean } | null = null;
  /** chefes de outras fases que voltaram como sombras */
  private echoes: Enemy[] = [];
  /** portal abissal do evento */
  private abyss: Enemy | null = null;
  private abyssUntil = 0;
  /** sino amaldiçoado: o sino (inimigo-objeto), a próxima badalada e o brilho de aviso */
  private bell: { e: Enemy; next: number; glow: Phaser.GameObjects.Image; until: number } | null = null;
  /** tempestade de areia: fim, próximo dano, lado do vento, véu e grãos (posição na tela, 0 a 1) */
  private storm: { kind: 'sand' | 'blood' | 'snow' | 'ash' | 'hell'; time: number; until: number; next: number; wind: number; veil: Phaser.GameObjects.Graphics; grains: { u: number; v: number; len: number; sp: number }[]; moon?: Phaser.GameObjects.Image; halo?: Phaser.GameObjects.Image; nextMeteor?: number } | null = null;

  constructor(private scene: GameScene) {}

  /** Relógio dos eventos: o da linha de 15 min (encurta junto quando a partida é mais curta no DEV). */
  private get clock() {
    return waveClock(this.scene.elapsed);
  }

  update(dt: number) {
    const sc = this.scene;
    // com um chefe da fase na tela, os eventos esperam (o chefe já é o desafio do momento)
    if (sc.boss?.active && this.clock >= this.next) this.next = this.clock + 10;
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
    this.updateShrine(dt);
    this.updateAvalanche(dt);
    this.updateProcession();
    this.updateBell();
    this.updateAbyss();
    if (this.golden && (!this.golden.active || sc.elapsed > this.goldenUntil)) {
      if (this.golden.active) {
        // escapou: some numa nuvem
        sc.impact(this.golden.x, this.golden.y, 0xffd86a, 1.2);
        this.golden.kill();
        sc.events.emit('announce', `${this.goldenName()} FUGIU...`);
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
      && !(e === 'tribeWar' && this.war) && !(e === 'cursedBell' && this.bell) && !(e === 'procession' && this.procession) && !((e === 'sandstorm' || e === 'bloodMoon' || e === 'blizzard' || e === 'eruption' || e === 'hellRain') && this.storm) && !(e === 'abyssPortal' && this.abyss?.active) && !(e === 'echoes' && this.echoes.some((x) => x.active)) && !((e === 'avalanche' || e === 'lavaRiver') && this.avalanche) && !(e === 'cursedShrine' && this.shrine));
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
    this.scene.events.emit('announce', id === 'goldenGoblin' ? (this.goldenFem() ? `UMA ${this.goldenName()}! PEGUE-A!` : `UM ${this.goldenName()}! PEGUE-O!`) : TITLES[id]);
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
        return this.startStorm('sand');
      case 'bloodMoon':
        return this.startStorm('blood');
      case 'blizzard':
        return this.startStorm('snow');
      case 'avalanche':
        return this.startAvalanche();
      case 'lavaRiver':
        return this.startAvalanche(true);
      case 'eruption':
        return this.startStorm('ash');
      case 'cursedShrine':
        return this.startShrine();
      case 'procession':
        return this.startProcession();
      case 'cursedBell':
        return this.startBell();
      case 'treasureRoom':
        return this.startTreasureRoom();
      case 'echoes':
        return this.startEchoes();
      case 'hellRain':
        return this.startStorm('hell');
      case 'abyssPortal':
        return this.startAbyss();
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

  /** Baú no chão (abre ao encostar): eventos e chefes do início e do meio. */
  placeChest(x: number, y: number) {
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
    sfx('chest');
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
    const ring = sc.add.graphics().setDepth(LAYER.warn);
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
    // desafiador: um elite gigante (2,2× maior) com vida de chefe, golpe de chefe (pancada com aviso no chão),
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
    e.baseTint = 0xff9a8a;
    e.setTint(e.baseTint);
    sc.bossAI.start(e, SURPRISE_BOSS);
    sc.miniBoss = e;
    this.surprises.push(e);
    sc.events.emit('announce', `CHEFE SURPRESA: ${ENEMIES[id].name.toUpperCase()} GIGANTE!`);
  }

  /** A criatura dourada tem nome feminino? (Salamandra) — pelo final da primeira palavra. */
  private goldenFem() {
    return /a$/i.test(ENEMIES[this.goldenId()].name.split(' ')[0]);
  }

  private goldenName() {
    return `${ENEMIES[this.goldenId()].name.toUpperCase()} ${this.goldenFem() ? 'DOURADA' : 'DOURADO'}`;
  }

  /** Criatura dourada da fase (cada fase tem a sua). */
  private goldenId(): EnemyId {
    return this.scene.stage.golden ?? this.scene.stage.waves[0].pool[0];
  }

  private startGolden() {
    const sc = this.scene;
    const { x, y } = this.away(200, 240);
    const def = ENEMIES[this.goldenId()];
    const e = sc.spawnEnemy(def, x, y);
    if (!e) return;
    e.tag = 'golden';
    e.maxHp = e.hp = def.hp * 40 * stageScaling(sc.stage).hp;
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
    const warn = warnCircle(sc, x, y, r, 0xff5a2a, 0.9, undefined, 0.75);
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
        if ((p.x - x) ** 2 + ((p.y - y) / 0.75) ** 2 < (r + 6) ** 2) sc.hurtPlayer(sc.stats.maxHp * 0.12);
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

  // ---------- Cataclismos com véu: tempestade de areia e lua de sangue ----------

  /**
   * Cataclismo de véu. Tempestade de areia: a areia esconde a vista e o vento empurra o herói. Lua de
   * sangue: a tela fica vermelha e todos sangram. Nos dois, a cada instante herói e inimigos se ferem.
   */
  private startStorm(kind: 'sand' | 'blood' | 'snow' | 'ash' | 'hell' = 'sand') {
    const sc = this.scene;
    const grains = kind !== 'blood' ? Array.from({ length: STORM.streaks }, () => ({ u: Math.random(), v: Math.random(), len: 6 + Math.random() * 18, sp: 0.5 + Math.random() * 0.7 })) : [];
    const time = kind === 'blood' ? BLOOD_MOON.time : STORM.time;
    this.clearStorm();
    this.storm = {
      kind, time, until: sc.elapsed + time, next: sc.elapsed + STORM.tick, wind: Math.random() < 0.5 ? -1 : 1,
      veil: sc.add.graphics().setDepth(LAYER.fx + 5), grains,
      // lua de sangue: a lua (arte) com um halo vermelho pulsando atrás
      halo: kind === 'blood' ? sc.add.image(0, 0, 'atlas', frameName('glow')).setTint(0xff2030).setBlendMode(Phaser.BlendModes.ADD).setDepth(LAYER.fx + 5.5) : undefined,
      moon: kind === 'blood' ? sc.add.image(0, 0, 'atlas', frameName('blood_moon')).setDepth(LAYER.fx + 6) : undefined,
    };
  }

  private clearStorm() {
    this.storm?.veil.destroy();
    this.storm?.moon?.destroy();
    this.storm?.halo?.destroy();
  }

  private updateStorm(dt: number) {
    const s = this.storm;
    if (!s) return;
    const sc = this.scene;
    const t = sc.elapsed;
    if (t >= s.until || sc.state === 'over') {
      this.clearStorm();
      this.storm = null;
      sc.weatherHero = sc.weatherFoes = 1;
      return;
    }
    // véu: entra e sai suave
    const left = s.until - t;
    const k = Math.min(1, (s.time - left) / 1.5, left / 1.5);
    const v = sc.cameras.main.worldView;
    const g = s.veil.clear();
    const sand = s.kind === 'sand';
    if (s.kind === 'ash' || s.kind === 'hell') {
      // erupção (cinzas) e chuva infernal (céu vermelho, mais meteoros): brasas subindo e meteoros
      // caindo pela tela (cataclismo: ferem herói e inimigos, com o aviso de sempre)
      const hell = s.kind === 'hell';
      g.fillStyle(hell ? 0x7a0a14 : 0x5a2010, (hell ? 0.36 : 0.32) * k).fillRect(v.x - 20, v.y - 20, v.width + 40, v.height + 40);
      for (const p of s.grains) {
        p.u += s.wind * p.sp * 0.15 * dt;
        p.v -= p.sp * 0.3 * dt;
        if (p.u > 1.05) p.u -= 1.1;
        if (p.u < -0.05) p.u += 1.1;
        const x = v.x + p.u * v.width;
        const y = v.y + (((p.v % 1) + 1) % 1) * v.height;
        g.fillStyle(p.len > 16 ? 0xffb050 : hell ? 0xff4a3a : 0x8a8a8a, 0.8 * k).fillCircle(x, y, p.len > 16 ? 1.8 : 2.4);
      }
      if (t >= (s.nextMeteor ?? 0) && left > 1.5) {
        s.nextMeteor = t + (hell ? 0.4 : 0.55);
        const near = Math.random() < 0.45;
        const at = near ? this.away(0, 120) : { x: v.x + 30 + Math.random() * (v.width - 60), y: v.y + 60 + Math.random() * (v.height - 120) };
        this.meteor(at.x, at.y);
      }
    } else if (s.kind === 'snow') {
      // nevasca: véu branco, flocos caindo de lado; herói e inimigos andam mais devagar
      g.fillStyle(0xd8e8f8, 0.3 * k).fillRect(v.x - 20, v.y - 20, v.width + 40, v.height + 40);
      for (const p of s.grains) {
        p.u += s.wind * p.sp * 0.4 * dt;
        p.v += p.sp * 0.35 * dt;
        if (p.u > 1.05) p.u -= 1.1;
        if (p.u < -0.05) p.u += 1.1;
        const x = v.x + p.u * v.width;
        const y = v.y + (p.v % 1) * v.height;
        g.fillStyle(0xffffff, 0.85 * k).fillCircle(x, y, p.len > 16 ? 2.4 : 1.5);
      }
      sc.weatherHero = 1 - 0.3 * k;
      sc.weatherFoes = 1 - 0.3 * k;
    } else if (sand) {
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
    } else {
      // lua de sangue: céu vermelho que pulsa e a lua no canto
      const pulse = 0.85 + Math.sin(t * 3) * 0.15;
      g.fillStyle(0x8a0a18, 0.3 * k * pulse).fillRect(v.x - 20, v.y - 20, v.width + 40, v.height + 40);
      const mx = v.right - v.width * 0.2;
      const my = v.y + v.height * 0.13;
      s.moon?.setPosition(mx, my).setAlpha(k).setScale(0.95 + 0.03 * Math.sin(t * 1.5));
      s.halo?.setPosition(mx, my).setAlpha(0.55 * k * pulse).setScale(7 * pulse);
    }
    if (t < s.next || s.kind === 'ash' || s.kind === 'hell') return;
    s.next = t + STORM.tick;
    // cataclismo: fere o herói e os inimigos na tela (chefes perdem só 1%)
    const hero = s.kind === 'blood' ? BLOOD_MOON.hero : s.kind === 'snow' ? 0.04 : 0.05;
    const foe = s.kind === 'blood' ? BLOOD_MOON.foe : s.kind === 'snow' ? 0.1 : 0.12;
    const color = s.kind === 'blood' ? '#ff3040' : s.kind === 'snow' ? '#bff0ff' : '#e8c070';
    sc.hurtPlayer(sc.stats.maxHp * hero);
    sc.queryEnemies(v.centerX, v.centerY, Math.hypot(v.width, v.height) / 2, (e) => {
      if (e.active && v.contains(e.x, e.y)) sc.elementalDamage(e, e.boss ? e.maxHp * 0.01 : Math.max(20, e.maxHp * foe), color);
    });
  }

  // ---------- Avalanche ----------

  /**
   * Uma faixa larga atravessa a tela (aviso no chão por 2,6 s, o chão treme); depois uma parede de
   * neve passa por ela e esmaga quem estiver dentro: herói e inimigos. Escapar vale o objetivo.
   */
  /** Avalanche (neve) ou rio de lava (`lava`: a parede é de lava e deixa poças no caminho). */
  private startAvalanche(lava = false) {
    const sc = this.scene;
    const v = sc.cameras.main.worldView;
    const p = sc.player;
    const dir = Math.random() < 0.5 ? 1 : -1;
    // a faixa passa pelo herói (deslocada um pouco) para obrigar a sair dela
    const y = p.y + (Math.random() - 0.5) * 40;
    const g = sc.add.graphics().setDepth(LAYER.warn);
    const half = AVALANCHE.half;
    // parede: ondas de neve em duas fileiras, desencontradas, cobrindo a altura da faixa
    const wall = [-0.75, -0.2, 0.35, 0.9].map((k, i) => ({
      img: sc.add.image(0, 0, 'atlas', frameName(lava ? 'fx_lavaflow' : 'fx_avalanche')).setOrigin(0.82, 1).setFlipX(dir < 0).setVisible(false).setScale(1.05 - (i % 2) * 0.1),
      dx: (i % 2 ? -14 : 6), dy: k * half + 22, phase: i * 0.37,
    }));
    this.avalanche = { y, half, dir, start: sc.elapsed + AVALANCHE.warn, x: dir > 0 ? v.x - 60 : v.right + 60, g, hit: false, left: v.x - 120, right: v.right + 120, wall, lava };
    sc.cameras.main.shake(AVALANCHE.warn * 1000, 0.002);
  }

  private updateAvalanche(dt: number) {
    const a = this.avalanche;
    if (!a) return;
    const sc = this.scene;
    const t = sc.elapsed;
    const g = a.g.clear();
    if (t < a.start) {
      // aviso: faixa vermelha piscando, bordas tracejadas e setas na direção da avalanche;
      // neve começa a cair do lado de onde ela vem
      const k = 1 - (a.start - t) / AVALANCHE.warn;
      const blink = 0.14 + 0.1 * Math.sin(t * 10) + 0.08 * k;
      g.fillStyle(0xff3020, blink).fillRect(a.left, a.y - a.half, a.right - a.left, a.half * 2);
      for (let x = a.left; x < a.right; x += 22) {
        g.fillStyle(0xff3020, 0.95).fillRect(x, a.y - a.half - 2, 12, 4).fillRect(x, a.y + a.half - 2, 12, 4);
      }
      const shift = ((t * 90) % 70) * a.dir;
      for (let x = a.left + 40; x < a.right; x += 70) {
        const cx = x + shift;
        g.fillStyle(0xffffff, 0.85).fillTriangle(cx + a.dir * 14, a.y, cx - a.dir * 8, a.y - 12, cx - a.dir * 8, a.y + 12);
        g.lineStyle(2, 0xb02010, 0.9).strokeTriangle(cx + a.dir * 14, a.y, cx - a.dir * 8, a.y - 12, cx - a.dir * 8, a.y + 12);
      }
      if (Math.random() < 0.3 + k) sc.impact(a.x + a.dir * 30, a.y + (Math.random() - 0.5) * a.half * 2, a.lava ? 0xff8a3a : 0xffffff, 0.6);
      return;
    }
    // a parede de neve passa
    a.x += a.dir * AVALANCHE.speed * dt;
    const back = a.x - a.dir * 90;
    for (const w of a.wall) {
      const wy = a.y + w.dy + Math.sin(t * 9 + w.phase * 10) * 2;
      w.img.setVisible(true).setPosition(a.x + a.dir * w.dx, wy).setDepth(wy)
        .setFrame(loopFrame(a.lava ? 'fx_lavaflow' : 'fx_avalanche', t + w.phase, 10));
    }
    // neve espirrando na frente e um rastro de neve que assenta atrás
    if (Math.random() < 0.7) sc.impact(a.x + a.dir * 10, a.y + (Math.random() - 0.5) * a.half * 2, a.lava ? 0xff8a3a : 0xffffff, 1.1);
    if (a.lava) {
      // a lava deixa poças pelo caminho, que esfriam depois de um tempo
      // uma poça a cada 80 px percorridos (não depende da taxa de quadros)
      a.poolAt ??= a.x;
      if (Math.abs(a.x - a.poolAt) > 80) {
        a.poolAt = a.x;
        sc.mapHazards.addLava(back, a.y + (Math.random() - 0.5) * a.half * 1.2, 9, 0.5);
      }
      if (Math.random() < 0.4) sc.emitFlame(back - a.dir * Math.random() * 30, a.y + (Math.random() - 0.5) * a.half * 1.8);
    } else if (Math.random() < 0.5) {
      const px = back - a.dir * Math.random() * 40;
      const py = a.y + (Math.random() - 0.5) * a.half * 1.8;
      const puff = sc.add.image(px, py, 'atlas', frameName('glow')).setTint(0xeaf6ff).setScale(1.2 + Math.random(), 0.7).setAlpha(0.7).setDepth(LAYER.groundFx);
      sc.tweens.add({ targets: puff, alpha: 0, scaleX: 2.4, duration: 1600, onComplete: () => puff.destroy() });
    }
    const inBand = (x: number, y: number) => Math.abs(y - a.y) < a.half && (a.dir > 0 ? x <= a.x && x >= back : x >= a.x && x <= back);
    const p = sc.player;
    // pego na faixa: não conta como escapar, mesmo se o golpe cair no tempo de invencibilidade
    if (!a.hit && inBand(p.x, p.y)) {
      a.hit = true;
      sc.hurtPlayer(sc.stats.maxHp * AVALANCHE.hero);
    }
    sc.queryEnemies(a.x, a.y, a.half + 60, (e) => {
      if (e.active && inBand(e.x, e.y)) sc.elementalDamage(e, e.boss ? e.maxHp * 0.03 : e.maxHp * 0.7 + 50, a.lava ? '#ff9a5a' : '#bff0ff');
    });
    if ((a.dir > 0 && back > a.right) || (a.dir < 0 && back < a.left)) {
      g.destroy();
      for (const w of a.wall) w.img.destroy();
      if (!a.hit) {
        sc.completed.add(a.lava ? 'lavaRiver' : 'avalanche');
        sc.events.emit('announce', a.lava ? 'VOCÊ ESCAPOU DO RIO DE LAVA!' : 'VOCÊ ESCAPOU DA AVALANCHE!');
      }
      this.avalanche = null;
    }
  }

  // ---------- Procissão fantasma ----------

  /**
   * Uma fila de almas penadas atravessa a tela numa faixa (com aviso de 2 s). Elas não perseguem o
   * herói: ferem quem está no caminho. Escapar sem ser tocado vale o evento.
   */
  private startProcession() {
    const sc = this.scene;
    const v = sc.cameras.main.worldView;
    const p = sc.player;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = p.y + (Math.random() - 0.5) * 30;
    const x0 = dir > 0 ? v.x - 40 : v.right + 40;
    const x1 = dir > 0 ? v.right + 40 : v.x - 40;
    warnLane(sc, x0, y, x1, y, PROCESSION.half, 0xb060ff, PROCESSION.warn);
    this.procession = { souls: [], start: sc.elapsed + PROCESSION.warn, until: sc.elapsed + PROCESSION.warn + (v.width + 400) / PROCESSION.speed + 1, y, dir, hit: false };
  }

  private updateProcession() {
    const pr = this.procession;
    if (!pr) return;
    const sc = this.scene;
    const t = sc.elapsed;
    const v = sc.cameras.main.worldView;
    // as almas entram em fila, em duas ou três colunas desencontradas
    if (t >= pr.start && pr.souls.length < PROCESSION.souls && t >= pr.start + pr.souls.length * 0.09) {
      const i = pr.souls.length;
      const x = pr.dir > 0 ? v.x - 30 - (i % 3) * 14 : v.right + 30 + (i % 3) * 14;
      const e = sc.spawnEnemy(ENEMIES.lost_soul, x, pr.y + ((i % 3) - 1) * PROCESSION.half * 0.6);
      if (e) {
        e.tag = 'procession';
        e.marchX = pr.dir * PROCESSION.speed;
        e.marchY = 0.0001;
        pr.souls.push(e);
      } else pr.souls.push(null as unknown as Enemy);
    }
    const p = sc.player;
    if (!pr.hit && pr.souls.some((e) => e?.active && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (e.radius + 10) ** 2)) pr.hit = true;
    for (const e of pr.souls) {
      // passou da tela: some
      if (e?.active && (pr.dir > 0 ? e.x > v.right + 80 : e.x < v.x - 80)) e.kill();
    }
    if (t < pr.until) return;
    for (const e of pr.souls) if (e?.active && e.tag === 'procession') e.kill();
    if (!pr.hit) {
      sc.completed.add('procession');
      sc.events.emit('announce', 'A PROCISSÃO PASSOU!');
    }
    this.procession = null;
  }

  // ---------- Sino amaldiçoado ----------

  /**
   * Cataclismo: um sino aparece perto e toca a cada 6 s. Cada badalada fere o herói e os inimigos e
   * deixa os inimigos 10% mais fortes, até as armas destruírem o sino.
   */
  private startBell() {
    const sc = this.scene;
    const { x, y } = this.away(200, 260);
    const e = sc.spawnEnemy(ENEMIES.cursed_bell, x, y);
    if (!e) return;
    e.tag = 'bell';
    e.setOrigin(0.5, 0.88);
    e.alpha = 1;
    const glow = sc.add.image(x, y - 30, 'atlas', frameName('glow')).setTint(0xb060ff).setDepth(y + 1).setScale(1.2).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.bell = { e, next: sc.elapsed + BELL.every, glow, until: sc.elapsed + BELL.max };
    this.guard(x, y, 6, 56);
  }

  private updateBell() {
    const b = this.bell;
    if (!b) return;
    const sc = this.scene;
    const t = sc.elapsed;
    if (!b.e.active || t > b.until) {
      // calou: destruído pelas armas (vale o objetivo) ou se desfez sozinho depois de muito tempo
      const broken = !b.e.active;
      b.glow.destroy();
      if (b.e.active) b.e.kill();
      sc.bellBoost = 0;
      if (broken) {
        sc.completed.add('cursedBell');
        sc.events.emit('announce', 'O SINO SE CALOU!');
        sc.impact(b.e.x, b.e.y - 20, 0xb060ff, 2.6);
        this.placeChest(b.e.x, b.e.y + 10);
      }
      this.bell = null;
      return;
    }
    // 1 s antes da badalada o sino brilha e treme (aviso)
    const k = 1 - (b.next - t);
    b.glow.setAlpha(k > 0 ? 0.3 + 0.5 * k : 0.15).setScale(1.2 + Math.max(0, k) * 0.8);
    b.e.setAngle(k > 0 ? Math.sin(t * 30) * 4 * k : 0);
    if (t < b.next) return;
    b.next = t + BELL.every;
    sc.bellBoost += BELL.boost;
    sfx('bell');
    sc.cameras.main.shake(260, 0.006);
    // onda de som roxa saindo do sino
    const ring = sc.add.image(b.e.x, b.e.y - 20, 'atlas', frameName('glow')).setTint(0xb060ff).setDepth(LAYER.fx).setScale(1).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    sc.screenTint(0x6a2aa0);
    sc.hurtPlayer(sc.stats.maxHp * BELL.hero);
    for (const e of sc.activeEnemies()) {
      if (e.active && !e.boss && !e.def.object) sc.elementalDamage(e, e.maxHp * BELL.foes, '#d6a6ff');
    }
    sc.floatText(b.e.x, b.e.y - 60, `BLÉM! INIMIGOS +${Math.round(sc.bellBoost * 100)}%`, '#d6a6ff', true);
  }

  // ---------- Ecos do passado ----------

  /** Dois chefes do início ou do meio de fases anteriores voltam como sombras (com 30% da vida). */
  private startEchoes() {
    const sc = this.scene;
    const past = STAGES.slice(0, Math.max(1, sc.stageIndex)).flatMap((st) => st.bosses.slice(0, 2));
    const picks = [...new Set(past)].sort(() => Math.random() - 0.5).slice(0, ECHOES.count);
    picks.forEach((id, i) => {
      const { x, y } = this.away(200 + i * 30, 240 + i * 30);
      const e = sc.spawnEnemy(ENEMIES[id], x, y);
      if (!e) return;
      e.tag = 'echo';
      e.maxHp = Math.round(e.maxHp * ECHOES.hp);
      e.hp = e.maxHp;
      sc.bossAI.start(e);
      // sombra roxa e meio transparente (depois do início do chefe, que acerta a cor dele)
      e.baseTint = 0x8a6ac8;
      e.setTint(e.baseTint).setAlpha(0.85);
      sc.impact(x, y, 0x8a6ac8, 2.4);
      this.echoes.push(e);
    });
  }

  // ---------- Portal abissal ----------

  /** Um portal grande solta levas de inimigos a cada 1,2 s, em qualquer distância, até ser destruído. */
  private startAbyss() {
    const sc = this.scene;
    const { x, y } = this.away(220, 260);
    this.abyss = sc.spawnPortal(x, y, 1.2, 3, 9999, 1.7);
    if (!this.abyss) return;
    this.abyss.maxHp *= 2.5;
    this.abyss.hp = this.abyss.maxHp;
    this.abyssUntil = sc.elapsed + 70;
  }

  private updateAbyss() {
    const a = this.abyss;
    if (!a) return;
    const sc = this.scene;
    if (a.active && sc.elapsed < this.abyssUntil) return;
    if (!a.active) {
      sc.completed.add('abyssPortal');
      sc.events.emit('announce', 'O PORTAL ABISSAL SE FECHOU!');
      this.placeChest(a.x, a.y);
    } else {
      // ninguém fechou: o portal some sozinho depois de um tempo, sem prêmio
      sc.impact(a.x, a.y - 30, 0xff2a4a, 2);
      a.kill();
    }
    this.abyss = null;
  }

  // ---------- Sala do tesouro ----------

  /** Vários baús num círculo, guardados; alguns são mímicos disfarçados. */
  private startTreasureRoom() {
    const sc = this.scene;
    const { x, y } = this.away(260, 320);
    const n = 5;
    const mimics = new Set<number>();
    while (mimics.size < 2) mimics.add(Math.floor(Math.random() * n));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const cx = x + Math.cos(a) * 58;
      const cy = y + Math.sin(a) * 46;
      if (mimics.has(i)) sc.spawnSleeper('mimic', cx, cy);
      else this.placeChest(cx, cy);
    }
    this.guard(x, y, 6, 110);
  }

  // ---------- Santuário maldito ----------

  /**
   * Escolha arriscada: fique perto do santuário para ativá-lo. Ele dá poder (+1 nível em duas armas e
   * cura) e amaldiçoa a floresta: por 45 s os inimigos ficam 30% mais rápidos e ferem 30% a mais.
   */
  private startShrine() {
    const sc = this.scene;
    const { x, y } = this.away(240, 300);
    const img = sc.add.image(x, y, 'atlas', frameName('cursed_shrine')).setOrigin(0.5, 0.85).setDepth(y).setScale(1.3);
    const glow = sc.add.image(x, y - 22, 'atlas', frameName('glow')).setTint(0xb060ff).setDepth(y + 1).setScale(1.4).setAlpha(0.6);
    sc.tweens.add({ targets: glow, alpha: 0.25, scale: 1.8, duration: 900, yoyo: true, repeat: -1 });
    const ring = sc.add.graphics().setDepth(LAYER.warn);
    this.shrine = { img, glow, ring, progress: 0 };
    this.guard(x, y, 6, 52);
  }

  private updateShrine(dt: number) {
    const c = this.shrine;
    if (!c) return;
    const sc = this.scene;
    const p = sc.player;
    const near = (p.x - c.img.x) ** 2 + (p.y - c.img.y) ** 2 < 40 * 40;
    c.progress = Phaser.Math.Clamp(c.progress + (near ? dt / 1.5 : -dt), 0, 1);
    c.ring.clear();
    c.ring.lineStyle(3, 0xffffff, 0.25).strokeCircle(c.img.x, c.img.y, 34);
    if (c.progress > 0) c.ring.lineStyle(4, 0xb060ff, 1).beginPath().arc(c.img.x, c.img.y, 34, -Math.PI / 2, -Math.PI / 2 + c.progress * Math.PI * 2).strokePath();
    if (c.progress < 1) return;
    this.shrine = null;
    c.ring.destroy();
    c.glow.destroy();
    sc.tweens.add({ targets: c.img, alpha: 0.35, duration: 600 });
    sc.time.delayedCall(8000, () => c.img.destroy());
    sc.completed.add('cursedShrine');
    sc.impact(c.img.x, c.img.y - 20, 0xb060ff, 2.4);
    sc.cameras.main.flash(300, 120, 40, 200);
    sfx('levelup');
    // poder
    const owned = [...sc.ownedWeapons].sort(() => Math.random() - 0.5).slice(0, 2);
    for (const w of owned) sc.devWeapon(1, w.id);
    sc.hp = Math.min(sc.stats.maxHp, sc.hp + sc.stats.maxHp * 0.3);
    sc.floatText(c.img.x, c.img.y - 40, owned.length > 1 ? 'DUAS ARMAS +1 NÍVEL!' : 'PODER!', '#d6a6ff', true);
    // e a maldição
    sc.cursedUntil = sc.elapsed + 45;
    sc.events.emit('announce', 'PODER... E UMA MALDIÇÃO!');
  }

  /** Um inimigo de evento morreu: recompensas do goblin dourado e do chefe surpresa. */
  onKill(e: Enemy) {
    const sc = this.scene;
    if (e.tag === 'golden') {
      sc.completed.add('goldenGoblin');
      sc.events.emit('announce', `${this.goldenName()} ${this.goldenFem() ? 'PEGA' : 'PEGO'}!`);
      for (let i = 0; i < 30; i++) sc.dropPickup('coin', e.x + Phaser.Math.Between(-30, 30), e.y + Phaser.Math.Between(-24, 24), 4);
      this.golden = null;
    } else if (e.tag === 'echo') {
      this.echoes = this.echoes.filter((x) => x !== e && x.active);
      if (!this.echoes.length) {
        sc.completed.add('echoes');
        sc.events.emit('announce', 'OS ECOS SE CALARAM!');
        this.placeChest(e.x, e.y);
      }
    } else if (e.tag === 'surprise') {
      sc.completed.add('surpriseBoss');
      if (sc.miniBoss === e) sc.miniBoss = null;
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
    if (this.shrine) list.push({ x: this.shrine.img.x, y: this.shrine.img.y, color: 0xb060ff });
    for (const e of this.echoes) if (e.active) list.push({ x: e.x, y: e.y, color: 0x8a6ac8 });
    if (this.abyss?.active) list.push({ x: this.abyss.x, y: this.abyss.y, color: 0xff2a4a });
    if (this.bell?.e.active) list.push({ x: this.bell.e.x, y: this.bell.e.y, color: 0xb060ff });
    return list;
  }
}
