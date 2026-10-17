import '@fontsource/press-start-2p';
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { BootScene, MenuScene, ShopScene } from './scenes/MenuScenes';
import { GameOverScene, LevelUpScene, PauseScene } from './scenes/OverlayScenes';
import { setupNative } from './native';

// A fonte pixel não tem maiúsculas acentuadas: troca por versões sem acento em todo texto.
const UPPER_ACCENTS: Record<string, string> = { Á: 'A', À: 'A', Â: 'A', Ã: 'A', É: 'E', Ê: 'E', Í: 'I', Ó: 'O', Ô: 'O', Õ: 'O', Ú: 'U', Ç: 'C' };
const originalSetText = Phaser.GameObjects.Text.prototype.setText;
Phaser.GameObjects.Text.prototype.setText = function (value: string | string[]) {
  const fix = (v: string) => String(v).replace(/[ÁÀÂÃÉÊÍÓÔÕÚÇ]/g, (c) => UPPER_ACCENTS[c]);
  return originalSetText.call(this, Array.isArray(value) ? value.map(fix) : fix(value));
};

// Resolução lógica: largura fixa de 360px; a altura acompanha a proporção da tela (retrato).
const BASE_WIDTH = 360;

function logicalHeight() {
  const ratio = window.innerHeight / Math.max(1, window.innerWidth);
  return Math.round(Math.min(800, Math.max(560, BASE_WIDTH * ratio)));
}

async function start() {
  try {
    await document.fonts.load('8px "Press Start 2P"');
  } catch {
    // segue com a fonte padrão
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1a1c2c',
    pixelArt: true,
    roundPixels: true,
    width: BASE_WIDTH,
    height: logicalHeight(),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    input: { activePointers: 3 },
    scene: [BootScene, MenuScene, ShopScene, GameScene, HudScene, LevelUpScene, PauseScene, GameOverScene],
  });

  (window as unknown as { __game: Phaser.Game }).__game = game;
  setupNative(game);
}

void start();
