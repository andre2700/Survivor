// Cartão de item: ícone sobre uma moldura na cor da raridade (com brilho nas raras), forja "+N" e
// uma estrela quando o item tem efeito único. Usado na mochila, nos espaços do herói e no baú.
import Phaser from 'phaser';
import { RARITIES, baseOf, type ItemInstance } from '../data/items';
import { frameHd } from '../art/textures';
import { FONT, px } from './theme';

export function itemCard(scene: Phaser.Scene, x: number, y: number, it: ItemInstance | null, size: number, placeholder?: string) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const half = size / 2;
  const color = it ? RARITIES[it.rarity].color : 0x3a3a4a;
  if (it && it.rarity >= 3) {
    // brilho atrás das épicas, lendárias e míticas
    g.fillStyle(color, 0.25).fillRoundedRect(-half - 3, -half - 3, size + 6, size + 6, 10);
  }
  g.fillStyle(0x14121f, 0.92).fillRoundedRect(-half, -half, size, size, 8);
  g.fillStyle(color, it ? 0.22 : 0).fillRoundedRect(-half + 2, -half + 2, size - 4, size - 4, 7);
  g.lineStyle(it ? 2.5 : 1.5, color, it ? 1 : 0.7).strokeRoundedRect(-half, -half, size, size, 8);
  c.add(g);
  if (it) {
    const icon = scene.add.image(0, 0, baseOf(it.base).icon);
    icon.setScale(((size * 0.72) / Math.max(icon.width, icon.height)) * frameHd(icon));
    c.add(icon);
    if (it.forge > 0) c.add(scene.add.text(half - 3, half - 2, `+${it.forge}`, { fontFamily: FONT, fontSize: px(Math.max(8, size * 0.2)), fontStyle: 'bold', color: '#ffd86a', stroke: '#14101e', strokeThickness: 3 }).setOrigin(1, 1));
    if (it.effect) c.add(scene.add.text(-half + 3, -half + 1, '★', { fontFamily: FONT, fontSize: px(Math.max(8, size * 0.22)), color: '#ffe9a0', stroke: '#14101e', strokeThickness: 3 }).setOrigin(0, 0));
  } else if (placeholder) {
    const icon = scene.add.image(0, 0, placeholder).setAlpha(0.25).setTintFill(0x8a8ca0);
    icon.setScale(((size * 0.6) / Math.max(icon.width, icon.height)) * frameHd(icon));
    c.add(icon);
  }
  c.setSize(size, size);
  return c;
}

export const rarityHex = (r: number) => `#${RARITIES[r].color.toString(16).padStart(6, '0')}`;
