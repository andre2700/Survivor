// Lista da arte cartoon do jogo. Cada item vira uma imagem gerada (art/source/<nome>.png, ver
// scripts/gen-art.mjs) e depois processada para src/assets/art/ (scripts/process-art.py).
//
// h: altura lógica no jogo (px); w: largura lógica, no lugar de h, para objetos deitados.
// hd: resolução da textura em relação ao tamanho lógico (padrão 2; 4 para o que aparece ampliado na interface).
// portrait: gera também portrait_<nome>.png nesta resolução (herói grande no menu).
// shadow: acrescenta sombra oval sob os pés.
// flip: a imagem gerada olha para a esquerda; o jogo espera tudo olhando para a direita.
// role/body: personagem animado pelo modelo de quadros abaixo (FRAME_TEMPLATES e POSES).
// hold: o que o personagem segura, repetido em todas as poses (a IA às vezes larga a arma).
// variant: cópia de outra criatura com a cor trocada (hue: graus somados à matiz dentro de range; sat/val: multiplicadores).
// wide: folhas em formato 21:9 (figuras grandes, com asas, que se encostariam no formato padrão).
// ground: efeito apoiado no chão (quadros alinhados pela base, não pelo centro).
// frames: quantos quadros o efeito tem (padrão 4; mínimo 2).
const CHAR = 'full body, side view facing RIGHT';
const FX = 'game VFX sprite, single effect centered, bold readable shape, vivid colors: ';
const ICON = 'game UI item icon, single object centered, bold readable silhouette, no circle or badge behind it';

// ---------- Modelo de quadros ----------
// Toda criatura nova segue o modelo do seu papel. Os quadros vêm de duas folhas geradas a partir da
// imagem base: movimento (<nome>_sheet.png) e ação (<nome>_action.png, e _action2... nas figuras grandes).
// Cada folha de ação começa com a pose do 1º quadro de movimento, só para acertar a escala (é descartada).
export const FRAME_TEMPLATES = {
  // monstro comum: só causa dano encostando
  // todo monstro tem ao menos um quadro de ataque (mostrado quando ele acerta o herói)
  monster: { move: ['walk_a', 'walk_mid', 'walk_b'], action: ['attack', 'hurt', 'death'] },
  // monstro com ataque próprio, que precisa ser visto chegando
  special: { move: ['walk_a', 'walk_mid', 'walk_b'], action: ['windup', 'attack', 'hurt', 'death'] },
  boss: { move: ['idle', 'walk_a', 'walk_b'], action: ['windup', 'attack', 'hurt', 'death'] },
  // herói: ciclo de corrida completo (pé de perto à frente, passagem, pé de longe à frente)
  hero: { move: ['idle', 'walk_a', 'walk_mid', 'walk_b'], action: ['attack', 'hurt', 'death', 'victory'] },
  // efeito visual animado (reações, explosões, ondas): até 4 quadros numa folha só, descritos em
  // `poses`; `frames` limita a quantidade (todo efeito tem ao menos 2 quadros)
  vfx: { move: ['f1', 'f2', 'f3', 'f4'], action: [] },
};

// Descrição de cada pose por tipo de corpo.
const BIPED = {
  idle: 'idle stance, relaxed, weapon held ready',
  walk_a: 'walking, mid-stride: the NEAR leg (closest to the viewer) stepping forward and the FAR leg back, arms swinging opposite to the legs',
  walk_mid: 'walking, legs together under the body (passing pose)',
  walk_b: 'walking, mid-stride: the FAR leg stepping forward and the NEAR leg back, the opposite legs of the other stride frame',
  windup: 'winding up a big attack: weapon raised high behind the head, body leaning back, menacing',
  attack: 'attacking: swinging or thrusting the weapon forward to the RIGHT with full force, dynamic',
  hurt: 'recoiling from a hit: flinching backwards, eyes squeezed shut, grimacing in pain',
  death: 'defeated: collapsed lying flat on the ground, eyes closed, weapon dropped beside the body',
  victory: 'celebrating victory: weapon raised high in the air, big happy smile, jumping with joy',
};
// heróis correm (mais tempo de tela e mais energia): mesmo ciclo de pés, corpo em posição de corrida
const RUN = {
  walk_a: 'running fast, body leaning forward: the NEAR leg (closest to the viewer) reaching forward, the FAR leg pushing off behind, arms pumping opposite to the legs',
  walk_mid: 'running fast, body leaning forward: passing pose, one foot under the body and the other knee lifted high',
  walk_b: 'running fast, body leaning forward: the FAR leg reaching forward, the NEAR leg pushing off behind, the opposite legs of the other stride frame',
};

