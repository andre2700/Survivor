import Phaser from 'phaser';
import { settings } from '../systems/settings';
import { canEvolve, eggReady } from '../systems/pets';
import { pendingRewards } from '../systems/progress';
import { VIEW, WIDE_COL, col, isWide, pointerPos, setupCamera } from '../ui/view';
import { walkPose } from '../art/motion';
import { generateTextures, groundSprite, preloadArt, scrollGround, slotsOf } from '../art/textures';
import { formatNumber } from '../core/format';
import { CHARACTERS } from '../data/characters';
import { META_CATEGORIES, META_UPGRADES, metaCost, type MetaCategory } from '../data/meta';
import { WEAPONS } from '../data/weapons';
import { loadSave, writeSave } from '../systems/save';
import { DEV_TOOLS } from '../systems/dev';
import { playMusic, setMusicEnabled } from '../systems/music';
import { setSoundEnabled, sfx, unlockAudio } from '../systems/sfx';
import { FONT, button, goldTitle, panel, text, px } from '../ui/theme';
import { formatTime } from './HudScene';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    preloadArt(this);
  }

  create() {
    generateTextures(this);
    setSoundEnabled(settings.sound);
    setMusicEnabled(settings.music);
    this.scene.start('Menu');
  }
}

/** Cenário vivo de fundo dos menus: grama rolando, árvores nas bordas, vaga-lumes e vinheta. */
export function menuBackground(scene: Phaser.Scene, darken = 0.25) {
  const { width, height } = VIEW;
  const ground = groundSprite(scene, -VIEW.bleed, 0, VIEW.screenWidth, height).setOrigin(0);
  let scroll = 0;
  const decor = scene.add.container(0, 0);
  const trees: [string, number, number][] = [
    ['tree', 18, 120], ['tree2', width - 14, 170], ['bush', 30, 300], ['tree', width - 30, height - 120], ['tree2', 10, height - 60],
    ['rock', width - 60, 330], ['flowers', 70, 250], ['mushroom', width - 80, height - 200], ['tallgrass', 50, height - 220], ['stump', width - 40, 420],
  ];
  for (const [key, x, y] of trees) decor.add(scene.add.image(x, y, key).setOrigin(0.5, 1));
  scene.add.rectangle(-VIEW.bleed, 0, VIEW.screenWidth, height, 0x0b0a14, darken).setOrigin(0);
  scene.add.particles(0, 0, 'glow', {
    x: { min: 0, max: width },
    y: { min: 0, max: height },
    lifespan: 5000,
    speedX: { min: -6, max: 6 },
    speedY: { min: -12, max: 0 },
    scale: { min: 0.1, max: 0.2 },
    alpha: { values: [0, 0.9, 0.9, 0] },
    tint: [0xfff2a8, 0xd8ffb0],
    blendMode: Phaser.BlendModes.ADD,
    frequency: 180,
  });
  scene.add.image(-VIEW.bleed, 0, 'vignette').setOrigin(0).setDisplaySize(VIEW.screenWidth, height);
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
    scroll -= dt * 0.012;
    scrollGround(ground, 0, scroll);
    decor.y += dt * 0.012;
    if (decor.y > 160) decor.y -= 160;
  });
}

/** Contador de ouro no canto superior direito. */
export function goldPill(scene: Phaser.Scene, gold: number) {
  // no canto da tela (na horizontal, além da coluna)
  const width = VIEW.width + VIEW.bleed;
  const label = formatNumber(gold);
  const w = 44 + label.length * 8;
  panel(scene, width - 10 - w / 2, 20, w, 26, 'ui_panel_dark');
  scene.add.image(width - w + 2, 20, 'coin');
  return text(scene, width - 18, 20, label, 13, '#ffd86a', { bold: true }).setOrigin(1, 0.5);
}

export class MenuScene extends Phaser.Scene {
  private index = 0;

  constructor() {
    super('Menu');
  }

