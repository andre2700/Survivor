import '@fontsource/jersey-15';
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { BootScene, MenuScene, ShopScene } from './scenes/MenuScenes';
import { GameOverScene, LevelUpScene, PauseScene, VictoryScene } from './scenes/OverlayScenes';
import { setupNative } from './native';
import { initView } from './ui/view';

// Resolução lógica: largura fixa de 400px; a altura acompanha a proporção da tela (retrato).
const BASE_WIDTH = 400;

function logicalHeight() {
  const ratio = window.innerHeight / Math.max(1, window.innerWidth);
  return Math.round(Math.min(900, Math.max(640, BASE_WIDTH * ratio)));
}

async function start() {
  try {
    await Promise.all([document.fonts.load('16px "Jersey 15"'), document.fonts.load('bold 16px "Jersey 15"')]);
  } catch {
    // segue com a fonte padrão
  }

  // zoom de renderização: aproxima o canvas da resolução física da tela (1× ou 2×; 3× pesaria em celulares simples)
  const zoom = Math.max(1, Math.min(2, Math.round((window.innerWidth * (window.devicePixelRatio || 1)) / BASE_WIDTH)));
  const height = logicalHeight();
  initView(BASE_WIDTH, height, zoom);
  // todo texto é desenhado na resolução real do canvas
  type TextFactory = (x: number, y: number, str: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as { text: TextFactory };
  const originalText = factory.text;
  factory.text = function (this: unknown, x, y, str, style = {}) {
    return originalText.call(this, x, y, str, { resolution: zoom, ...style });
  };

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1a1c2c',
    pixelArt: true,
    roundPixels: true,
    width: BASE_WIDTH * zoom,
    height: height * zoom,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    input: { activePointers: 3 },
    scene: [BootScene, MenuScene, ShopScene, GameScene, HudScene, LevelUpScene, PauseScene, VictoryScene, GameOverScene],
  });

  (window as unknown as { __game: Phaser.Game }).__game = game;
  setupNative(game);
}

void start();
