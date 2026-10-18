import Phaser from 'phaser';
import { frameName } from '../art/textures';
import { STAGES, stageUnlocked, type Mood, type StageDef } from '../data/stages';
import { dev } from '../systems/dev';
import { loadSave, writeSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import { FONT, button, goldTitle, panel, px, starIcon, text } from '../ui/theme';
import { VIEW, WIDE_COL, col, isWide, pointerPos, setupCamera } from '../ui/view';

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
    const panelH = wide ? 0 : 214;
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

  /** Painel da fase escolhida: nome, clima, elementos, objetivos e o botão de jogar. */
  private renderPanel(unlocked: boolean[]) {
    this.panelObjs.forEach((o) => o.destroy());
    this.panelObjs = [];
    const { width, height } = VIEW;
    const wide = isWide();
    const st: StageDef = STAGES[this.selected];
    const save = loadSave();
    const stars = save.stars[st.id] ?? [];
    const on = unlocked[this.selected];
    const cx = wide ? col(1) : width / 2;
    const pw = wide ? WIDE_COL : width - 20;
    const ph = 200;
    const top = wide ? Math.max(56, (height - ph) / 2 + 20) : height - ph - 6;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.panelObjs.push(o);
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(10);
      return o;
    };
    add(panel(this, cx, top + ph / 2, pw, ph, 'ui_panel_dark'));
    add(text(this, cx, top + 20, on ? st.name : '???', 18, '#ffd86a', { bold: true, strokeThickness: 4 }));
    add(text(this, cx, top + 42, on ? `${st.subtitle} · ${st.elements}` : 'Vença a fase anterior para liberar', 11, '#c8cce0'));
    st.objectives.forEach((o, k) => {
      const y = top + 70 + k * 24;
      add(this.star(cx - pw / 2 + 26, y, 8, !!stars[k], on));
      const t = this.add.text(cx - pw / 2 + 42, y, on && st.playable ? o.text : '—', { fontFamily: FONT, fontSize: px(12), color: stars[k] ? '#ffe9a0' : '#dfe3f5' }).setOrigin(0, 0.5);
      add(t);
    });
    const can = on && st.playable;
    const bw = (pw - 36) / 2;
    add(button(this, cx - bw / 2 - 6, top + ph - 30, 'VOLTAR', () => {
      sfx('select');
      this.scene.start('Menu');
    }, { width: bw, height: 38, size: 14 }));
    add(button(this, cx + bw / 2 + 6, top + ph - 30, can ? 'JOGAR' : on ? 'EM BREVE' : 'BLOQUEADA', () => {
      if (!can) return;
      sfx('select');
      const s = loadSave();
      s.stage = st.id;
      writeSave(s);
      this.cameras.main.fadeOut(220, 11, 10, 20);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
    }, { width: bw, height: 38, size: 15, variant: can ? 'primary' : 'normal', disabled: !can }));
  }
}