  create() {
    setupCamera(this);
    playMusic('menu');
    const { width, height } = VIEW;
    const save = loadSave();
    this.index = Math.max(0, CHARACTERS.findIndex((c) => c.id === save.selected));
    menuBackground(this);
    goldPill(this, save.gold);

    // deitado: herói à esquerda, ficha e botões à direita
    const wide = isWide();
    const heroX = wide ? col(-1) : width / 2;
    const infoX = wide ? col(1) : width / 2;
    button(this, 34 - VIEW.bleed, 20, 'AJUSTES', () => {
      unlockAudio();
      sfx('select');
      this.scene.pause();
      this.scene.launch('Settings', { from: 'Menu' });
    }, { width: 62, height: 26, size: 10 }).setDepth(10);
    if (DEV_TOOLS) {
      button(this, 34 - VIEW.bleed, 50, 'DEV', () => {
        this.scene.pause();
        this.scene.launch('Dev', { from: 'Menu' });
      }, { width: 56, height: 24, size: 11, variant: 'purple' }).setDepth(10);
    }

    // Logo
    const logoY = wide ? 46 : height * 0.11;
    const logo = goldTitle(this, infoX, logoY, 'SURVIVOR', 46);
    this.tweens.add({ targets: logo, y: logoY - 4, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const tag = text(this, infoX, logoY + 38, 'Sobreviva às hordas. Monte sua lenda.', 12, '#e8e2d0', { shadow: true });
    tag.setAlpha(0.9);

    // Herói em destaque sobre um pedestal luminoso
    const cy = wide ? height * 0.5 : height * 0.33;
    const glow = this.add.image(heroX, cy + 70, 'aura').setScale(2.4, 1.1).setTint(0xffe9a0).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.95, duration: 1200, yoyo: true, repeat: -1 });
    const hero = this.add.image(heroX, cy + 78, `portrait_${CHARACTERS[this.index].texture}`).setOrigin(0.5, 0.97).setScale(4.4);
    this.events.on(Phaser.Scenes.Events.UPDATE, (t: number) => {
      const pose = walkPose('hero', t / 1000, false);
      hero.setScale(4.4 * pose.sx, 4.4 * pose.sy);
    });
    this.add.particles(heroX, cy + 60, 'glow', {
      x: { min: -50, max: 50 },
      speedY: { min: -40, max: -15 },
      lifespan: 1600,
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xffe9a0,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 120,
    });

    // Ficha do herói
    const cardY = wide ? 160 : cy + 132;
    const cardW = wide ? WIDE_COL : width - 36;
    panel(this, infoX, cardY, cardW, 92, 'ui_panel');
    const name = text(this, infoX, cardY - 30, '', 18, '#ffd86a', { bold: true, strokeThickness: 4 });
    const desc = text(this, infoX, cardY - 4, '', 12, '#d8dcef', { wrap: cardW - 34 });
    const weaponIcon = this.add.image(infoX - 64, cardY + 28, 'bolt');
    const weaponName = text(this, infoX - 52, cardY + 28, '', 12, '#ffe9a0', { bold: true }).setOrigin(0, 0.5);

    let action: Phaser.GameObjects.Container | null = null;
    const refresh = () => {
      const c = CHARACTERS[this.index];
      const unlocked = save.unlocked.includes(c.id);
      hero.setTexture(`portrait_${c.texture}`).setTint(unlocked ? 0xffffff : 0x2a2c3a);
      name.setText(unlocked ? c.name : `${c.name} · bloqueado`);
      desc.setText(c.description);
      weaponIcon.setTexture(WEAPONS[c.weapon].icon);
      weaponName.setText(`Arma inicial: ${WEAPONS[c.weapon].name}`);
      if (unlocked) {
        save.selected = c.id;
        writeSave(save);
      }
      action?.destroy();
      if (unlocked) {
        action = button(this, infoX, cardY + 100, 'JOGAR', () => this.startGame(), { width: 220, height: 50, size: 22, variant: 'primary' });
        this.tweens.add({ targets: action, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      } else {
        const can = save.gold >= c.cost;
        action = button(this, infoX, cardY + 100, `LIBERAR · ${formatNumber(c.cost)}`, () => {
          if (save.gold < c.cost) return;
          save.gold -= c.cost;
          save.unlocked.push(c.id);
          writeSave(save);
          sfx('levelup');
          this.scene.restart();
        }, { width: 220, height: 50, size: 16, variant: can ? 'primary' : 'normal', disabled: !can, icon: 'coin' });
      }
    };
    const cycle = (d: number) => {
      unlockAudio();
      sfx('select');
      this.index = (this.index + d + CHARACTERS.length) % CHARACTERS.length;
      refresh();
    };
    const arrow = wide ? 120 : width / 2 - 40;
    button(this, heroX - arrow, cy + 30, '<', () => cycle(-1), { width: 40, height: 44, size: 20 });
    button(this, heroX + arrow, cy + 30, '>', () => cycle(1), { width: 40, height: 44, size: 20 });
    refresh();

    // missões: canto de cima, embaixo do ouro, com o número de recompensas esperando
    const mx = VIEW.width + VIEW.bleed - 52;
    button(this, mx, 54, 'MISSÕES', () => {
      unlockAudio();
      sfx('select');
      this.seeTip('missions');
      this.scene.start('Missions');
    }, { width: 84, height: 28, size: 11, icon: 'icon_star' }).setDepth(10);
    const pending = pendingRewards(save);
    writeSave(save);
    if (pending) {
      const badge = this.add.container(mx + 40, 42).setDepth(11);
      badge.add(this.add.circle(0, 0, 10, 0xff4a5a).setStrokeStyle(2, 0xffffff));
      badge.add(text(this, 0, 0, String(pending), 10, '#ffffff', { bold: true }));
      this.tweens.add({ targets: badge, scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
    }

    button(this, infoX - 121, cardY + 156, 'MELHORIAS', () => {
      unlockAudio();
      sfx('select');
      this.seeTip('shop');
      this.scene.start('Shop');
    }, { width: 116, height: 38, size: 10, icon: 'icon_star' });
    button(this, infoX + 121, cardY + 156, 'PETS', () => {
      unlockAudio();
      sfx('select');
      this.seeTip('pets');
      this.scene.start('Pets');
    }, { width: 116, height: 38, size: 12, icon: 'egg_dragon' });
    button(this, infoX, cardY + 156, 'EQUIPAMENTO', () => {
      unlockAudio();
      sfx('select');
      const s = loadSave();
      s.newItems = 0;
      writeSave(s);
      this.seeTip('equip');
      this.scene.start('Equip');
    }, { width: 116, height: 38, size: 10, icon: 'item_helm' });
    // ovo pronto para chocar
    if (save.eggs.some(eggReady) || (save.activePet && canEvolve(save, save.activePet))) {
      const badge = this.add.container(infoX + 121 + 52, cardY + 140);
      badge.add(this.add.circle(0, 0, 10, 0x4ac05a).setStrokeStyle(2, 0xffffff));
      badge.add(text(this, 0, 0, '!', 11, '#ffffff', { bold: true }));
      this.tweens.add({ targets: badge, scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
    }
    // itens novos desde a última visita
    if (save.newItems) {
      const badge = this.add.container(infoX + 52, cardY + 140);
      badge.add(this.add.circle(0, 0, 10, 0xff4a5a).setStrokeStyle(2, 0xffffff));
      badge.add(text(this, 0, 0, String(save.newItems), 10, '#ffffff', { bold: true }));
      this.tweens.add({ targets: badge, scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
    }

    if (save.bestTime > 0) {
      const cycleTxt = save.bestCycle ? ` · ciclo ${save.bestCycle}` : '';
      text(this, infoX, height - 18, `Recorde: ${formatTime(save.bestTime)} · ${formatNumber(save.bestKills)} abates${cycleTxt}`, 11, '#a8acc4');
    }

    // dica da vez (uma de cada, só depois do tutorial): aponta o botão que vale abrir agora
    if (save.tutorial >= 99) {
      const tips: [string, boolean, number, number, string][] = [
        ['shop', save.gold >= 60 && !Object.values(save.meta).some(Boolean), infoX - 121, cardY + 156, 'Gaste o ouro em melhorias!'],
        ['equip', save.items.length > 0 && !Object.keys(save.equipped).length, infoX, cardY + 156, 'Você ganhou itens: equipe!'],
        ['pets', save.eggs.some(eggReady), infoX + 121, cardY + 156, 'Um ovo está pronto!'],
        ['missions', pending > 0, mx, 54, 'Recompensas para resgatar!'],
      ];
      const tip = tips.find(([id, when]) => when && !save.tips.includes(id));
      if (tip) this.tipBubble(tip[2], tip[3], tip[4], true);
    }

    this.monsterParade(wide ? height - 70 : cardY + 210, height - 40);
    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
  }

  /** Balão de dica apontando para um botão (abaixo dele, se `below`), pulando de leve. */
  private tipBubble(x: number, y: number, msg: string, below: boolean) {
    const by = below ? y + 40 : y - 42;
    const bx = Phaser.Math.Clamp(x, 90, VIEW.width - 90);
    const c = this.add.container(bx, by).setDepth(1e6);
    const t = text(this, 0, 0, msg, 11, '#2a1206', { bold: true, strokeThickness: 0 });
    const w = t.width + 20;
    const g = this.add.graphics();
    g.fillStyle(0xffe9a0, 1).fillRoundedRect(-w / 2, -13, w, 26, 10).lineStyle(2, 0x2a1206, 1).strokeRoundedRect(-w / 2, -13, w, 26, 10);
    const tip = x - bx;
    if (below) g.fillStyle(0xffe9a0, 1).fillTriangle(tip - 7, -12, tip + 7, -12, tip, -22);
    else g.fillStyle(0xffe9a0, 1).fillTriangle(tip - 7, 12, tip + 7, 12, tip, 22);
    c.add([g, t]);
    this.tweens.add({ targets: c, y: by + (below ? 4 : -4), duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** Marca a dica como vista (ao tocar no botão que ela aponta). */
  private seeTip(id: string) {
    const s = loadSave();
    if (!s.tips.includes(id)) s.tips.push(id);
    writeSave(s);
  }

  /** Monstros atravessando a parte de baixo da tela: dá vida à abertura. */
  private monsterParade(top: number, bottom: number) {
    const { width } = VIEW;
    const kinds: [string, number][] = [['slime', 22], ['goblin', 30], ['wolf', 46], ['bat', 40], ['skeleton', 26], ['slime', 20]];
    kinds.forEach(([key, speed], i) => {
      const y = top + ((i * 37) % Math.max(1, bottom - top));
      const dir = i % 2 === 0 ? 1 : -1;
      const m = this.add.image(30 + ((i * 131) % (width - 60)), y, key, 0).setOrigin(0.5, 1).setFlipX(dir < 0).setDepth(y);
      this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
        m.x += (dir * speed * dt) / 1000;
        const pose = walkPose(key, this.time.now / 1000 + i);
        m.setFrame(slotsOf(key)[pose.slot] ?? 0).setScale(1.5 * pose.sx, 1.5 * pose.sy).setRotation(dir < 0 ? -pose.rot : pose.rot);
        // na horizontal atravessam a tela inteira
        if (dir > 0 && m.x > width + VIEW.bleed + 60) m.x = -VIEW.bleed - 60;
        if (dir < 0 && m.x < -VIEW.bleed - 60) m.x = width + VIEW.bleed + 60;
      });
    });
  }

  private startGame() {
    const save = loadSave();
    const c = CHARACTERS[this.index];
    if (!save.unlocked.includes(c.id)) return;
    unlockAudio();
    sfx('select');
    this.cameras.main.fadeOut(220, 11, 10, 20);
    // escolha da fase no mapa-múndi
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Stages'));
  }
}

export class ShopScene extends Phaser.Scene {
  private scrollY = 0;
  private dragged = false;
  /** aba aberta (fica guardada ao comprar e voltar) */
  private static tab: MetaCategory = 'ataque';

  constructor() {
    super('Shop');
  }

  create() {
    setupCamera(this);
    const { width, height } = VIEW;
    const save = loadSave();
    menuBackground(this, 0.55);
    goldPill(this, save.gold);
    goldTitle(this, width / 2, 62, 'MELHORIAS', 30);
    text(this, width / 2, 88, 'Permanentes para todas as partidas, sem limite', 11, '#c8cce0');

    // abas por categoria, com o total de níveis comprados em cada uma
    const tabW = (Math.min(width, 520) - 20) / META_CATEGORIES.length;
    const tabsX = width / 2 - (tabW * META_CATEGORIES.length) / 2;
    META_CATEGORIES.forEach((c, i) => {
      const on = ShopScene.tab === c.id;
      const x = tabsX + tabW * i + tabW / 2;
      const levels = META_UPGRADES.filter((d) => d.category === c.id).reduce((a, d) => a + (save.meta[d.id] ?? 0), 0);
      const affordable = META_UPGRADES.some((d) => d.category === c.id && save.gold >= metaCost(d, save.meta[d.id] ?? 0));
      const tab = this.add.container(x, 124);
      const g = this.add.graphics();
      g.fillStyle(on ? c.color : 0x1c1a2c, on ? 1 : 0.85).fillRoundedRect(-tabW / 2 + 3, -22, tabW - 6, 44, 10);
      g.lineStyle(2, c.color, on ? 1 : 0.6).strokeRoundedRect(-tabW / 2 + 3, -22, tabW - 6, 44, 10);
      tab.add(g);
      tab.add(this.add.image(0, -7, c.icon).setScale(1.1));
      tab.add(this.add.text(0, 12, c.name, { fontFamily: FONT, fontSize: px(10), fontStyle: 'bold', color: on ? '#14101e' : '#e8ecff' }).setOrigin(0.5));
      if (levels) tab.add(this.add.text(tabW / 2 - 8, -17, String(levels), { fontFamily: FONT, fontSize: px(9), fontStyle: 'bold', color: on ? '#14101e' : '#ffd86a' }).setOrigin(1, 0));
      // pontinho: tem melhoria que dá para comprar nesta aba
      if (affordable && !on) tab.add(this.add.circle(-tabW / 2 + 12, -14, 4, 0x8cf08a));
      tab.setSize(tabW - 6, 44).setInteractive({ useHandCursor: true });
      tab.on('pointerup', () => {
        if (on) return;
        sfx('select');
        ShopScene.tab = c.id;
        this.scrollY = 0;
        this.scene.restart();
      });
    });
    const cat = META_CATEGORIES.find((c) => c.id === ShopScene.tab)!;
    text(this, width / 2, 160, cat.blurb, 11, '#c8cce0');

    const top = 176;
    const bottom = height - 64;
    const rowH = 66;
    const defs = META_UPGRADES.filter((d) => d.category === ShopScene.tab);
    const list = this.add.container(0, top);
    defs.forEach((def, i) => {
      const lvl = save.meta[def.id] ?? 0;
      const cost = metaCost(def, lvl);
      const y = i * rowH + rowH / 2;
      const can = save.gold >= cost;
      const row = this.add.container(0, y);
      row.add(panel(this, width / 2, 0, width - 20, rowH - 8, 'ui_panel'));
      row.add(panel(this, 40, 0, 42, 42, 'ui_slot'));
      row.add(this.add.image(40, 0, def.icon).setScale(1.7));
      row.add(this.add.text(70, -14, def.name, { fontFamily: FONT, fontSize: px(14), fontStyle: 'bold', color: '#f4f4f4' }).setOrigin(0, 0.5));
      row.add(this.add.text(70, 3, def.description, { fontFamily: FONT, fontSize: px(11), color: '#b8bdd8' }).setOrigin(0, 0.5));
      row.add(this.add.text(70, 19, `Nível ${lvl}`, { fontFamily: FONT, fontSize: px(11), fontStyle: 'bold', color: lvl > 0 ? '#ffd86a' : '#6a6e88' }).setOrigin(0, 0.5));
      row.add(button(this, width - 62, 0, formatNumber(cost), () => {
        if (this.dragged || !can) return;
        save.gold -= cost;
        save.meta[def.id] = lvl + 1;
        writeSave(save);
        sfx('levelup');
        this.scene.restart();
      }, { width: 84, height: 34, size: 13, variant: 'primary', disabled: !can, icon: 'coin' }));
      list.add(row);
    });

    const maskShape = this.make.graphics({}, false).fillRect(0, top - 2, width, bottom - top + 4);
    list.setMask(maskShape.createGeometryMask());
    const contentH = defs.length * rowH;
    const minY = Math.min(0, bottom - top - contentH);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, minY, 0);
    list.y = top + this.scrollY;

    let startY = 0;
    let startScroll = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      startY = pointerPos(this, p).y;
      startScroll = this.scrollY;
      this.dragged = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const dy = pointerPos(this, p).y - startY;
      if (Math.abs(dy) > 6) this.dragged = true;
      this.scrollY = Phaser.Math.Clamp(startScroll + dy, minY, 0);
      list.y = top + this.scrollY;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.5, minY, 0);
      list.y = top + this.scrollY;
    });

    button(this, width / 2, height - 32, 'VOLTAR', () => {
      sfx('select');
      this.scrollY = 0;
      this.scene.start('Menu');
    }, { width: 180, height: 38, size: 14 });
  }
}
