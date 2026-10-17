// Teste de estilo (docs/ART_PLAN.md): a mesma cena de jogo em três painéis lado a lado —
// arte atual (gerada por código), pixel art com IA e cartoon com IA.
// Mesma escala do jogo: 400 px lógicos de largura, zoom 2. Abra /dev/style-test.html.
import '@fontsource/jersey-15';
import Phaser from 'phaser';
import { generateTextures } from '../src/art/textures';

const W = 400, H = 640, ZOOM = 2;
const STYLES = [
  { id: 'atual', label: 'Atual (código)' },
  { id: 'pixel', label: 'Pixel art (IA)' },
  { id: 'cartoon', label: 'Cartoon (IA)' },
] as const;
const NAMES = ['hero', 'slime', 'goblin', 'wolf', 'demon', 'tree', 'grass', 'icon_sword', 'icon_bolt', 'icon_orb'];
// equivalente na arte atual
const CURRENT: Record<string, string> = {
  hero: 'hero_knight', slime: 'slime', goblin: 'goblin', wolf: 'wolf', demon: 'demon', tree: 'tree', grass: 'ground',
  icon_sword: 'icon_sword', icon_bolt: 'icon_bolt', icon_orb: 'orb',
};

class StyleTest extends Phaser.Scene {
  preload() {
    for (const s of ['pixel', 'cartoon']) for (const n of NAMES) this.load.image(`${s}:${n}`, `./art-test/${s}/${n}.png`);
  }

  create() {
    generateTextures(this);
    for (const n of NAMES) this.textures.get(`cartoon:${n}`).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.cameras.main.setZoom(ZOOM).centerOn((W * STYLES.length) / 2, H / 2);
    STYLES.forEach((s, i) => this.panel(s.id, s.label, i * W));
    (window as unknown as { __ready: boolean }).__ready = true;
  }

  /** Chave e escala do sprite: cartoon vem em 2× e é desenhado pela metade. */
  key(style: string, name: string): [string, number] {
    if (style === 'atual') return [CURRENT[name], 1];
    return [`${style}:${name}`, style === 'cartoon' ? 0.5 : 1];
  }

  sprite(style: string, name: string, x: number, y: number, flip = false) {
    const [key, scale] = this.key(style, name);
    // sprites com quadros de animação: usa o primeiro
    const frame = this.textures.get(key).has('0') ? 0 : undefined;
    const img = this.add.image(x, y, key, frame).setOrigin(0.5, 1).setScale(scale).setFlipX(flip);
    this.add.ellipse(x, y - 1, img.displayWidth * 0.6, 5, 0x000000, 0.25).setDepth(y - 0.5);
    return img.setDepth(y);
  }

  panel(style: string, label: string, ox: number) {
    const [gkey, gscale] = this.key(style, 'grass');
    this.add.tileSprite(ox, 0, W / gscale, H / gscale, gkey).setOrigin(0).setScale(gscale).setDepth(-1000);

    const S = (n: string, x: number, y: number, flip = false) => this.sprite(style, n, ox + x, y, flip);
    // a arte atual vira os inimigos para a esquerda por padrão? normaliza: todos olham para o herói
    const faceLeft = style !== 'atual';
    S('tree', 40, 150); S('tree', 370, 260); S('tree', 60, 560); S('tree', 350, 610);
    S('demon', 200, 200, !faceLeft);
    S('hero', 200, 380);
    for (const [n, x, y] of [['slime', 300, 360], ['slime', 330, 410], ['goblin', 290, 470], ['wolf', 320, 300],
      ['slime', 110, 330], ['goblin', 90, 420], ['wolf', 120, 480], ['slime', 200, 500]] as const) {
      S(n, x, y, x < 200 ? faceLeft : !faceLeft);
    }

    // barra de habilidades (como o HUD)
    const icons = ['icon_sword', 'icon_bolt', 'icon_orb'];
    icons.forEach((n, i) => {
      const x = ox + 200 + (i - 1) * 30, y = H - 24;
      this.add.rectangle(x, y, 26, 26, 0x1a1c2c, 0.85).setStrokeStyle(1, 0xf4d47c).setDepth(5000);
      const [key, scale] = this.key(style, n);
      this.add.image(x, y, key).setScale(scale).setDepth(5001);
    });

    this.add.rectangle(ox, 0, W, 22, 0x000000, 0.6).setOrigin(0).setDepth(5000);
    this.add.text(ox + W / 2, 11, label, { fontFamily: '"Jersey 15"', fontSize: '18px', color: '#ffffff', resolution: ZOOM })
      .setOrigin(0.5).setDepth(5001);
    if (ox > 0) this.add.rectangle(ox, 0, 1, H, 0x000000).setOrigin(0).setDepth(6000);
  }
}

await document.fonts.load('16px "Jersey 15"');
new Phaser.Game({
  type: Phaser.WEBGL, parent: 'game', width: W * STYLES.length * ZOOM, height: H * ZOOM,
  pixelArt: true, roundPixels: true, backgroundColor: '#000', scene: [StyleTest],
});
