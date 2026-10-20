import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { DevScene } from './scenes/DevScene';
import { StageScene } from './scenes/StageScene';
import { BootScene, MenuScene, ShopScene } from './scenes/MenuScenes';
import { EquipScene } from './scenes/EquipScene';
import { GameOverScene, LevelUpScene, PauseScene, VictoryScene } from './scenes/OverlayScenes';
import { setupNative } from './native';
import { installHdSprites } from './art/textures';
import { VIEW, initView } from './ui/view';

// Resolução lógica: a interface usa uma coluna de 400 px de largura. Em retrato, a altura acompanha a
// proporção da tela; na horizontal, a partida usa a largura inteira e a altura lógica acompanha a
// altura real (440 num celular deitado, até 640 em tablets), para tudo manter o tamanho do retrato.
const BASE_WIDTH = 400;
const LANDSCAPE_MIN = 440;
const LANDSCAPE_MAX = 640;

function layout() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  if (w > h) {
    const height = Math.round(Math.min(LANDSCAPE_MAX, Math.max(LANDSCAPE_MIN, h * 1.1)));
    return { width: BASE_WIDTH, height, screenWidth: Math.round(Math.min(1600, Math.max(BASE_WIDTH, (height * w) / h))) };
  }
  const height = Math.round(Math.min(900, Math.max(640, (BASE_WIDTH * h) / w)));
  return { width: BASE_WIDTH, height, screenWidth: BASE_WIDTH };
}

/** Ao girar o celular, redimensiona o jogo e redesenha as telas abertas (a partida continua). */
function watchOrientation(game: Phaser.Game, zoom: number) {
  let last = `${VIEW.screenWidth}x${VIEW.height}`;
  let timer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const l = layout();
      if (`${l.screenWidth}x${l.height}` === last) return;
      last = `${l.screenWidth}x${l.height}`;
      initView(l.width, l.height, zoom, l.screenWidth);
      // no modo de ajuste (FIT), muda o tamanho do jogo e recalcula a exibição
      game.scale.setGameSize(l.screenWidth * zoom, l.height * zoom);
      for (const scene of game.scene.getScenes(false)) {
        if (!scene.sys.isActive() && !scene.sys.isPaused()) continue;
        if (scene instanceof GameScene) {
          scene.cameras.main.setSize(game.scale.width, game.scale.height);
          scene.onResize();
        } else {
          scene.cameras.main.setSize(game.scale.width, game.scale.height);
          scene.scene.restart();
        }
      }
    }, 150);
  });
}

async function start() {
  try {
    await Promise.all(['16px "Fredoka"', 'bold 16px "Fredoka"', '16px "Lilita One"'].map((f) => document.fonts.load(f)));
  } catch {
    // segue com a fonte padrão
  }

  // zoom de renderização: aproxima o canvas da resolução física da tela (1× ou 2×; 3× pesaria em celulares simples).
  // Vem do lado menor da tela, para não mudar ao girar o celular.
  const short = Math.min(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1);
  const zoom = Math.max(1, Math.min(2, Math.round(short / BASE_WIDTH)));
  const view = layout();
  initView(view.width, view.height, zoom, view.screenWidth);
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
    width: view.screenWidth * zoom,
    height: view.height * zoom,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    input: { activePointers: 3 },
    scene: [BootScene, MenuScene, StageScene, ShopScene, EquipScene, GameScene, HudScene, LevelUpScene, PauseScene, VictoryScene, GameOverScene, DevScene],
  });

  (window as unknown as { __game: Phaser.Game }).__game = game;
  setupNative(game);
  watchOrientation(game, zoom);
}

void start();
