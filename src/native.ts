import { Capacitor } from '@capacitor/core';
import type Phaser from 'phaser';
import type { GameScene } from './scenes/GameScene';

/** Integrações com Android/iOS (botão voltar, app em segundo plano). */
export async function setupNative(game: Phaser.Game) {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');

  App.addListener('backButton', () => {
    const scenes = game.scene;
    if (scenes.isActive('Game')) {
      (scenes.getScene('Game') as GameScene).openPause();
    } else if (scenes.isActive('Pause')) {
      (scenes.getScene('Game') as GameScene).resumeFromPause();
    } else if (scenes.isActive('Shop')) {
      scenes.getScene('Shop').scene.start('Menu');
    } else if (scenes.isActive('Menu')) {
      void App.exitApp();
    }
  });

  App.addListener('pause', () => {
    const scenes = game.scene;
    if (scenes.isActive('Game')) (scenes.getScene('Game') as GameScene).openPause();
  });
}
