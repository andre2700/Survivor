import Phaser from 'phaser';
import { frameHd } from '../art/textures';
import { formatNumber } from '../core/format';
import { ACHIEVEMENTS, dailyFor, dailyReward, type Reward } from '../data/missions';
import { itemName, RARITIES } from '../data/items';
import {
  achievementNext, achievementReady, achievementValue, claimAchievement, claimDaily, claimDailyBonus, daily, dailyDone, stagesCleared,
} from '../systems/progress';
import { loadSave, writeSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import { itemCard, rarityHex } from '../ui/items';
import { button, goldTitle, panel, text } from '../ui/theme';
import { VIEW, WIDE_COL, col, isWide, pointerPos, setupCamera } from '../ui/view';
import { goldPill, menuBackground } from './MenuScenes';

type Tab = 'daily' | 'achievements';

/** Texto da recompensa: "+300 ouro · +20 pó · +1 cristal". */
export function rewardText(r: Reward) {
  const parts = [
    r.gold ? `+${formatNumber(r.gold)} ouro` : '',
    r.dust ? `+${r.dust} pó` : '',
    r.crystals ? `+${r.crystals} Cristal de Evolução` : '',
    r.shards ? `+${r.shards} Fragmento Ancestral` : '',
  ];
  return parts.filter(Boolean).join(' · ');
}

/**
 * Missões: as 3 diárias (trocam à meia-noite) com o Baú Diário ao completar todas, e as conquistas
 * em níveis. Cada recompensa é resgatada com um toque.
 */
export class MissionsScene extends Phaser.Scene {
  private tab: Tab = 'daily';
  private scrollY = 0;

  constructor() {
    super('Missions');
  }

  init(data: { tab?: Tab }) {
    if (data.tab) this.tab = data.tab;
  }

  create() {
    setupCamera(this);
    const { width, height } = VIEW;
    const save = loadSave();
    daily(save);
    writeSave(save);
    menuBackground(this, 0.6);
    goldPill(this, save.gold);
    goldTitle(this, width / 2, 34, 'MISSÕES', 28);
    const pw = Math.min(width - 24, 380);
    // abas
    const tabs: [Tab, string][] = [['daily', 'DIÁRIAS'], ['achievements', 'CONQUISTAS']];
    tabs.forEach(([id, label], i) => {
      button(this, width / 2 + (i ? 1 : -1) * 84, 72, label, () => {
        sfx('select');
        this.tab = id;
        this.scrollY = 0;
        this.scene.restart();
      }, { width: 160, height: 32, size: 13, variant: this.tab === id ? 'primary' : undefined });
    });
    if (this.tab === 'daily') this.dailyTab(pw);
    else this.achievementsTab(pw);
    button(this, width / 2, height - 30, 'VOLTAR', () => {
      sfx('select');
      this.scene.start('Menu');
    }, { width: 180, height: 38, size: 14 });
  }

  /** Recompensa ganha: texto subindo e brilho. */
  private celebrate(x: number, y: number, msg: string) {
    sfx('levelup');
    const t = text(this, x, y, msg, 13, '#ffd86a', { bold: true, strokeThickness: 4 }).setDepth(20);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }

  private dailyTab(pw: number) {
    const { width } = VIEW;
    // deitado: missões à esquerda, Baú Diário à direita
    const wide = isWide();
    if (wide) pw = WIDE_COL;
    const mx = wide ? col(-1) : width / 2;
    const save = loadSave();
    const d = daily(save);
    const list = dailyFor(d.day);
    const reward = dailyReward(stagesCleared(save));
    // tempo até trocar
    const now = new Date();
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.ceil((mid.getTime() - now.getTime()) / 60000);
    text(this, mx, 104, `Novas missões em ${Math.floor(mins / 60)}h ${mins % 60}min`, 11, '#a8acc4');
    let y = 128;
    list.forEach((m, i) => {
      const have = Math.min(m.target, d.progress[m.stat] ?? 0);
      const done = dailyDone(save, i);
      const claimed = d.claimed[i];
      const h = 76;
      panel(this, mx, y + h / 2, pw, h, claimed ? 'ui_slot' : 'ui_panel_dark');
      const left = mx - pw / 2 + 16;
      text(this, left, y + 18, m.text, 13, claimed ? '#8a8ca0' : '#ffffff', { bold: true }).setOrigin(0, 0.5);
      text(this, left, y + 38, rewardText(reward), 10, '#ffe9a0').setOrigin(0, 0.5);
      const bw = pw - 150;
      const g = this.add.graphics();
      g.fillStyle(0x0d0b16, 1).fillRoundedRect(left, y + 52, bw, 9, 4);
      g.fillStyle(done ? 0x8cf08a : 0xffd86a, 1).fillRoundedRect(left, y + 52, Math.max(5, bw * (have / m.target)), 9, 4);
      text(this, left + bw + 6, y + 56, `${formatNumber(have)}/${formatNumber(m.target)}`, 10, '#c8cce0').setOrigin(0, 0.5);
      const bx = mx + pw / 2 - 56;
      if (claimed) text(this, bx, y + h / 2, '✓ RESGATADA', 11, '#8cf08a', { bold: true });
      else if (done) {
        const b = button(this, bx, y + h / 2, 'RESGATAR', () => {
          const s = loadSave();
          const r = claimDaily(s, i);
          if (!r) return;
          writeSave(s);
          this.celebrate(bx, y, rewardText(r));
          this.time.delayedCall(600, () => this.scene.restart());
        }, { width: 96, height: 32, size: 12, variant: 'primary' });
        this.tweens.add({ targets: b, scale: 1.06, duration: 500, yoyo: true, repeat: -1 });
      }
      y += h + 10;
    });
    // Baú Diário
    const cx = wide ? col(1) : width / 2;
    y = wide ? 128 : y + 6;
    const h = 92;
    const all = d.claimed.every(Boolean);
    panel(this, cx, y + h / 2, pw, h, all && !d.bonus ? 'ui_card_2' : 'ui_panel_dark');
    const chest = this.add.image(cx - pw / 2 + 46, y + h / 2, 'atlas', 'chest:0').setScale(1.3);
    if (!all) chest.setTint(0x6a6c7a);
    text(this, cx - pw / 2 + 88, y + 26, 'BAÚ DIÁRIO', 15, '#ffd86a', { bold: true, strokeThickness: 3 }).setOrigin(0, 0.5);
    text(this, cx - pw / 2 + 88, y + 40, d.bonus ? 'Aberto hoje. Volte amanhã!' : 'Complete as 3 missões: item Raro ou melhor e +40 pó', 10, '#c8cce0', { wrap: pw - (all && !d.bonus ? 200 : 104) }).setOrigin(0, 0).setAlign('left');
    if (all && !d.bonus) {
      const b = button(this, cx + pw / 2 - 56, y + h / 2, 'ABRIR', () => {
        const s = loadSave();
        const it = claimDailyBonus(s);
        if (!it) return;
        writeSave(s);
        sfx('levelup');
        // mostra o item ganho
        const { height } = VIEW;
        const shade = this.add.rectangle(width / 2, height / 2, VIEW.screenWidth, height, 0x07060c, 0.8).setDepth(30).setInteractive();
        const card = itemCard(this, width / 2, height / 2, it, 80).setDepth(31).setScale(0);
        this.tweens.add({ targets: card, scale: 1, duration: 400, ease: 'Back.Out' });
        text(this, width / 2, height / 2 + 64, itemName(it), 15, rarityHex(it.rarity), { bold: true, strokeThickness: 4 }).setDepth(31);
        text(this, width / 2, height / 2 + 86, `${RARITIES[it.rarity].name} · +40 pó`, 12, '#c8cce0').setDepth(31);
        text(this, width / 2, height / 2 + 120, 'toque para continuar', 10, '#8a8ca0').setDepth(31);
        shade.once('pointerup', () => this.scene.restart());
      }, { width: 96, height: 34, size: 14, variant: 'primary' });
      this.tweens.add({ targets: b, scale: 1.08, duration: 450, yoyo: true, repeat: -1 });
    }
  }

  private achievementsTab(pw: number) {
    const { width, height } = VIEW;
    const save = loadSave();
    const top = 100;
    const bottom = height - 60;
    const h = 78;
    // as prontas primeiro, depois as em andamento, depois as completas
    const order = [...ACHIEVEMENTS].sort((a, b) => {
      const rank = (x: typeof a) => (achievementReady(save, x) ? 0 : achievementNext(save, x).next ? 1 : 2);
      return rank(a) - rank(b);
    });
    const list = this.add.container(0, top);
    order.forEach((a, i) => {
      const y = i * (h + 8);
      const c = this.add.container(0, y);
      list.add(c);
      const { done, next } = achievementNext(save, a);
      const ready = achievementReady(save, a);
      const value = achievementValue(save, a);
      c.add(panel(this, width / 2, h / 2, pw, h, ready ? 'ui_card_2' : next ? 'ui_panel_dark' : 'ui_slot'));
      const left = width / 2 - pw / 2 + 14;
      const icon = this.add.image(left + 18, h / 2, a.icon);
      icon.setScale((32 / Math.max(icon.width, icon.height)) * frameHd(icon));
      c.add(icon);
      c.add(text(this, left + 44, 16, a.name, 14, '#ffd86a', { bold: true }).setOrigin(0, 0.5));
      // estrelas: níveis resgatados
      c.add(text(this, left + 44 + 6 + a.name.length * 8.2, 16, '★'.repeat(done) + '☆'.repeat(a.tiers.length - done), 11, '#ffe9a0').setOrigin(0, 0.5));
      if (next) {
        c.add(text(this, left + 44, 36, a.text(next.target), 11, '#e8ecff').setOrigin(0, 0.5));
        c.add(text(this, left + 44, 54, rewardText(next.reward), 9, '#ffe9a0').setOrigin(0, 0.5));
        const bw = pw - 180;
        const g = this.add.graphics();
        const have = Math.min(next.target, Math.max(0, value));
        g.fillStyle(0x0d0b16, 1).fillRoundedRect(left + 44, 64, bw, 7, 3);
        g.fillStyle(ready ? 0x8cf08a : 0xffd86a, 1).fillRoundedRect(left + 44, 64, Math.max(4, bw * (have / next.target)), 7, 3);
        c.add(g);
        if (a.stat !== 'maxTier') c.add(text(this, left + 48 + bw, 68, `${formatNumber(Math.floor(a.stat === 'seconds' ? have / 60 : have))}/${formatNumber(a.stat === 'seconds' ? next.target / 60 : next.target)}`, 9, '#c8cce0').setOrigin(0, 0.5));
      } else c.add(text(this, left + 44, 40, 'Completa!', 12, '#8cf08a', { bold: true }).setOrigin(0, 0.5));
      if (ready) {
        const bx = width / 2 + pw / 2 - 52;
        const b = button(this, bx, h / 2, 'RESGATAR', () => {
          if (this.dragged) return;
          const s = loadSave();
          const r = claimAchievement(s, a);
          if (!r) return;
          writeSave(s);
          this.celebrate(bx, top + this.scrollY + y, rewardText(r));
          this.time.delayedCall(600, () => this.scene.restart());
        }, { width: 88, height: 30, size: 11, variant: 'primary' });
        c.add(b);
      }
    });
    // rolagem
    const mask = this.make.graphics({}, false).fillRect(0, top - 4, width, bottom - top + 8);
    list.setMask(mask.createGeometryMask());
    const contentH = order.length * (h + 8);
    const minY = Math.min(0, bottom - top - contentH);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, minY, 0);
    list.y = top + this.scrollY;
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
      this.scrollY = Phaser.Math.Clamp(start + dy, minY, 0);
      list.y = top + this.scrollY;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.5, minY, 0);
      list.y = top + this.scrollY;
    });
  }

  private dragged = false;
}
