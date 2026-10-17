import type Phaser from 'phaser';

/**
 * Tamanho lógico da tela (em "pixels de jogo") e o zoom de renderização.
 * O canvas real tem `screenWidth × zoom` pixels: a arte usa texturas em alta resolução
 * e os textos são desenhados na resolução real da tela, ficando nítidos.
 * - width: coluna da interface (400 em retrato e em paisagem; menus e telas sobrepostas usam só ela);
 * - screenWidth: largura da tela inteira (maior que width na horizontal; a partida usa toda);
 * - bleed: quanto a tela passa da coluna de cada lado (fundos devem cobrir essa sobra).
 */
export const VIEW = { width: 400, height: 800, zoom: 1, screenWidth: 400, bleed: 0 };

export function initView(width: number, height: number, zoom: number, screenWidth = width) {
  VIEW.width = width;
  VIEW.height = height;
  VIEW.zoom = zoom;
  VIEW.screenWidth = screenWidth;
  VIEW.bleed = (screenWidth - width) / 2;
}

/** Câmera de interface: mostra exatamente o retângulo lógico 0..width × 0..height. */
export function setupCamera(scene: Phaser.Scene) {
  const cam = scene.cameras.main;
  cam.setZoom(VIEW.zoom);
  cam.centerOn(VIEW.width / 2, VIEW.height / 2);
}

/** Converte a posição do ponteiro (pixels do canvas) para coordenadas lógicas. */
export function pointerPos(scene: Phaser.Scene, pointer: Phaser.Input.Pointer) {
  return scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
}
