import Phaser from 'phaser';
import { walkPose } from '../art/motion';
import { frameHd, frameName, groundSprite, slotsOf } from '../art/textures';
import { maxTier, tierColor, tierName, tierUnlocked, type TierProgress } from '../data/difficulty';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { BOSS_STAGES, STAGES, stageUnlocked, type RunEventId, type StageDef } from '../data/stages';
import { dev } from '../systems/dev';
import { loadSave, writeSave, type SaveData } from '../systems/save';
import { sfx } from '../systems/sfx';
import { FONT, button, goldTitle, panel, px, starIcon, text } from '../ui/theme';
import { VIEW, WIDE_COL, col, isWide, pointerPos, setupCamera } from '../ui/view';

/** Cor da etiqueta de clima. */

/** Ícone de cada mistério (evento) no painel. */
const EVENT_ICON: Record<RunEventId, [string, number?]> = {
  chest: ['chest'], captive: ['hero_ranger'], surpriseBoss: ['icon_skull', 0xff7a6a], goldenGoblin: ['goblin', 0xffd84a],
  meteors: ['fx_fireball'], ambush: ['icon_skull'], tribeWar: ['scorpion'], sandstorm: ['icon_tornado', 0xe8c070],
  cursedShrine: ['cursed_shrine'], bloodMoon: ['glow', 0xd02030], blizzard: ['snowdrift'], avalanche: ['snow_rock', 0xe8f4ff],
  eruption: ['lava_vent'], lavaRiver: ['lava_pool'],
  procession: ['lost_soul'], cursedBell: ['cursed_bell'], treasureRoom: ['chest', 0xffd86a],
  echoes: ['demon', 0x8a6ac8], hellRain: ['fx_fireball', 0xff4a3a], abyssPortal: ['demon_portal'],
};

/** Ajusta a imagem para caber em w × h (tamanho lógico, descontando a resolução alta da arte). */
function fit(img: Phaser.GameObjects.Image, w: number, h: number) {
  const hd = frameHd(img);
  img.setScale(Math.min((w * hd) / img.width, (h * hd) / img.height));
  return img;
}

/** Inimigos da fase, na ordem em que aparecem (sem os chefes). */
function stageFoes(st: StageDef): EnemyId[] {
  const out: EnemyId[] = [];
  for (const w of st.waves) for (const id of w.pool) if (!out.includes(id) && !ENEMIES[id].boss) out.push(id);
  return out;
}

/** Gerador pseudoaleatório com semente (a página de cada fase sempre igual). */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Fase em que o menu abre: a primeira liberada ainda não vencida (no Normal). */
function nextStageIndex(save: SaveData) {
  const open = STAGES.map((_, i) => stageUnlocked(i, save.tiers, dev.allStages));
  const next = STAGES.findIndex((s, i) => open[i] && s.playable && !save.tiers[s.id]?.[0]?.stars[0]);
  if (next >= 0) return next;
  const last = STAGES.findIndex((s) => s.id === save.stage);
  return Math.max(0, last);
}

/** Criatura andando no cenário da fase. */
interface Walker {
  img: Phaser.GameObjects.Image;
  kind: string;
  texture: string;
  slots: Record<string, number>;
  vx: number;
  vy: number;
  phase: number;
}

/**
 * Seleção de fase: uma fase por página, aberta na próxima fase a vencer. O fundo é a própria fase
 * (chão, decoração e as criaturas dela andando); embaixo, dificuldade, chefes, mistérios, perigos,
 * itens e objetivos. Setas (ou arrastar para o lado) trocam de fase. Fases bloqueadas só mostram
 * um vislumbre: nome, clima e o que falta para liberar.
 */
export class StageScene extends Phaser.Scene {
  private index = 0;
  private page: Phaser.GameObjects.GameObject[] = [];
  private walkers: Walker[] = [];
  private area = new Phaser.Geom.Rectangle();

  constructor() {
    super('Stages');
  }

