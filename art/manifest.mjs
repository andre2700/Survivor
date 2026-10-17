// Lista da arte cartoon do jogo. Cada item vira uma imagem gerada (art/source/<nome>.png, ver
// scripts/gen-art.mjs) e depois processada para src/assets/art/ (scripts/process-art.py).
//
// h: altura lógica no jogo (px); w: largura lógica, no lugar de h, para objetos deitados.
// hd: resolução da textura em relação ao tamanho lógico (padrão 2; 4 para o que aparece ampliado na interface).
// portrait: gera também portrait_<nome>.png nesta resolução (herói grande no menu).
// shadow: acrescenta sombra oval sob os pés.
// flip: a imagem gerada olha para a esquerda; o jogo espera tudo olhando para a direita.
// frames: poses da folha de animação (art/source/<nome>_sheet.png), gerada a partir da imagem base.
// separate: gera uma imagem por pose (<nome>_f1.png...) em vez da folha (figuras grandes que se encostariam).
const CHAR = 'full body, side view facing RIGHT';
const ICON = 'game UI item icon, single object centered, bold readable silhouette, no circle or badge behind it';

const WALK = ['walking, left leg forward, right leg back (contact pose)', 'walking, legs together under the body (passing pose)', 'walking, right leg forward, left leg back (contact pose)'];
const HERO = ['idle stance, relaxed, weapon held ready', 'walking, left leg forward (contact pose)', 'walking, right leg forward (contact pose)', 'attacking: swinging or thrusting the weapon forward to the RIGHT, dynamic'];