export const POSES = {
  biped: BIPED,
  quadruped: {
    ...BIPED,
    walk_a: 'running, all four legs gathered under the body',
    walk_mid: 'running, legs fully stretched front and back',
    walk_b: 'running, front paws touching the ground, back legs lifted',
    attack: 'biting forward: lunging with jaws wide open, fangs bared',
    windup: 'crouching low, ready to pounce, snarling',
    attack: 'pouncing forward with jaws wide open',
    hurt: 'recoiling from a hit: yelping, flinching backwards, eyes squeezed shut',
    death: 'defeated: lying on its side on the ground, eyes closed, tongue out',
  },
  flyer: {
    ...BIPED,
    walk_a: 'wings raised high',
    walk_mid: 'wings level, spread wide',
    walk_b: 'wings swept down low',
    attack: 'diving forward to bite: body tilted forward, fangs bared, wings swept back',
    hurt: 'knocked back in the air by a hit, wings crumpled, eyes squeezed shut',
    death: 'defeated: falling, upside down with limp wings, eyes closed (X eyes)',
  },
  blob: {
    ...BIPED,
    walk_a: 'normal resting shape',
    walk_mid: 'squashed flat and wide, about to hop',
    walk_b: 'stretched tall and narrow, mid-hop',
    attack: 'lunging forward with its mouth wide open, body stretched toward the RIGHT',
    hurt: 'dented and wobbling from a hit, eyes squeezed shut',
    death: 'defeated: melted into a flat puddle, eyes closed (X eyes)',
  },
};