  create() {
    setupCamera(this);
    const save = loadSave();
    this.index = nextStageIndex(save);
    this.render();
    this.events.on(Phaser.Scenes.Events.UPDATE, (t: number, dt: number) => this.walk(t / 1000, dt / 1000));
    // arrastar para o lado troca de fase
    let sx = 0;
    let sy = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const q = pointerPos(this, p);
      sx = q.x;
      sy = q.y;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const q = pointerPos(this, p);
      if (Math.abs(q.x - sx) > 60 && Math.abs(q.x - sx) > Math.abs(q.y - sy) * 1.5) this.go(q.x < sx ? 1 : -1);
    });
    this.input.keyboard?.on('keydown-LEFT', () => this.go(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.go(1));
  }

  private go(dir: number) {
    const i = Phaser.Math.Clamp(this.index + dir, 0, STAGES.length - 1);
    if (i === this.index) return;
    sfx('select');
    this.index = i;
    this.cameras.main.fadeOut(110, 11, 10, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.render();
      this.cameras.main.fadeIn(140, 11, 10, 20);
    });
  }

  private add$<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.page.push(o);
    return o;
  }

  private render() {
    this.page.forEach((o) => o.destroy());
    this.page = [];
    this.walkers = [];
    const { width, height } = VIEW;
    const save = loadSave();
    const st = STAGES[this.index];
    const open = stageUnlocked(this.index, save.tiers, dev.allStages);
    const known = open && st.playable;
    const wide = isWide();
    const W = VIEW.screenWidth;
    const left = -VIEW.bleed;
    // área do cenário: em pé, a parte de cima; deitado, a coluna da esquerda
    const panelH = wide ? 0 : 372;
    this.area.setTo(left, 0, wide ? col(1) - WIDE_COL / 2 - 8 - left : W, height - panelH + 30);

    // ---------- o cenário da fase ----------
    const ground = this.add$(groundSprite(this, left, 0, W, height, known ? st.ground ?? 'ground' : st.ground && this.textures.exists(st.ground) ? st.ground : 'ground').setOrigin(0));
    ground.setTint(known ? st.tint.ground : 0x2a2a3a);
    const rnd = seeded(this.index * 977 + 13);
    const a = this.area;
    if (known) {
      const decor = Object.entries(st.decor);
      const total = decor.reduce((s, [, w]) => s + w, 0);
      for (let k = 0; k < 26; k++) {
        let r = rnd() * total;
        const tex = (decor.find(([, w]) => (r -= w) < 0) ?? decor[0])[0];
        const x = a.x + rnd() * a.width;
        const y = 60 + rnd() * (a.height - 40);
        this.add$(this.add.image(x, y, 'atlas', frameName(tex)).setOrigin(0.5, 0.9).setTint(st.tint.decor).setDepth(y));
      }
      for (const p of st.patches ?? []) {
        const x = a.x + rnd() * a.width;
        const y = 120 + rnd() * (a.height - 160);
        this.add$(this.add.image(x, y, 'atlas', frameName(p)).setTint(st.tint.decor).setDepth(-1));
      }
      // as criaturas da fase andando por ali
      stageFoes(st).slice(0, 9).forEach((id, k) => {
        const def = ENEMIES[id];
        const x = a.x + 30 + rnd() * (a.width - 60);
        const y = 130 + rnd() * (a.height - 170);
        const img = this.add$(this.add.image(x, y, 'atlas', frameName(def.texture, 0)).setOrigin(0.5, 0.65).setDepth(y));
        fit(img, 40, 40);
        const ang = rnd() * Math.PI * 2;
        this.walkers.push({ img, kind: def.kind, texture: def.texture, slots: slotsOf(def.texture), vx: Math.cos(ang) * 14, vy: Math.sin(ang) * 9, phase: k });
      });
      if (st.hazard === 'dark' || st.hazard === 'fog') {
        const veil = this.add$(this.add.graphics().setDepth(5000));
        veil.fillStyle(st.hazard === 'dark' ? 0x080614 : 0xd6e6dc, st.hazard === 'dark' ? 0.35 : 0.18).fillRect(left, 0, W, height);
      }
    } else {
      // vislumbre: neblina escura, um cadeado grande e só o nome da fase
      for (let k = 0; k < 8; k++) {
        this.add$(this.add.image(a.x + rnd() * a.width, 80 + rnd() * a.height, 'atlas', frameName('glow')).setTint(0x8a8ca8).setAlpha(0.12).setScale(4 + rnd() * 3).setDepth(4000));
      }
      const lock = this.add$(this.padlock(a.centerX, a.y + a.height * 0.5, 3).setDepth(4500));
      this.tweens.add({ targets: lock, y: lock.y - 6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    this.add$(this.add.image(left, 0, 'vignette').setOrigin(0).setDisplaySize(W, height).setAlpha(0.7).setDepth(6000));

    // ---------- título ----------
    const tx = wide ? col(-1) : width / 2;
    this.add$(text(this, tx, 22, `FASE ${this.index + 1} DE ${STAGES.length}`, 11, '#c8cce0', { bold: true, strokeThickness: 3 }).setDepth(7000));
    this.add$(goldTitle(this, tx, 50, st.name.toUpperCase(), st.name.length > 16 ? 22 : 26).setDepth(7000));
    const sub = known ? `${st.subtitle} · ${st.elements}` : open ? `${st.subtitle} · em breve` : st.subtitle;
    this.add$(text(this, tx, 78, sub, 11, '#e8ecff', { strokeThickness: 3 }).setDepth(7000));
    if (!open) {
      const prev = STAGES[this.index - 1];
      this.add$(text(this, a.centerX, a.y + a.height * 0.5 + 54, `Vença o chefe final de\n${prev?.name ?? ''} para liberar`, 13, '#ffd86a', { bold: true, strokeThickness: 4 })
        .setAlign('center').setDepth(7000));
    }

    // setas de navegação
    const ay = wide ? height / 2 : a.y + a.height * 0.45;
    if (this.index > 0) this.add$(this.arrow(a.x + 26 + VIEW.bleed * 0, ay, -1));
    if (this.index < STAGES.length - 1) this.add$(this.arrow(a.right - 26, ay, 1));

    this.renderPanel(st, save, open, known);
  }

  /** Painel da fase: dificuldade, chefes, mistérios, perigos, itens, objetivos e o botão de jogar. */
  private renderPanel(st: StageDef, save: SaveData, open: boolean, known: boolean) {
    const { width, height } = VIEW;
    const wide = isWide();
    const cx = wide ? col(1) : width / 2;
    const pw = wide ? WIDE_COL : width - 20;
    const ph = wide ? Math.min(height - 24, 380) : 356;
    const top = wide ? (height - ph) / 2 : height - ph - 8;
    const left = cx - pw / 2;
    const D = 8000;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(D);
      return this.add$(o);
    };
    add(panel(this, cx, top + ph / 2, pw, ph, 'ui_panel_dark'));
    const progress: TierProgress[] = save.tiers[st.id] ?? [];
    const tier = Math.min(save.tier[st.id] ?? 0, maxTier(progress));
    const tp = progress[tier] ?? { stars: [false, false, false], bosses: 0 };
    const bestBosses = Math.max(0, ...progress.map((p) => p?.bosses ?? 0));

    // dificuldade: ‹ NORMAL ›
    let y = top + 22;
    add(this.add.text(left + 14, y, 'DIFICULDADE', { fontFamily: FONT, fontSize: px(9), fontStyle: 'bold', color: '#c8cce0' }).setOrigin(0, 0.5));
    const chipX = cx + 34;
    const color = `#${tierColor(tier).toString(16).padStart(6, '0')}`;
    add(text(this, chipX, y, known ? tierName(tier).toUpperCase() : '—', 14, color, { bold: true, strokeThickness: 3 }));
    if (known) {
      const setTier = (t: number) => {
        const s = loadSave();
        s.tier[st.id] = t;
        writeSave(s);
        sfx('select');
        this.render();
      };
      if (tier > 0) add(this.smallArrow(chipX - 74, y, -1, () => setTier(tier - 1)));
      if (tierUnlocked(progress, tier + 1)) add(this.smallArrow(chipX + 74, y, 1, () => setTier(tier + 1)));
      else add(this.add.text(chipX + 74, y, '🔒', { fontSize: px(11) }).setOrigin(0.5).setAlpha(0.6));
    }
    y += 16;
    if (known && !tierUnlocked(progress, tier + 1)) {
      add(this.add.text(cx, y, `Vença o chefe final aqui para liberar ${tierName(tier + 1)}`, { fontFamily: FONT, fontSize: px(9), color: '#8a8ca0' }).setOrigin(0.5, 0.5));
    }

    // os três chefes: vencidos aparecem; o próximo, em silhueta; os outros, "?"
    y += 16;
    add(this.add.text(left + 14, y, 'CHEFES', { fontFamily: FONT, fontSize: px(9), fontStyle: 'bold', color: '#ff9a7a' }).setOrigin(0, 0.5));
    add(this.add.text(cx + pw / 2 - 14, y, known ? `${tp.bosses}/3 nesta dificuldade` : '', { fontFamily: FONT, fontSize: px(9), color: '#c8cce0' }).setOrigin(1, 0.5));
    const slotW = (pw - 40) / 3;
    st.bosses.forEach((id, k) => {
      const bx = left + 20 + slotW * k + slotW / 2;
      const by = y + 44;
      add(panel(this, bx, by, slotW - 8, 66, 'ui_slot'));
      add(this.add.text(bx, by - 26, BOSS_STAGES[k].toUpperCase(), { fontFamily: FONT, fontSize: px(8), fontStyle: 'bold', color: k === 2 ? '#ff7a6a' : '#ffb08a' }).setOrigin(0.5));
      const def = ENEMIES[id];
      const beaten = known && bestBosses > k;
      const next = known && bestBosses === k;
      if (beaten || next) {
        const img = add(fit(this.add.image(bx, by + 26, 'atlas', frameName(def.texture, 0)).setOrigin(0.5, 1), slotW - 22, 44));
        if (!beaten) img.setTintFill(0x0b0a14).setAlpha(0.85);
        this.tweens.add({ targets: img, y: by + 24, duration: 900 + k * 120, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      if (beaten) add(this.add.text(bx, by + 28, def.name, { fontFamily: FONT, fontSize: px(8), color: '#ffe9a0', stroke: '#14101e', strokeThickness: 3 }).setOrigin(0.5, 0.5));
      else add(this.add.text(bx, by + 2, '?', { fontFamily: '"Lilita One"', fontSize: px(22), color: next ? '#ff9a7a' : '#5a5c70', stroke: '#14101e', strokeThickness: 4 }).setOrigin(0.5));
    });

    // mistérios: eventos já encontrados aparecem; os outros, "?"
    y += 94;
    const seen = save.seen[st.id] ?? [];
    add(this.add.text(left + 14, y, 'MISTÉRIOS', { fontFamily: FONT, fontSize: px(9), fontStyle: 'bold', color: '#d6a6ff' }).setOrigin(0, 0.5));
    // os círculos se apertam para caber na largura do painel (fases com muitos eventos)
    const step = Math.min(26, (pw - 96 - 18) / Math.max(1, st.events.length - 1));
    const er = Math.min(11, step / 2 - 1);
    st.events.forEach((ev, k) => {
      const ex = left + 96 + k * step;
      add(this.add.circle(ex, y, er, 0x14101e, 0.8).setStrokeStyle(1.5, known && seen.includes(ev) ? 0xd6a6ff : 0x4a4a5a));
      if (known && seen.includes(ev)) {
        // a criatura dourada é a da fase
        const [tex, tint] = ev === 'goldenGoblin' ? [ENEMIES[st.golden ?? st.waves[0].pool[0]].texture, 0xffd84a] : EVENT_ICON[ev];
        const ic = add(fit(this.add.image(ex, y, 'atlas', frameName(tex, 0)), er * 1.6, er * 1.6));
        if (tint) ic.setTint(tint);
      } else {
        add(this.add.text(ex, y, '?', { fontFamily: '"Lilita One"', fontSize: px(12), color: '#8a8ca0' }).setOrigin(0.5));
      }
    });

    // perigos e tesouros
    y += 26;
    const hazard = st.hazard === 'fog' ? 'névoa e lama' : st.hazard === 'dark' ? 'escuridão, teias e árvores bravas' : st.hazard === 'ice' ? 'gelo escorregadio' : st.hazard === 'lava' ? 'lava e respiros vulcânicos' : st.hazard === 'curse' ? 'maldição, estátuas e mímicos' : st.hazard === 'hell' ? 'portais e grades de fogo' : st.patches?.includes('quicksand') ? 'areia movediça' : 'nenhum';
    add(this.add.text(left + 14, y, `Perigos: ${known ? hazard : '?'}`, { fontFamily: FONT, fontSize: px(10), color: '#ffb08a' }).setOrigin(0, 0.5));
    // tesouros na linha de baixo: o texto dos perigos pode ser longo
    y += 20;
    add(this.add.text(left + 14, y, 'Tesouros:', { fontFamily: FONT, fontSize: px(10), color: '#a0e8a0' }).setOrigin(0, 0.5));
    ['chest', 'icon_magnet', 'bomb', 'heart'].forEach((tex, k) => add(fit(this.add.image(left + 80 + k * 20, y, 'atlas', frameName(tex, 0)), 15, 15)));

    // objetivos (estrelas desta dificuldade)
    y += 24;
    st.objectives.forEach((o, k) => {
      const oy = y + k * 20;
      add(starIcon(this, left + 22, oy, 7, !!tp.stars[k], known));
      add(this.add.text(left + 36, oy, known ? o.text : '—', { fontFamily: FONT, fontSize: px(11), color: tp.stars[k] ? '#ffe9a0' : '#dfe3f5' }).setOrigin(0, 0.5));
    });

    const can = known;
    const bw = (pw - 36) / 2;
    add(button(this, cx - bw / 2 - 6, top + ph - 26, 'VOLTAR', () => {
      sfx('select');
      this.scene.start('Menu');
    }, { width: bw, height: 36, size: 14 }));
    add(button(this, cx + bw / 2 + 6, top + ph - 26, can ? 'JOGAR' : open ? 'EM BREVE' : 'BLOQUEADA', () => {
      if (!can) return;
      sfx('select');
      const s = loadSave();
      s.stage = st.id;
      s.tier[st.id] = tier;
      writeSave(s);
      this.cameras.main.fadeOut(220, 11, 10, 20);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
    }, { width: bw, height: 36, size: 15, variant: can ? 'primary' : 'normal', disabled: !can }));
  }

  /** As criaturas do cenário andam devagar e viram nas bordas da área. */
  private walk(t: number, dt: number) {
    const a = this.area;
    for (const w of this.walkers) {
      const img = w.img;
      img.x += w.vx * dt;
      img.y += w.vy * dt;
      if (img.x < a.x + 20 || img.x > a.right - 20) w.vx = -w.vx;
      if (img.y < 120 || img.y > a.bottom - 40) w.vy = -w.vy;
      img.setFlipX(w.vx < 0).setDepth(img.y);
      const pose = walkPose(w.kind, t + w.phase, true);
      img.setFrame(frameName(w.texture, w.slots[pose.slot] ?? 0));
    }
  }

  /** Seta grande de trocar de fase. */
  private arrow(x: number, y: number, dir: -1 | 1) {
    const c = this.add.container(x, y).setDepth(7500);
    const g = this.add.graphics();
    g.fillStyle(0x0b0a14, 0.55).fillCircle(0, 0, 22);
    g.lineStyle(3, 0xfff2c0, 0.9).strokeCircle(0, 0, 22);
    g.fillStyle(0xfff2c0, 1).fillTriangle(dir * 9, 0, -dir * 6, -10, -dir * 6, 10);
    c.add(g);
    c.setSize(48, 48).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.go(dir));
    this.tweens.add({ targets: c, x: x + dir * 4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return c;
  }

  /** Seta pequena (dificuldade). */
  private smallArrow(x: number, y: number, dir: -1 | 1, onClick: () => void) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0xfff2c0, 1).fillTriangle(dir * 7, 0, -dir * 5, -8, -dir * 5, 8);
    c.add(g);
    c.setSize(34, 30).setInteractive({ useHandCursor: true });
    c.on('pointerup', onClick);
    return c;
  }

  private padlock(x: number, y: number, s: number) {
    const g = this.add.graphics({ x, y }).setScale(s);
    g.lineStyle(3, 0x8a8ca0, 1).beginPath().arc(0, -4, 6, Math.PI, 0).strokePath();
    g.fillStyle(0x8a8ca0, 1).fillRoundedRect(-9, -4, 18, 13, 3);
    g.fillStyle(0x3a3a48, 1).fillCircle(0, 2, 2.5);
    return g;
  }
}
