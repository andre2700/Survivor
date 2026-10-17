import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { BootScene, MenuScene, ShopScene } from './scenes/MenuScenes';
import { GameOverScene, LevelUpScene, PauseScene, VictoryScene } from './scenes/OverlayScenes';
import { setupNative } from './native';
import { installHdSprites } from './art/textures';
import { initView } from './ui/view';

// Resolução lógica: largura fixa de 400px; a altura acompanha a proporção da tela (retrato).
const BASE_WIDTH = 400;

function logicalHeight() {
  const ratio = window.innerHeight / Math.max(1, window.innerWidth);
  return Math.round(Math.min(900, Math.max(640, BASE_WIDTH * ratio)));
}

async function start() {
  try {
    await Promise.all(['16px "Fredoka"', 'bold 16px "Fredoka"', '16px "Lilita One"'].map((f) => document.fonts.load(f)));
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

  installHdSprites();
  const game = new Phaser.Game({
    // a arte em alta resolução depende do renderizador WebGL (ver installHdSprites)
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#1a1c2c',
    // texturas com filtro suave; sem MSAA (as bordas já vêm suavizadas na arte, e o MSAA pesa no celular)
    antialias: true,
    antialiasGL: false,
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