export const ART = {
  // chão: textura que se repete (sem fundo para recortar)
  ground: { tile: true, prompt: `a seamless tileable texture of lush green grass ground seen from directly above, for a top-down RPG map. Very clean and calm: only soft, large, painterly patches of slightly lighter and darker green, like a smooth cartoon lawn. NO grass tufts, NO outlines, NO dots, NO speckles, NO flowers, NO objects. Even lighting, fills the whole square image edge to edge` },
  // heróis
  hero_knight: { h: 44, hd: 3, portrait: 8, shadow: true, frames: HERO, prompt: `a brave young knight hero in steel armor with a blue cape and a sword, ${CHAR}, heroic stance` },
  hero_mage: { h: 44, hd: 3, portrait: 8, shadow: true, frames: HERO, prompt: `a young female mage hero with a tall pointy purple wizard hat with gold trim, purple robe, blond hair, holding a magic staff with a glowing crystal, ${CHAR}, confident stance` },
  hero_ranger: { h: 44, hd: 3, portrait: 8, shadow: true, frames: HERO, prompt: `an agile female ranger huntress hero with a green hood and green cape, leather tunic, holding two daggers, ${CHAR}, ready stance` },
  hero_barbarian: { h: 44, hd: 3, portrait: 8, shadow: true, frames: HERO, prompt: `a muscular barbarian hero with red hair and red beard, horned steel helmet, bare chest with fur shoulder pad, leather pants, holding a big battle axe, ${CHAR}, fierce stance` },
  // inimigos
  slime: { h: 22, hd: 3, shadow: true, frames: ['normal resting shape', 'squashed flat and wide, about to hop', 'stretched tall and narrow, mid-hop'] },
  bat: { h: 22, hd: 3, frames: ['wings raised high', 'wings level, spread wide', 'wings swept down low'], prompt: `a small purple cave bat monster with big ears, open wings, fangs and glowing eyes, flying, ${CHAR}` },
  goblin: { h: 32, hd: 3, shadow: true, frames: WALK.map((f) => `${f}, holding the crude dagger in the front hand`) },
  wolf: { h: 28, hd: 3, shadow: true, frames: ['running, all four legs gathered under the body', 'running, legs fully stretched front and back', 'running, front paws touching the ground, back legs lifted'] },
  skeleton: { h: 34, hd: 3, shadow: true, frames: WALK, prompt: `a skeleton warrior monster with a rusty sword and a broken wooden shield, glowing eye sockets, ${CHAR}, walking` },
  orc: { h: 42, hd: 3, shadow: true, frames: WALK, prompt: `a big brutish green orc brute monster with tusks, iron shoulder armor and a spiked wooden club, ${CHAR}, menacing` },
  demon: { h: 74, hd: 3, shadow: true, frames: WALK, separate: true },
  // coletáveis
  gem: { h: 14, hd: 4, prompt: `${ICON}: a small shiny blue experience crystal gem` },
  gem_green: { h: 14, hd: 4, prompt: `${ICON}: a small shiny green experience crystal gem` },
  gem_red: { h: 14, hd: 4, prompt: `${ICON}: a small shiny red experience crystal gem` },
  coin: { h: 12, hd: 4, prompt: `${ICON}: a shiny gold coin seen from the front, with a star engraved` },
  heart: { h: 12, hd: 4, prompt: `${ICON}: a glossy red heart (health pickup)` },
  // projéteis (deitados apontando para a direita)
  proj_bolt: { w: 16, prompt: `a magic energy bolt projectile, glowing purple and pink arcane fireball with a short sparkling tail, flying horizontally to the RIGHT` },
  proj_knife: { w: 16, prompt: `a single steel throwing dagger lying horizontally, blade pointing to the RIGHT` },
  proj_axe: { h: 16, prompt: `a single spinning throwing battle axe with wooden handle and steel blade` },
  proj_orb: { h: 16 },
  // cenário (visto de cima, estilo mapa de RPG)
  tree: { h: 72, shadow: true },
  tree2: { h: 78, shadow: true, prompt: `a single tall green pine tree with brown trunk, front view, like a top-down RPG map object` },
  bush: { h: 22, shadow: true, prompt: `a single round green leafy bush, front view, like a top-down RPG map object` },
  rock: { h: 16, shadow: true, prompt: `a single gray boulder rock with a bit of moss, front view, like a top-down RPG map object` },
  stump: { h: 16, shadow: true, prompt: `a single cut tree stump with roots, front view, like a top-down RPG map object` },
  flowers: { h: 14, prompt: `a small cluster of colorful wild flowers (white, yellow and pink) with leaves, like a top-down RPG map decoration` },
  mushroom: { h: 14, prompt: `two small red mushrooms with white spots, like a top-down RPG map decoration` },
  tallgrass: { h: 16, prompt: `a small tuft of tall green grass blades, like a top-down RPG map decoration` },
  dirt: { w: 72, prompt: `a flat irregular patch of bare brown dirt ground with a few small pebbles, seen from directly above, organic blob shape, like a top-down RPG map decal` },
  dirt2: { w: 64, prompt: `a flat irregular patch of bare brown dirt ground with tiny grass bits around the edges, seen from directly above, elongated organic shape, like a top-down RPG map decal` },
  // ícones (armas, cartas, interface)
  bolt: { h: 16, hd: 4, prompt: `${ICON}: a magic wand with a glowing purple star crystal at the tip` },
  icon_sword: { h: 16, hd: 4 },
  axe: { h: 16, hd: 4, prompt: `${ICON}: a battle axe, diagonal` },
  orb: { h: 16, hd: 4 },
  icon_fire: { h: 16, hd: 4, prompt: `${ICON}: a bright orange and yellow flame` },
  icon_bolt: { h: 16, hd: 4 },
  knife: { h: 16, hd: 4, prompt: `${ICON}: a throwing dagger, diagonal, blade pointing up-right` },
  icon_potion: { h: 16, hd: 4, prompt: `${ICON}: a round glass potion bottle with red liquid and a cork` },
  icon_book: { h: 16, hd: 4, prompt: `${ICON}: a closed purple arcane spell book with a gold rune on the cover` },
  icon_boot: { h: 16, hd: 4, prompt: `${ICON}: a brown leather boot with a small wing on the side` },
  icon_magnet: { h: 16, hd: 4, prompt: `${ICON}: a red horseshoe magnet with silver tips` },
  icon_cross: { h: 16, hd: 4, prompt: `${ICON}: a green healing herb leaf sprig with a small white plus sign sparkle` },
  icon_shield: { h: 16, hd: 4, prompt: `${ICON}: a round blue and steel knight shield` },
  icon_dice: { h: 16, hd: 4, prompt: `${ICON}: a white six-sided die with a small green four-leaf clover beside it` },
  icon_skull: { h: 16, hd: 4, prompt: `${ICON}: a white cartoon skull` },
  icon_star: { h: 16, hd: 4, prompt: `${ICON}: a shiny gold star` },
};