export const ART = {
  // chão: textura que se repete (sem fundo para recortar)
  ground: { tile: true, prompt: `a seamless tileable texture of lush green grass ground seen from directly above, for a top-down RPG map. Very clean and calm: only soft, large, painterly patches of slightly lighter and darker green, like a smooth cartoon lawn. NO grass tufts, NO outlines, NO dots, NO speckles, NO flowers, NO objects. Even lighting, fills the whole square image edge to edge` },
  // heróis
  hero_knight: {
    h: 44, hd: 3, portrait: 8, shadow: true, role: 'hero', body: 'biped', hold: 'BOTH the sword (blade clearly visible, pointing forward and up) and the round blue steel shield; the sword never disappears',
    prompt: `a brave young knight hero in steel armor with a blue cape, a sword in one hand and a round blue steel shield with a gold rim on the other arm, ${CHAR}, heroic stance`,
    poses: { attack: 'slashing the sword forward to the RIGHT in a wide arc, shield held up in front of the body, dynamic' },
  },
  hero_mage: { h: 44, hd: 3, portrait: 8, shadow: true, role: 'hero', body: 'biped', hold: 'the tall magic staff with the glowing purple crystal firmly in the front hand', prompt: `a young female mage hero with a tall pointy purple wizard hat with gold trim, purple robe, blond hair, holding a magic staff with a glowing crystal, ${CHAR}, confident stance` },
  hero_ranger: { h: 44, hd: 3, portrait: 8, shadow: true, role: 'hero', body: 'biped', hold: 'a dagger in each hand', prompt: `an agile female ranger huntress hero with a green hood and green cape, leather tunic, holding two daggers, ${CHAR}, ready stance` },
  hero_barbarian: {
    h: 44, hd: 3, portrait: 8, shadow: true, role: 'hero', body: 'biped', hold: 'the huge double-bladed great axe gripped with BOTH hands on the long handle',
    prompt: `a muscular barbarian hero with red hair and red beard, horned steel helmet, bare chest with fur shoulder pad, leather pants, gripping a huge double-bladed two-handed great axe with BOTH hands, ${CHAR}, fierce stance`,
    poses: { attack: 'chopping down hard with the huge great axe held in both hands: axe head low in front to the RIGHT, body leaning forward, dynamic' },
  },
  // inimigos
  slime: { h: 22, hd: 3, shadow: true, role: 'monster', body: 'blob' },
  bat: { h: 22, hd: 3, role: 'monster', body: 'flyer', prompt: `a small purple cave bat monster with big ears, open wings, fangs and glowing eyes, flying, ${CHAR}` },
  goblin: { h: 32, hd: 3, shadow: true, role: 'monster', body: 'biped', hold: 'the crude dagger in the front hand' },
  wolf: { h: 28, hd: 3, shadow: true, role: 'monster', body: 'quadruped' },
  skeleton: { h: 34, hd: 3, shadow: true, role: 'monster', body: 'biped', prompt: `a skeleton warrior monster with a rusty sword and a broken wooden shield, glowing eye sockets, ${CHAR}, walking` },
  orc: { h: 42, hd: 3, shadow: true, role: 'monster', body: 'biped', prompt: `a big brutish green orc brute monster with tusks, iron shoulder armor and a spiked wooden club, ${CHAR}, menacing` },
  // variantes elementais: troca de cor da tira da criatura base (hue: graus; faixa de matiz trocada)
  slime_fire: { variant: 'slime', hue: -95, range: [70, 170], sat: 1.1 },
  slime_water: { variant: 'slime', hue: 90, range: [70, 170] },
  goblin_earth: { variant: 'goblin', hue: -75, range: [70, 170], sat: 0.75, val: 0.9 },
  bat_air: { variant: 'bat', hue: 200, range: [230, 320], sat: 1.3, val: 1.25 },
  // Marco 3a: inimigos novos por troca de cor (sem gerar imagem)
  slime_spit: { variant: 'slime', hue: 125, range: [70, 170], sat: 1.1 },
  slime_magma: { variant: 'slime', hue: -110, range: [70, 170], sat: 1.3, val: 0.8 },
  slime_bomb: { variant: 'slime', hue: 0, range: [70, 170], sat: 0.25, val: 0.55 },
  orc_chief: { variant: 'orc', hue: -80, range: [40, 170], sat: 1.1, val: 0.9 },
  demon: {
    h: 74, hd: 3, shadow: true, wide: true, role: 'boss', body: 'biped',
    poses: {
      idle: 'standing, both hooves planted, staff held across the body',
      walk_a: 'big heavy stride: left leg stepping far forward, right leg stretched far back, body leaning forward',
      walk_b: 'big heavy stride: right leg stepping far forward, left leg stretched far back, body leaning forward',
      windup: 'winding up a ground slam: flaming staff raised high above the head with both hands, wings spread wide, roaring',
      attack: 'slamming the flaming staff down into the ground in front of it, fire bursting from the impact',
    },
  },
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
  // efeitos de ataques e reações (VFX: o jogo anima escala, giro e transparência)
  // fade: a base se dissolve (a onda se apoia numa lâmina d'água desenhada pelo jogo)
  fx_wave: { w: 64, fade: 0.22, ground: true, role: 'vfx', effect: 'this same ocean wave (same shape, size and colors as the reference)', poses: {
    f1: 'the wave with foam on the crest and a few droplets', f2: 'the same wave, the crest curled a bit further, foam rolling forward',
    f3: 'the same wave, foam spraying forward with more droplets', f4: 'the same wave, foam churning, crest slightly lower' }, prompt: `${FX}a big cartoon ocean wave crest seen from the side, curling over to the RIGHT, white foam on top and splash droplets` },
  fx_spike: { h: 28, frames: 2, ground: true, role: 'vfx', effect: 'this same rock spike (same style as the reference)', poses: {
    f1: 'the rock spike just bursting out of the ground: short, with dust and flying debris', f2: 'the rock spike fully emerged, tall and sharp, a few debris chunks falling' }, prompt: `${FX}a sharp brown rock spike erupting from the ground with small flying debris chunks` },
  fx_tornado: { h: 64, ground: true, wide_top: true, role: 'vfx', effect: 'this same tornado funnel (same shape, size and colors as the reference), spinning', poses: {
    f1: 'the funnel with swirl stripes and leaves in one position', f2: 'the same funnel, swirl stripes rotated a quarter turn, leaves moved around it',
    f3: 'the same funnel, swirl stripes rotated half a turn, leaves on the other side', f4: 'the same funnel, swirl stripes rotated three quarters, leaves moved again' }, prompt: `${FX}a cartoon tornado whirlwind funnel of pale green and white swirling wind with a few small leaves` },
  // efeitos animados (4 quadros): effect descreve o efeito; poses, cada quadro
  vfx_lava: { h: 40, role: 'vfx', wide: true, effect: 'a lava eruption bursting from cracked ground', poses: {
    f1: 'glowing orange cracks opening on the ground', f2: 'lava bursting upward in a short fountain with molten droplets',
    f3: 'lava splashing down in all directions', f4: 'a small cooling puddle of orange-red lava with smoke wisps' } },
  vfx_ice: { h: 30, role: 'vfx', wide: true, effect: 'ice crystals growing from the ground', poses: {
    f1: 'a thin ring of frost on the ground', f2: 'small sharp ice crystals sprouting in a ring', f3: 'a cluster of tall light-blue ice crystals in a ring, open in the middle',
    f4: 'the ice crystals shattering into flying shards' } },
  vfx_steam: { h: 40, role: 'vfx', wide: true, effect: 'a hot steam burst', poses: {
    f1: 'a small puff of white steam', f2: 'a bigger billowing steam cloud rising', f3: 'a tall swirling steam column', f4: 'thin fading wisps of steam' } },
  vfx_mud: { h: 24, role: 'vfx', wide: true, effect: 'a mud splash on the ground, seen from a top-down angle', poses: {
    f1: 'a blob of brown mud hitting the ground', f2: 'mud splashing outward with droplets', f3: 'a wide flat brown mud puddle with bubbles', f4: 'the same mud puddle, flatter and drier' } },
  vfx_sand: { h: 44, role: 'vfx', wide: true, effect: 'a small sandstorm whirlwind of golden sand', poses: {
    f1: 'a low swirl of sand starting on the ground', f2: 'a growing sand whirlwind', f3: 'a tall sand whirlwind with flying pebbles', f4: 'the whirlwind collapsing into falling sand' } },
  vfx_explosion: { h: 40, role: 'vfx', wide: true, effect: 'a cartoon fire explosion with crisp outlines and NO soft glow or halo around it', poses: {
    f1: 'a small bright yellow flash', f2: 'a round orange fireball blast expanding', f3: 'a big fiery explosion with flames and sparks', f4: 'dark smoke puffs with a few embers' } },
  fx_hammer: { w: 26, hd: 3, frames: 2, role: 'vfx', effect: 'this same war hammer (same shape and style as the reference)', poses: {
    f1: 'the hammer with blue lightning crackling around the head', f2: 'the same hammer, the lightning bolts in different positions' }, prompt: `a magic war hammer like a legendary thunder god hammer: short leather-wrapped handle with a wrist strap, big rectangular engraved steel head with crackling blue lightning, side view, handle pointing down` },
  fx_fireball: { w: 20, flip: true, frames: 2, role: 'vfx', effect: 'this same fireball (same style as the reference)', poses: {
    f1: 'the fireball with its flaming tail', f2: 'the same fireball, the tail flames flickering in a different shape' }, prompt: `${FX}a cartoon fireball projectile with a flaming tail, flying horizontally to the RIGHT` },
  fx_firering: { w: 96, frames: 2, role: 'vfx', effect: 'this same ring of flames (same style as the reference)', poses: {
    f1: 'the ring of flames', f2: 'the same ring, every flame at a different height and shape (flickering)' }, prompt: `${FX}a flat ring of orange and yellow flames seen from a top-down angle, empty in the middle, flames licking upward around the circle` },
  // cenário (visto de cima, estilo mapa de RPG)
  tree: { h: 72, shadow: true },
  tree2: { h: 78, shadow: true, prompt: `a single tall green pine tree with brown trunk, front view, like a top-down RPG map object` },
  bush: { h: 22, shadow: true, prompt: `a single round green leafy bush, front view, like a top-down RPG map object` },
  rock: { h: 16, shadow: true, prompt: `a single gray boulder rock with a bit of moss, front view, like a top-down RPG map object` },
  stump: { h: 16, shadow: true, prompt: `a single cut tree stump with roots, front view, like a top-down RPG map object` },
  flowers: { h: 14, prompt: `a small cluster of colorful wild flowers (white, yellow and pink) with leaves, like a top-down RPG map decoration` },
  mushroom: { h: 14, prompt: `two small red mushrooms with white spots, like a top-down RPG map decoration` },
  tallgrass: { h: 16, prompt: `a small tuft of tall green grass blades, like a top-down RPG map decoration` },
  // ---------- Pântano Enevoado (Marco 3b) ----------
  ground_swamp: { tile: true, contrast: 0.45, prompt: `a seamless tileable texture of soft swampy marsh ground seen from directly above, for a top-down RPG map: mossy teal-green grass with a few large darker damp patches. Very clean and calm: only soft, large, painterly patches. NO puddles, NO water, NO grass tufts, NO outlines, NO dots, NO objects. Even lighting, fills the whole square image edge to edge` },
  reeds: { h: 22, prompt: `a small clump of tall cattail reeds with brown fluffy tops and green leaves, like a top-down RPG map decoration` },
  swamp_tree: { h: 74, shadow: true, prompt: `a single cute twisted swamp mangrove tree with arching roots and hanging green moss, front view, like a top-down RPG map object` },
  mossy_log: { h: 16, shadow: true, prompt: `a single mossy fallen log with a tiny mushroom on it, front view, like a top-down RPG map object` },
  glowshroom: { h: 14, prompt: `a small cluster of three glowing teal-blue mushrooms, like a top-down RPG map decoration` },
  lilypond: { w: 64, prompt: `a flat small pond of dark teal water with two green lily pads and one pink lotus flower, seen from directly above, organic blob shape, like a top-down RPG map decal` },
  mud: { w: 72, prompt: `a flat irregular patch of wet dark brown mud with a few small bubbles, seen from directly above, organic blob shape, like a top-down RPG map decal` },
  frog: {
    h: 24, hd: 3, shadow: true, role: 'monster', body: 'blob',
    prompt: `a chubby round green swamp frog monster with big yellow eyes and a wide grin, ${CHAR}`,
    poses: { walk_a: 'crouched low, ready to hop', walk_mid: 'mid-hop in the air, hind legs stretched back', walk_b: 'landing, body squashed, legs spread', attack: 'shooting its long pink tongue forward to the RIGHT, mouth wide open' },
  },
  croc: {
    h: 26, hd: 3, shadow: true, wide: true, role: 'special', body: 'quadruped',
    prompt: `a chunky green swamp crocodile monster with a big toothy grin, scaly back and four short legs, ${CHAR}`,
    poses: { walk_a: 'crawling, front right leg forward', walk_mid: 'crawling, legs under the body', walk_b: 'crawling, front left leg forward', windup: 'crouched low with the tail raised, jaws closed, about to lunge', attack: 'lunging forward to the RIGHT with huge jaws wide open' },
  },
  mosquito: {
    h: 18, hd: 3, role: 'monster', body: 'flyer',
    prompt: `a small cartoon giant swamp mosquito monster with a long needle nose, striped body, big red eyes and transparent wings, flying, ${CHAR}`,
    poses: { attack: 'diving forward to the RIGHT stinging with its long needle nose' },
  },
  sporeshroom: {
    h: 26, hd: 3, shadow: true, role: 'monster', body: 'blob',
    prompt: `a cute grumpy purple mushroom monster with a white-spotted cap, a pale stem body and two little stubby feet, ${CHAR}`,
    poses: { walk_a: 'waddling, near foot forward', walk_mid: 'feet together under the body', walk_b: 'waddling, far foot forward', attack: 'puffing a cloud of green spores forward to the RIGHT from under its cap, cheeks puffed' },
  },
  frog_shaman: {
    h: 34, hd: 3, shadow: true, role: 'special', body: 'biped', hold: 'the wooden staff with the blue water orb',
    prompt: `a frog shaman monster standing upright on two legs, wearing a leaf cloak and a necklace of shells, holding a wooden staff topped with a glowing blue water orb, ${CHAR}`,
    poses: { windup: 'raising the staff high, the water orb glowing brightly', attack: 'thrusting the staff forward to the RIGHT, casting a splash of water' },
  },
  frog_king: {
    h: 70, hd: 3, shadow: true, wide: true, role: 'boss', body: 'biped',
    prompt: `a huge fat frog king boss monster with a golden crown, a royal purple cape, a big round belly and a golden scepter, ${CHAR}, menacing`,
    poses: {
      idle: 'standing proudly on its hind legs, scepter raised', walk_a: 'crouched, about to hop forward', walk_b: 'mid-hop, body stretched upward',
      windup: 'crouched very low, cheeks puffed, about to make a huge leap', attack: 'slamming down belly-first on the ground in front, a big shockwave splash',
      death: 'defeated: lying flat on its back, crown fallen beside it, X eyes',
    },
  },
  // objetos dos eventos (no lugar dos provisórios desenhados por código)
  chest: { h: 22, shadow: true, prompt: `a single closed wooden treasure chest with gold trim and a golden lock, front view, like a top-down RPG map object` },
  bomb: { h: 16, prompt: `a single round black cartoon bomb with a short lit fuse sparkling, like a top-down RPG map item` },
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
  icon_water: { h: 16, hd: 4, prompt: `${ICON}: a swirling blue water droplet with a splash` },
  icon_quake: { h: 16, hd: 4, prompt: `${ICON}: cracked brown ground split open by a fissure with rocks bursting out` },
  icon_tornado: { h: 16, hd: 4, prompt: `${ICON}: a pale green and white tornado swirl` },
  icon_laser: { h: 16, hd: 4, prompt: `${ICON}: a bright golden-white beam of light zigzagging between two small mirrors` },
  icon_hammer: { h: 16, hd: 4, prompt: `${ICON}: a legendary thunder god war hammer with a short handle and a big rectangular steel head crackling with blue lightning` },
  icon_greataxe: { h: 16, hd: 4, prompt: `${ICON}: a huge double-bladed two-handed great axe with a long handle` },
  icon_fireball: { h: 16, hd: 4, prompt: `${ICON}: a blazing round fireball with a flaming tail` },
  icon_tremor: { h: 16, hd: 4, prompt: `${ICON}: a brown leather boot stomping on cracked ground with rocks flying` },
  icon_element: { h: 16, hd: 4, prompt: `${ICON}: a magic orb split into four colored quarters: red fire, blue water, green wind and brown earth` },
};

/**
 * Poses das folhas de um personagem animado: `move` (folha <nome>_sheet) e `actions` (folhas
 * <nome>_action, <nome>_action2...), cada uma uma lista [{ slot, text }]. Toda folha de ação começa com a
 * pose de calibragem (o 1º quadro de movimento), que serve só para igualar a escala das folhas.
 * Figuras grandes (`wide`) levam no máximo 2 poses por folha de ação, para não se amontoarem.
 */
export function sheets(a) {
  const t = a.frames ? { ...FRAME_TEMPLATES[a.role], move: FRAME_TEMPLATES[a.role].move.slice(0, a.frames) } : FRAME_TEMPLATES[a.role];
  const pose = (slot) => {
    const text = a.poses?.[slot] ?? (a.role === 'hero' ? RUN[slot] : undefined) ?? POSES[a.body]?.[slot];
    // na morte a arma cai: não repete o que ele segura
    return { slot, text: a.hold && slot !== 'death' ? `${text}, holding ${a.hold}` : text };
  };
  const per = a.wide ? 2 : 3;
  const actions = [];
  for (let i = 0; i < t.action.length; i += per) actions.push([t.move[0], ...t.action.slice(i, i + per)].map(pose));
  return { move: t.move.map(pose), actions };
}
