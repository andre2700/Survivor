import Phaser from 'phaser';
import { frameHd, frameName } from '../art/textures';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { STAGES, stageUnlocked, type Mood, type RunEventId, type StageDef } from '../data/stages';
import { getCharacter } from '../data/characters';
import { dev } from '../systems/dev';
import { loadSave, writeSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import { FONT, button, goldTitle, panel, px, starIcon, text } from '../ui/theme';
import { VIEW, WIDE_COL, col, isWide, pointerPos, setupCamera } from '../ui/view';

/** Altura do painel da fase (em pé). */
const PANEL_H = 292;

/** Cor da etiqueta de clima. */
const MOOD_CHIP: Record<Mood, number> = { leve: 0x9be28a, sério: 0xf0c060, sombrio: 0x9aa8e8, épico: 0xff7a6a };

/** Ícone de cada mistério (evento) no painel. */
const EVENT_ICON: Record<RunEventId, [string, number?]> = {
  chest: ['chest'], captive: ['hero_ranger'], surpriseBoss: ['icon_skull', 0xff7a6a], goldenGoblin: ['goblin', 0xffd84a],
  meteors: ['fx_fireball'], ambush: ['icon_skull'],
};

/** Ajusta a imagem para caber em w × h (tamanho lógico, descontando a resolução alta da arte). */
function fit(img: Phaser.GameObjects.Image, w: number, h: number) {
  const hd = frameHd(img);
  img.setScale(Math.min((w * hd) / img.width, (h * hd) / img.height));
}

/** Inimigos da fase, na ordem em que aparecem (sem o chefe). */
function stageFoes(st: StageDef): EnemyId[] {
  const out: EnemyId[] = [];
  for (const w of st.waves) for (const id of w.pool) if (!out.includes(id) && !ENEMIES[id].boss) out.push(id);
  return out;
}

/** Distância vertical entre as fases na trilha. */
const STEP = 118;

/** Cor do céu em cada clima: o mapa escurece de baixo (leve) para cima (épico). */
const MOOD_SKY: Record<Mood, number> = { leve: 0x3f8a4a, sério: 0x7a6a3a, sombrio: 0x2c3460, épico: 0x4a1418 };

/** Decoração em volta de cada fase no mapa (a arte que já existe, tingida para o bioma). */
const REGION_DECOR: Record<string, [string, number][]> = {
  clareira: [['tree', 0xffffff], ['flowers', 0xffffff], ['bush', 0xffffff]],
  outono: [['tree2', 0xffb070], ['mushroom', 0xffffff], ['stump', 0xffc080]],
  pantano: [['tallgrass', 0x7fc0a0], ['mushroom', 0xa0d0c0], ['rock', 0x90b0a0]],
  dunas: [['rock', 0xf0c880], ['rock', 0xe0b070], ['stump', 0xe8c890]],
  sombria: [['tree', 0x6070a0], ['tree2', 0x5a6890], ['mushroom', 0x9080c0]],
  pico: [['rock', 0xe0f0ff], ['tree2', 0xc8e8ff], ['rock', 0xb0d0f0]],
  vulcao: [['rock', 0xff7050], ['rock', 0xc04030], ['stump', 0x803020]],
  ruinas: [['rock', 0xa090c0], ['stump', 0x8070a0], ['tree', 0x605070]],
  cidadela: [['rock', 0xd04040], ['rock', 0x802020], ['tree2', 0x502020]],
};

/**
 * Mapa-múndi: uma trilha que sobe da Clareira até a Cidadela. Toque numa fase para ver os detalhes;
 * arraste para rolar. Fases bloqueadas ficam apagadas; as liberadas sem arte aparecem como "em breve".
 */
export class StageScene extends Phaser.Scene {
  private selected = 0;
  private scrollY = 0;

  constructor() {
    super('Stages');
  }

  create() {
    setupCamera(this);
    const { width, height } = VIEW;
    const save = loadSave();
    const wide = isWide();
    const unlocked = STAGES.map((_, i) => stageUnlocked(i, save.stars, dev.allStages));
    this.selected = Math.max(0, STAGES.findIndex((s) => s.id === save.stage));
    if (!unlocked[this.selected]) this.selected = 0;

    // céu em faixas, do clima leve (embaixo) ao épico (em cima)
    const mapX = wide ? col(-1) : width / 2;
    const panelH = wide ? 0 : PANEL_H + 14;
    const viewH = height - panelH;
    const total = STEP * (STAGES.length - 1) + 160;
    const map = this.add.container(0, 0);
    const sky = this.add.graphics();
    map.add(sky);
    for (let i = 0; i < STAGES.length; i++) {
      const y0 = this.nodeY(i, viewH) - STEP / 2;
      const c0 = MOOD_SKY[STAGES[i].mood];
      const c1 = MOOD_SKY[(STAGES[i + 1] ?? STAGES[i]).mood];
      sky.fillGradientStyle(c1, c1, c0, c0, 1).fillRect(-VIEW.bleed, y0 - STEP, VIEW.screenWidth, STEP + 1);
    }
    sky.fillStyle(MOOD_SKY.leve, 1).fillRect(-VIEW.bleed, this.nodeY(0, viewH) - STEP / 2, VIEW.screenWidth, 400);
    sky.fillStyle(MOOD_SKY.épico, 1).fillRect(-VIEW.bleed, this.nodeY(STAGES.length - 1, viewH) - STEP * 1.5 - 400, VIEW.screenWidth, 400);

    // trilha pontilhada entre as fases
    const path = this.add.graphics();
    map.add(path);
    for (let i = 0; i < STAGES.length - 1; i++) {
      const a = this.nodePos(i, mapX, viewH);
      const b = this.nodePos(i + 1, mapX, viewH);
      const open = unlocked[i + 1];
      for (let k = 1; k < 12; k++) {
        const t = k / 12;
        // curva suave entre os pontos
        const x = a.x + (b.x - a.x) * t + Math.sin(t * Math.PI) * (i % 2 ? 26 : -26);
        const y = a.y + (b.y - a.y) * t;
        path.fillStyle(open ? 0xfff2c0 : 0x0b0a14, open ? 0.9 : 0.45).fillCircle(x, y, open ? 3 : 2.5);
      }
    }

    // fases
    STAGES.forEach((st, i) => {
      const { x, y } = this.nodePos(i, mapX, viewH);
      for (const [k, [tex, tint]] of (REGION_DECOR[st.id] ?? []).entries()) {
        const side = k % 2 ? 1 : -1;
        const d = this.add.image(x + side * (62 + k * 14), y + 14 - k * 10, 'atlas', frameName(tex)).setOrigin(0.5, 1).setTint(tint)
          .setAlpha(unlocked[i] ? 1 : 0.45).setScale(0.9);
        map.add(d);
      }
      const node = this.add.container(x, y);
      const g = this.add.graphics();
      const on = unlocked[i];
      g.fillStyle(0x0b0a14, 0.5).fillEllipse(0, 22, 58, 14);
      g.fillStyle(on ? st.color : 0x3a3a48, 1).fillCircle(0, 0, 25);
      g.lineStyle(4, on ? 0xfff2c0 : 0x5a5a6a, 1).strokeCircle(0, 0, 25);
      g.fillStyle(0xffffff, on ? 0.25 : 0.08).fillCircle(-7, -8, 9);
      node.add(g);
      if (on) {
        node.add(this.add.text(0, -1, String(i + 1), { fontFamily: '"Lilita One"', fontSize: px(22), color: '#ffffff', stroke: '#14101e', strokeThickness: 4 }).setOrigin(0.5));
      } else {
        node.add(this.padlock());
      }
      // estrelas conquistadas
      const stars = save.stars[st.id] ?? [];
      for (let k = 0; k < 3; k++) node.add(this.star(-16 + k * 16, 34, 7, !!stars[k], on));
      node.add(this.add.text(0, 52, st.name, {
        fontFamily: FONT, fontSize: px(11), fontStyle: 'bold', color: on ? '#ffffff' : '#8a8ca0', stroke: '#14101e', strokeThickness: 3,
      }).setOrigin(0.5, 0));
      if (on && !st.playable) node.add(this.add.text(0, 66, 'em breve', { fontFamily: FONT, fontSize: px(10), color: '#ffd86a' }).setOrigin(0.5, 0));
      node.setSize(64, 64).setInteractive({ useHandCursor: true });
      node.on('pointerup', () => {
        if (this.dragged) return;
        sfx('select');
        this.selected = i;
        this.renderPanel(unlocked);
      });
      if (i === this.selected) {
        const ring = this.add.image(0, 0, 'atlas', frameName('aura')).setTint(0xfff2c0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.75);
        node.addAt(ring, 0);
        this.tweens.add({ targets: ring, scale: 0.9, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });
      }
      map.add(node);
    });

    // o herói escolhido em pé sobre a fase selecionada
    const sel = this.nodePos(this.selected, mapX, viewH);
    const heroTex = getCharacter(save.selected).texture;
    const hero = this.add.image(sel.x + 30, sel.y - 4, 'atlas', frameName(heroTex, 0)).setOrigin(0.5, 1).setScale(0.8);
    map.add(hero);
    this.tweens.add({ targets: hero, y: sel.y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // nuvens passando sobre o mapa
    const clouds = Array.from({ length: 7 }, (_, i) => {
      const c = this.add.image(Math.random() * VIEW.screenWidth - VIEW.bleed, this.nodeY(0, viewH) - i * (total / 7), 'atlas', frameName('glow'))
        .setTint(0xffffff).setAlpha(0.14).setScale(4 + Math.random() * 3, 1.6 + Math.random());
      map.add(c);
      return { c, v: 6 + Math.random() * 10 };
    });
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dtMs: number) => {
      for (const k of clouds) {
        k.c.x += (k.v * dtMs) / 1000;
        if (k.c.x > VIEW.width + VIEW.bleed + 120) k.c.x = -VIEW.bleed - 120;
      }
    });

    // rolagem: começa mostrando a fase escolhida
    const minY = 0;
    const maxY = Math.max(0, total - viewH);
    this.scrollY = Phaser.Math.Clamp(this.selected * STEP - viewH * 0.35, minY, maxY);
    map.y = this.scrollY;
    let startY = 0;
    let start = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      startY = pointerPos(this, p).y;
      start = this.scrollY;
      this.dragged = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const dy = pointerPos(this, p).y - startY;
      if (Math.abs(dy) > 6) this.dragged = true;
      this.scrollY = Phaser.Math.Clamp(start + dy, minY, maxY);
      map.y = this.scrollY;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.5, minY, maxY);
      map.y = this.scrollY;
    });

    this.add.image(-VIEW.bleed, 0, 'vignette').setOrigin(0).setDisplaySize(VIEW.screenWidth, height).setAlpha(0.6).setDepth(4);
    goldTitle(this, wide ? col(1) : width / 2, 30, 'MAPA DO MUNDO', 26).setDepth(5);
    this.renderPanel(unlocked);
  }

  private dragged = false;
  private panelObjs: Phaser.GameObjects.GameObject[] = [];

  /** Altura de cada fase: a 1ª embaixo, subindo. */
  private nodeY(i: number, viewH: number) {
    return viewH - 70 - i * STEP;
  }

  private nodePos(i: number, cx: number, viewH: number) {
    return { x: cx + Math.sin(i * 1.3) * 84, y: this.nodeY(i, viewH) };
  }

  private star(x: number, y: number, r: number, filled: boolean, on = true) {
    return starIcon(this, x, y, r, filled, on);
  }

  private padlock() {
    const g = this.add.graphics();
    g.lineStyle(3, 0x8a8ca0, 1).beginPath().arc(0, -4, 6, Math.PI, 0).strokePath();
    g.fillStyle(0x8a8ca0, 1).fillRoundedRect(-9, -4, 18, 13, 3);
    g.fillStyle(0x3a3a48, 1).fillCircle(0, 2, 2.5);
    return g;
  }

  /** Painel da fase escolhida: clima, inimigos, chefe, mistérios, perigos, itens, objetivos e o botão de jogar. */
  private renderPanel(unlocked: boolean[]) {
    this.panelObjs.forEach((o) => o.destroy());
    this.panelObjs = [];
    const { width, height } = VIEW;
    const wide = isWide();
    const st: StageDef = STAGES[this.selected];
    const save = loadSave();
    const stars = save.stars[st.id] ?? [];
    const on = unlocked[this.selected];
    const known = on && st.playable;
    const cx = wide ? col(1) : width / 2;
    const pw = wide ? WIDE_COL : width - 20;
    const ph = wide ? Math.min(height - 64, 372) : PANEL_H;
    const top = wide ? Math.max(52, (height - ph) / 2 + 22) : height - ph - 6;
    const left = cx - pw / 2;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.panelObjs.push(o);
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(10);
      return o;
    };
    add(panel(this, cx, top + ph / 2, pw, ph, 'ui_panel_dark'));
    // cabeçalho: nome, clima e elementos
    add(text(this, left + 14, top + 18, on ? st.name : '???', 17, '#ffd86a', { bold: true, strokeThickness: 4 }).setOrigin(0, 0.5));
    add(this.add.text(cx + pw / 2 - 14, top + 18, st.mood.toUpperCase(), {
      fontFamily: FONT, fontSize: px(10), fontStyle: 'bold', color: '#14101e', backgroundColor: `#${MOOD_CHIP[st.mood].toString(16).padStart(6, '0')}`, padding: { x: 6, y: 2 },
    }).setOrigin(1, 0.5));
    add(text(this, left + 14, top + 38, on ? `${st.subtitle} · ${st.elements}` : 'Vença a fase anterior para liberar', 10, '#c8cce0').setOrigin(0, 0.5)
      .setWordWrapWidth(pw - 28));

    // chefe: silhueta com "?" até ser vencido
    const bossX = cx + pw / 2 - 46;
    const bossY = top + 98;
    add(panel(this, bossX, bossY, 72, 80, 'ui_slot'));
    add(this.add.text(bossX, bossY - 32, 'CHEFE', { fontFamily: FONT, fontSize: px(9), fontStyle: 'bold', color: '#ff9a7a' }).setOrigin(0.5));
    const bossDef = ENEMIES[st.boss];
    const beaten = !!stars[0];
    if (known) {
      const b = add(this.add.image(bossX, bossY + 34, 'atlas', frameName(bossDef.texture, 0)).setOrigin(0.5, 1));
      fit(b, 60, 60);
      if (!beaten) b.setTintFill(0x0b0a14).setAlpha(0.85);
      this.tweens.add({ targets: b, y: bossY + 32, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      if (!beaten) add(this.add.text(bossX, bossY - 4, '?', { fontFamily: '"Lilita One"', fontSize: px(26), color: '#ff9a7a', stroke: '#14101e', strokeThickness: 4 }).setOrigin(0.5));
      else add(this.add.text(bossX, bossY + 42, bossDef.name, { fontFamily: FONT, fontSize: px(8), color: '#ffe9a0' }).setOrigin(0.5, 0));
    } else {
      add(this.add.text(bossX, bossY, '?', { fontFamily: '"Lilita One"', fontSize: px(26), color: '#6a6c80' }).setOrigin(0.5));
    }

    // inimigos da fase (silhuetas enquanto a fase está bloqueada)
    const rowW = pw - 110;
    add(this.add.text(left + 14, top + 58, 'INIMIGOS', { fontFamily: FONT, fontSize: px(9), fontStyle: 'bold', color: '#8cc8ff' }).setOrigin(0, 0.5));
    const foes = stageFoes(st).slice(0, 8);
    const cell = Math.min(34, rowW / Math.max(1, foes.length));
    foes.forEach((id, k) => {
      const def = ENEMIES[id];
      const fx = left + 14 + cell * k + cell / 2;
      const img = add(this.add.image(fx, top + 96, 'atlas', frameName(def.texture, 0)).setOrigin(0.5, 1));
      fit(img, cell - 4, 28);
      if (!known) img.setTintFill(0x14101e).setAlpha(0.7);
      this.tweens.add({ targets: img, y: top + 94, duration: 500 + k * 70, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    });

    // mistérios: eventos já encontrados aparecem; os outros, "?"
    const seen = save.seen[st.id] ?? [];
    add(this.add.text(left + 14, top + 114, 'MISTÉRIOS', { fontFamily: FONT, fontSize: px(9), fontStyle: 'bold', color: '#d6a6ff' }).setOrigin(0, 0.5));
    st.events.forEach((ev, k) => {
      const ex = left + 22 + k * 26;
      const ey = top + 134;
      add(this.add.circle(ex, ey, 11, 0x14101e, 0.8).setStrokeStyle(1.5, known && seen.includes(ev) ? 0xd6a6ff : 0x4a4a5a));
      if (known && seen.includes(ev)) {
        const [tex, tint] = EVENT_ICON[ev];
        const ic = add(this.add.image(ex, ey, 'atlas', frameName(tex, 0)));
        fit(ic, 18, 18);
        if (tint) ic.setTint(tint);
      } else {
        add(this.add.text(ex, ey, '?', { fontFamily: '"Lilita One"', fontSize: px(12), color: '#8a8ca0' }).setOrigin(0.5));
      }
    });

    // perigos e itens do mapa
    const hazard = st.hazard === 'fog' ? 'névoa e lama' : '—';
    add(this.add.text(left + 14, top + 158, `Perigos: ${known ? hazard : '?'}`, { fontFamily: FONT, fontSize: px(10), color: '#ffb08a' }).setOrigin(0, 0.5));
    add(this.add.text(cx + 10, top + 158, 'Itens:', { fontFamily: FONT, fontSize: px(10), color: '#a0e8a0' }).setOrigin(0, 0.5));
    ['icon_magnet', 'bomb', 'heart'].forEach((tex, k) => {
      const ic = add(this.add.image(cx + 48 + k * 20, top + 158, 'atlas', frameName(tex, 0)));
      fit(ic, 14, 14);
    });

    // objetivos (estrelas)
    st.objectives.forEach((o, k) => {
      const y = top + 182 + k * 20;
      add(this.star(left + 22, y, 7, !!stars[k], on));
      add(this.add.text(left + 36, y, known ? o.text : '—', { fontFamily: FONT, fontSize: px(11), color: stars[k] ? '#ffe9a0' : '#dfe3f5' }).setOrigin(0, 0.5));
    });

    const can = on && st.playable;
    const bw = (pw - 36) / 2;
    add(button(this, cx - bw / 2 - 6, top + ph - 26, 'VOLTAR', () => {
      sfx('select');
      this.scene.start('Menu');
    }, { width: bw, height: 36, size: 14 }));
    add(button(this, cx + bw / 2 + 6, top + ph - 26, can ? 'JOGAR' : on ? 'EM BREVE' : 'BLOQUEADA', () => {
      if (!can) return;
      sfx('select');
      const s = loadSave();
      s.stage = st.id;
      writeSave(s);
      this.cameras.main.fadeOut(220, 11, 10, 20);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
    }, { width: bw, height: 36, size: 15, variant: can ? 'primary' : 'normal', disabled: !can }));
  }
}
