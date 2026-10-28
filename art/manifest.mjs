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
// edit: a imagem base sai da edição da imagem desta outra arte (prompt = a mudança); as folhas seguem a nova base.
// ref: imagem de referência no lugar do cavaleiro (ex. a evolução de um pet parte do estágio anterior).
// pro: usa o modelo Pro mesmo sem modelo de quadros (criaturas animadas só por código, como os pets).
// variant: cópia de outra criatura com a cor trocada (hue: graus somados à matiz dentro de range; sat/val: multiplicadores).
// wide: folhas em formato 21:9 (figuras grandes, com asas, que se encostariam no formato padrão).
// ground: efeito apoiado no chão (quadros alinhados pela base, não pelo centro).
// frames: quantos quadros o efeito tem (padrão 4; mínimo 2).
// soften: chão com contornos finos da IA, apagados no processamento (tamanho do filtro).
// fadeRight: quadros cuja ponta direita some aos poucos (ex. labareda do ataque cortada na borda), com a fração da largura.
// mirror: quadros de personagem desenhados virados para a esquerda, espelhados no processamento.
// facing: efeito com direção; quadros virados para o lado contrário do 1º são espelhados no processamento.
// wideSheets: folhas em 21:9 sem mudar a quantidade de quadros por folha (asas abertas).
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
  // criatura parada no mapa que acorda (gárgula de pedra, mímico): o descanso é a estátua / o baú fechado
  sleeper: { move: ['idle', 'walk_a', 'walk_b'], action: ['windup', 'attack', 'hurt', 'death'] },
  // herói: ciclo de corrida completo (pé de perto à frente, passagem, pé de longe à frente)
  // ataque em 3 tempos: preparar (windup), golpe (attack) e acompanhamento do golpe (follow)
  hero: { move: ['idle', 'walk_a', 'walk_mid', 'walk_b'], action: ['attack', 'hurt', 'death', 'victory', 'windup', 'follow'] },
  // pet: uma folha só com 2 quadros de movimento, preparar e atacar (animado também por código)
  pet: { move: ['walk_a', 'walk_b', 'windup', 'attack'], action: [] },
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
  follow: 'follow-through right after the strike: the weapon swung all the way through to the low front, body twisted forward, dynamic',
};
// heróis correm (mais tempo de tela e mais energia): mesmo ciclo de pés, corpo em posição de corrida
const RUN = {
  walk_a: 'running fast, body leaning forward: the NEAR leg (closest to the viewer) reaching forward, the FAR leg pushing off behind, arms pumping opposite to the legs',
  walk_mid: 'running fast, body leaning forward: passing pose, one foot under the body and the other knee lifted high',
  walk_b: 'running fast, body leaning forward: the FAR leg reaching forward, the NEAR leg pushing off behind, the opposite legs of the other stride frame',
};

// poses dos pets (o ataque descrito por linhagem)
const PET_FLYER = (attack) => ({
  walk_a: 'flying, hovering in the air with wings raised high',
  walk_b: 'flying, hovering in the air with wings pushed down low',
  windup: 'rearing back and inhaling, head pulled back, chest puffed, about to attack',
  attack: `attacking to the RIGHT: ${attack}, body lunging forward`,
});
const PET_WALK = (attack) => ({
  walk_a: 'walking: the near legs stepping forward, the far legs back',
  walk_b: 'walking: the far legs stepping forward, the near legs back, the opposite stride',
  windup: 'crouching low and leaning back, gathering power, about to attack',
  attack: `attacking to the RIGHT: ${attack}, body lunging forward`,
});
const PET_BLOB = (attack) => ({
  walk_a: 'bouncing: squashed flat against the ground',
  walk_b: 'bouncing: stretched tall in mid-hop',
  windup: 'puffing up round and big, eyes squinting, about to attack',
  attack: `attacking to the RIGHT: ${attack}, body leaning forward`,
});

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
    poses: {
      attack: 'slashing the sword forward to the RIGHT in a wide arc, shield held up in front of the body, dynamic',
      windup: 'coiling to strike: the sword raised high behind the shoulder, shield forward, weight on the back foot',
      follow: 'follow-through after the slash: the sword swept all the way down to the lower front, shield still up, body leaning forward',
    },
  },
  hero_mage: { h: 44, hd: 3, portrait: 8, shadow: true, role: 'hero', body: 'biped', hold: 'the tall magic staff with the glowing purple crystal firmly in the front hand', poses: { windup: 'pulling the staff back, gathering glowing purple magic at the crystal, robe swirling', follow: 'staff thrust forward to the RIGHT, a burst of purple magic sparkles released from the crystal' }, prompt: `a young female mage hero with a tall pointy purple wizard hat with gold trim, purple robe, blond hair, holding a magic staff with a glowing crystal, ${CHAR}, confident stance` },
  hero_ranger: { h: 44, hd: 3, portrait: 8, shadow: true, role: 'hero', body: 'biped', hold: 'a dagger in each hand', poses: { windup: 'crouched low, both daggers drawn back and crossed, ready to lunge', follow: 'after a lunge to the RIGHT: both daggers extended forward, body stretched low' }, prompt: `an agile female ranger huntress hero with a green hood and green cape, leather tunic, holding two daggers, ${CHAR}, ready stance` },
  hero_barbarian: {
    h: 44, hd: 3, portrait: 8, shadow: true, role: 'hero', body: 'biped', hold: 'the huge double-bladed great axe gripped with BOTH hands on the long handle',
    prompt: `a muscular barbarian hero with red hair and red beard, horned steel helmet, bare chest with fur shoulder pad, leather pants, gripping a huge double-bladed two-handed great axe with BOTH hands, ${CHAR}, fierce stance`,
    poses: {
      attack: 'chopping down hard with the huge great axe held in both hands: axe head low in front to the RIGHT, body leaning forward, dynamic',
      windup: 'the huge great axe raised high over the head with both hands, back arched, ready to chop',
      follow: 'follow-through after the chop: the great axe buried low in the ground in front, knees bent, body hunched forward',
    },
  },
  // pets: Bebê, Criança, Jovem, Adulto e Supremo, cada estágio maior (14, 22, 34, 52 e 84 px de altura: o Supremo tem o porte de um chefe). Cada forma tem a imagem base e uma
  // folha com 2 quadros de movimento, preparar e atacar. As evoluções partem da forma anterior.
  pet_fire_1: {
    h: 14, hd: 4, role: 'pet', ref: 'pet_dragon_1', poses: PET_BLOB('a tiny spark of fire spat forward'),
    prompt: `the BABY form of the dragon in the reference image: a tiny round bouncy blob of warm red-orange body with big cute shiny eyes, a little flame tuft on top of the head and a tiny flame tail, no wings, no legs, same colors and art style, ${CHAR}`,
  },
  pet_dragon_1: { h: 22, hd: 4, role: 'pet', poses: PET_FLYER('a small fireball spat from the mouth'), prompt: `a tiny adorable baby red dragon pet hatchling with big shiny eyes, stubby little wings, a round belly and a small flame-tipped tail, ${CHAR}` },
  pet_dragon_2: {
    h: 34, hd: 4, role: 'pet', ref: 'pet_dragon_1', poses: PET_FLYER('a big fireball spat from the mouth'),
    prompt: `the SAME red dragon from the reference image, grown into a young teen dragon: longer neck and tail, bigger wings, small horns, a few golden belly scales, still cute, same colors and art style, ${CHAR}`,
  },
  pet_dragon_3: {
    h: 52, hd: 4, role: 'pet', ref: 'pet_dragon_2', fadeRight: { attack: 0.3 }, poses: PET_FLYER('a wide stream of fire breathed from the mouth'),
    prompt: `the SAME red dragon from the reference image, now fully grown into a majestic adult dragon companion: large spread wings, curved golden horns, spiked back, glowing ember-orange eyes and small flames around the mouth, heroic and powerful but still friendly-looking, same colors and art style, ${CHAR}`,
  },
  pet_fire_5: {
    h: 84, hd: 4, role: 'pet', wideSheets: true, ref: 'pet_dragon_3', fadeRight: { attack: 0.3 }, poses: PET_FLYER('a huge blazing sun-fire blast breathed from the mouth'),
    prompt: `the SAME dragon from the reference image evolved into its ultimate legendary form, a sun dragon king: radiant golden armor plates over red scales, a blazing golden sun crest ring behind its head, two pairs of great wings with flaming edges, a long tail ending in a sun flame, glowing golden eyes, epic and majestic but still recognizably the same dragon, same art style, ${CHAR}`,
  },
  // linhagem da Água
  pet_water_1: { h: 14, hd: 4, role: 'pet', poses: PET_BLOB('a tiny bubble spat forward'), prompt: `a tiny round baby water droplet blob creature with big cute shiny eyes, light blue translucent body and a little wave curl on top, no limbs, ${CHAR}` },
  pet_water_2: { h: 22, hd: 4, role: 'pet', ref: 'pet_water_1', poses: PET_WALK('a jet of water spat from the mouth'), prompt: `the SAME creature from the reference image, evolved: a small cute baby sea turtle with a blue shell with a wave pattern, big eyes, walking on four stubby legs, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_water_3: { h: 34, hd: 4, role: 'pet', ref: 'pet_water_2', poses: PET_WALK('a big water orb spat from the mouth'), prompt: `the SAME creature from the reference image, evolved: a young sea turtle grown bigger: coral spikes on its blue shell, fins with white foam tips, a determined look, walking on four legs, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_water_4: { h: 52, hd: 4, role: 'pet', ref: 'pet_water_3', poses: PET_WALK('a jet of water blasting from the shell cannons'), prompt: `the SAME creature from the reference image, evolved: a large armored sea-turtle dragon: long neck, coral horns, fins, a thick blue shell with two water spout cannons, water flowing around its feet, powerful, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_water_5: { h: 84, hd: 4, role: 'pet', wideSheets: true, ref: 'pet_water_4', poses: PET_WALK('a giant whirling tidal blast from the mouth'), prompt: `the SAME creature from the reference image, evolved: its ultimate legendary form, the abyssal emperor: a colossal majestic sea-turtle dragon with a crown of coral and pearls, glowing cyan bioluminescent markings, a shell like an ocean fortress, swirling water around it, epic, still recognizably the same creature, same colors and art style, ${CHAR}` },
  // linhagem do Ar
  pet_air_1: { h: 14, hd: 4, role: 'pet', poses: PET_BLOB('a tiny puff of wind blown forward'), prompt: `a tiny round fluffy baby puffball of pale green and white feathers with big cute eyes and two tiny wing nubs, floating, ${CHAR}` },
  pet_air_2: { h: 22, hd: 4, role: 'pet', ref: 'pet_air_1', poses: PET_FLYER('a gust of wind blown from the beak'), prompt: `the SAME creature from the reference image, evolved: a small cute owl chick with pale green and white feathers, big round eyes and little wings, flying, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_air_3: { h: 34, hd: 4, role: 'pet', ref: 'pet_air_2', poses: PET_FLYER('a sharp crescent wind blade flapped forward'), prompt: `the SAME creature from the reference image, evolved: a young wind hawk with sleek green and white wind-swept feathers, sharp eyes and swirling wind trails on the wingtips, flying, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_air_4: { h: 52, hd: 4, role: 'pet', ref: 'pet_air_3', poses: PET_FLYER('a swirling wind blast flapped from the wings'), prompt: `the SAME creature from the reference image, evolved: a storm griffin: eagle head and wings with green-white storm feathers, lion body, small sparks of lightning in its feathers, flying, powerful, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_air_5: { h: 84, hd: 4, role: 'pet', wideSheets: true, ref: 'pet_air_4', poses: PET_FLYER('a huge storm vortex blasted from the wings'), prompt: `the SAME creature from the reference image, evolved: DRAMATICALLY transformed into its ultimate form, a colossal celestial roc: a giant majestic BIRD (no lion body) with FOUR huge wings of glowing white-green feathers with golden tips, long flowing tail plumes like ribbons of wind, a golden crown crest, golden armor on the chest, swirling wind rings around it; clearly a new grander form, still recognizably the same creature, same colors and art style, ${CHAR}` },
  // linhagem da Terra
  pet_earth_1: { h: 14, hd: 4, role: 'pet', poses: PET_BLOB('a tiny pebble spat forward'), prompt: `a tiny round baby pebble blob creature, grey-brown stone body with big cute eyes and a tiny green sprout on top, no limbs, ${CHAR}` },
  pet_earth_2: { h: 22, hd: 4, role: 'pet', ref: 'pet_earth_1', poses: PET_WALK('a small rock thrown forward with both hands'), prompt: `the SAME creature from the reference image, evolved: a tiny cute rock golem toddler with a round stone body, stubby stone arms and legs, big eyes, a little leaf sprout on its head, walking on two legs, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_earth_3: { h: 34, hd: 4, role: 'pet', ref: 'pet_earth_2', poses: PET_WALK('a heavy rock punch slammed forward'), prompt: `the SAME creature from the reference image, evolved: a sturdy young rock golem with mossy patches and glowing amber cracks, bigger fists, walking on two legs, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_earth_4: { h: 52, hd: 4, role: 'pet', ref: 'pet_earth_3', poses: PET_WALK('a huge crystal fist slammed into the ground'), prompt: `the SAME creature from the reference image, evolved: a big crystal colossus golem: rock body with large glowing amber crystal formations growing from its shoulders and fists, walking on two legs, powerful, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_earth_5: { h: 84, hd: 4, role: 'pet', wideSheets: true, ref: 'pet_earth_4', poses: PET_WALK('a colossal earth-shattering stomp and punch'), prompt: `the SAME creature from the reference image, evolved: DRAMATICALLY transformed into its ultimate form, a towering ancient titan: body of polished dark stone fused with ornate GOLD armor plates, glowing cyan runes carved all over, a huge crown of amber crystals, a mantle of moss and vines, a ring of floating rocks orbiting around it, massive shoulders; clearly a new grander form, not just the same golem, still recognizably the same creature, same colors and art style, ${CHAR}` },
  // linhagem da Luz
  pet_light_1: { h: 14, hd: 4, role: 'pet', poses: PET_BLOB('a tiny sparkle of light'), prompt: `a tiny glowing golden light orb spirit with big cute eyes and a little star sparkle on top, floating, no limbs, ${CHAR}` },
  pet_light_2: { h: 22, hd: 4, role: 'pet', ref: 'pet_light_1', poses: PET_FLYER('a small sparkle of light cast from the wand'), prompt: `the SAME creature from the reference image, evolved: a tiny cute fairy girl with dragonfly wings, a yellow and white dress, golden hair, holding a little glowing star wand, flying, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_light_3: { h: 34, hd: 4, role: 'pet', ref: 'pet_light_2', poses: PET_FLYER('a beam of light cast from the staff'), prompt: `the SAME creature from the reference image, evolved: clearly older and different: a TEENAGE light fairy, noticeably taller and more elegant, with FOUR large shimmering golden wings, a flowing white and gold robe, long golden hair with a star tiara, holding a tall staff topped with a glowing star, flying, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_light_4: { h: 52, hd: 4, role: 'pet', ref: 'pet_light_3', poses: PET_FLYER('a radiant spear of light thrown forward'), prompt: `the SAME creature from the reference image, evolved: an angelic warrior maiden: white and gold armor, a glowing halo, four feathered white-gold wings, a spear of light, flying, powerful, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_light_5: { h: 84, hd: 4, role: 'pet', wideSheets: true, ref: 'pet_light_4', poses: PET_FLYER('a compact burst of holy light right at the tip of the sword swung forward, the light touching the sword (not a separate beam)'), prompt: `the SAME creature from the reference image, evolved: DRAMATICALLY transformed into its ultimate form, a radiant archangel: SIX huge glowing golden wings, ornate golden full plate armor with white gems, a blazing sun halo behind the head, a flaming holy greatsword of light, a flowing white cape; clearly far more powerful and majestic than the reference, still recognizably the same creature, same colors and art style, ${CHAR}` },
  // linhagem da Sombra
  pet_dark_1: { h: 14, hd: 4, role: 'pet', poses: PET_BLOB('a tiny shadow swipe'), prompt: `a tiny round baby shadow blob creature, dark purple-black wispy body with little cat ears and big glowing yellow eyes, no limbs, ${CHAR}` },
  pet_dark_2: { h: 22, hd: 4, role: 'pet', ref: 'pet_dark_1', poses: PET_WALK('a quick paw swipe with shadow claws'), prompt: `the SAME creature from the reference image, evolved: a small cute dark purple kitten with big glowing yellow eyes and a wispy shadow tail, walking on four legs, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_dark_3: { h: 34, hd: 4, role: 'pet', ref: 'pet_dark_2', poses: PET_WALK('a pouncing shadow-claw slash'), prompt: `the SAME creature from the reference image, evolved: now a sleek long-legged young PANTHER, no longer a kitten: muscular long body, long tail, glowing violet stripe markings, sharp yellow eyes, small fangs, prowling on four legs, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_dark_4: { h: 52, hd: 4, role: 'pet', ref: 'pet_dark_3', poses: PET_WALK('a lunging bite with dark energy'), prompt: `the SAME creature from the reference image, evolved: a large eclipse wolf: dark purple fur, shadowy flowing mane, a glowing crescent moon mark on its forehead, yellow eyes, walking on four legs, powerful, still recognizably the same creature, same colors and art style, ${CHAR}` },
  pet_dark_5: { h: 84, hd: 4, role: 'pet', wideSheets: true, ref: 'pet_dark_4', poses: PET_WALK('a devastating eclipse claw slash'), prompt: `the SAME creature from the reference image, evolved: its ultimate legendary form, the eclipse lord: a colossal majestic shadow beast part wolf part panther, with a black sun ring with a golden corona floating behind it, shadow flames, dark armor plates, epic, still recognizably the same creature, same colors and art style, ${CHAR}` },
  egg_turtle: { h: 18, hd: 4, shadow: true, prompt: `${ICON}: a light blue egg with a white wave pattern and small bubbles` },
  egg_owl: { h: 18, hd: 4, shadow: true, prompt: `${ICON}: a pale green egg with soft white feather markings and a small swirl` },
  egg_golem: { h: 18, hd: 4, shadow: true, prompt: `${ICON}: a grey stone egg with glowing amber cracks and a tiny sprout` },
  egg_fairy: { h: 18, hd: 4, shadow: true, prompt: `${ICON}: a glowing golden egg with small white stars and a soft shine` },
  egg_cat: { h: 18, hd: 4, shadow: true, prompt: `${ICON}: a dark purple egg with violet wisps and two glowing yellow eye-shaped spots` },
  // projéteis dos pets (2 quadros)
  fx_water_orb: { w: 14, flip: true, facing: true, frames: 2, role: 'vfx', effect: 'this same water orb (same style as the reference)', poses: { f1: 'the water orb with a small splash trail behind', f2: 'the same orb, the trail droplets in other positions' }, prompt: `${FX}a glossy blue water orb projectile with a splashing droplet trail, flying to the RIGHT` },
  fx_wind_blade: { w: 18, flip: true, facing: true, frames: 2, role: 'vfx', effect: 'this same wind blade (same style as the reference)', poses: { f1: 'the crescent wind blade with small swirls', f2: 'the same blade, the swirls rotated' }, prompt: `${FX}a pale green crescent wind blade projectile with white swirl lines, flying to the RIGHT, the effect alone with NO character or person (do not draw the character from the reference)` },
  fx_rock: { w: 12, frames: 2, role: 'vfx', effect: 'this same rock (same style as the reference)', poses: { f1: 'the rock with a few dust specks', f2: 'the same rock rotated a quarter turn' }, prompt: `${FX}a chunky brown rock with small amber crystal bits, a thrown projectile` },
  fx_light_orb: { w: 14, facing: true, frames: 2, role: 'vfx', effect: 'this same light orb (same style as the reference)', poses: { f1: 'the light orb with a short sparkle trail', f2: 'the same orb, sparkles in other positions' }, prompt: `${FX}a radiant golden-white light orb projectile with a sparkling star trail, flying to the RIGHT` },
  fx_shadow_claw: { w: 22, facing: true, frames: 2, role: 'vfx', effect: 'this same claw slash (same style as the reference)', poses: { f1: 'three purple claw slash marks', f2: 'the same slash marks fading at the edges with dark wisps' }, prompt: `${FX}three curved dark purple shadow claw slash marks with violet glow and black wisps, the effect alone with NO character or person (do not draw the character from the reference)` },
  egg_dragon: { h: 18, hd: 4, shadow: true, prompt: `${ICON}: a speckled red and orange dragon egg with small golden spots and a faint glowing crack` },
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
  proj_bolt: { w: 16, flip: true, prompt: `a magic energy bolt projectile, glowing purple and pink arcane fireball with a short sparkling tail, flying horizontally to the RIGHT` },
  proj_knife: { w: 16, prompt: `a single steel throwing dagger lying horizontally, blade pointing to the RIGHT` },
  proj_axe: { h: 16, prompt: `a single spinning throwing battle axe with wooden handle and steel blade` },
  proj_orb: { h: 16 },
  // efeitos de ataques e reações (VFX: o jogo anima escala, giro e transparência)
  // fade: a base se dissolve (a onda se apoia numa lâmina d'água desenhada pelo jogo)
  fx_wave: { w: 64, facing: true, fade: 0.22, ground: true, role: 'vfx', effect: 'this same ocean wave (same shape, size and colors as the reference)', poses: {
    f1: 'the wave with foam on the crest and a few droplets', f2: 'the same wave, the crest curled a bit further, foam rolling forward',
    f3: 'the same wave, foam spraying forward with more droplets', f4: 'the same wave, foam churning, crest slightly lower' }, prompt: `${FX}a big cartoon ocean wave crest seen from the side, curling over to the RIGHT, white foam on top and splash droplets` },
  fx_spike: { h: 28, frames: 2, ground: true, role: 'vfx', effect: 'this same rock spike (same style as the reference)', poses: {
    f1: 'the rock spike just bursting out of the ground: short, with dust and flying debris', f2: 'the rock spike fully emerged, tall and sharp, a few debris chunks falling' }, prompt: `${FX}a sharp brown rock spike erupting from the ground with small flying debris chunks` },
  fx_tornado: { h: 64, ground: true, wide_top: true, role: 'vfx', effect: 'this same tornado funnel (same shape, size and colors as the reference), spinning', poses: {
    f1: 'the funnel with swirl stripes and leaves in one position', f2: 'the same funnel, swirl stripes rotated a quarter turn, leaves moved around it',
    f3: 'the same funnel, swirl stripes rotated half a turn, leaves on the other side', f4: 'the same funnel, swirl stripes rotated three quarters, leaves moved again' }, prompt: `${FX}a cartoon tornado whirlwind funnel of pale green and white swirling wind with a few small leaves` },
  fx_avalanche: { h: 72, facing: true, ground: true, wideSheets: true, frames: 3, role: 'vfx', effect: 'this same avalanche snow wall (same shape, size and colors as the reference), rolling forward', poses: {
    f1: 'the snow wall with billowing powder clouds and tumbling ice chunks and rocks at the front', f2: 'the same snow wall, the powder clouds rolled forward a bit, the chunks rotated to new positions',
    f3: 'the same snow wall, clouds churning and spraying snow forward, chunks bouncing' }, prompt: `${FX}a huge cartoon avalanche: a tall rolling wall of white powder snow with soft blue shading, crashing to the RIGHT, big billowing snow clouds on top, chunks of blue ice and grey rocks tumbling at its front edge, side view, bold dark outlines` },
  blood_moon: { h: 56, hd: 3, prompt: `${FX}a huge ominous blood red full moon with darker red craters and a thin glowing crimson rim, slightly cracked, menacing, perfectly round, no clouds` },
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
  fx_hammer: { w: 26, facing: true, hd: 3, frames: 2, role: 'vfx', effect: 'this same war hammer (same shape and style as the reference)', poses: {
    f1: 'the hammer with blue lightning crackling around the head', f2: 'the same hammer, the lightning bolts in different positions' }, prompt: `a magic war hammer like a legendary thunder god hammer: short leather-wrapped handle with a wrist strap, big rectangular engraved steel head with crackling blue lightning, side view, handle pointing down` },
  fx_fireball: { w: 20, flip: true, facing: true, frames: 2, role: 'vfx', effect: 'this same fireball (same style as the reference)', poses: {
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
  // ---------- Dunas Escaldantes (Marco 3c) ----------
  ground_dunes: { tile: true, contrast: 0.5, prompt: `a seamless tileable texture of warm golden desert sand seen from directly above, for a top-down RPG map: soft large painterly patches of slightly lighter and darker sand, very gentle wind ripples. Very clean and calm. NO rocks, NO plants, NO footprints, NO outlines, NO dots, NO objects. Even lighting, fills the whole square image edge to edge` },
  cactus: { h: 30, shadow: true, prompt: `a single cute green saguaro cactus with two arms and a small pink flower, front view, like a top-down RPG map object` },
  desert_rock: { h: 20, shadow: true, prompt: `a single orange-red sandstone desert rock with layered stripes, front view, like a top-down RPG map object` },
  bones: { h: 12, prompt: `a small cartoon animal skull and a couple of bones half buried in sand, like a top-down RPG map decoration` },
  dry_bush: { h: 14, prompt: `a small round dry desert shrub tumbleweed, light brown, like a top-down RPG map decoration` },
  palm: { h: 76, shadow: true, prompt: `a single cute desert palm tree with a slightly curved trunk and green fronds, front view, like a top-down RPG map object` },
  quicksand: { w: 72, prompt: `a flat irregular patch of swirling darker quicksand with a spiral pattern, seen from directly above, organic blob shape, like a top-down RPG map decal` },
  scorpion: {
    h: 22, hd: 3, shadow: true, wide: true, role: 'monster', body: 'quadruped',
    prompt: `a chunky orange desert scorpion monster with big pincers and a curled stinger tail, angry eyes, ${CHAR}`,
    poses: { walk_a: 'scuttling, front legs forward', walk_mid: 'scuttling, legs under the body', walk_b: 'scuttling, back legs forward', attack: 'striking forward to the RIGHT with the stinger tail and pincers snapping' },
  },
  vulture: {
    // wideSheets: folhas em 21:9 (as asas abertas se encostavam), mantendo 3 quadros por folha
    h: 22, hd: 3, role: 'monster', body: 'flyer', wideSheets: true,
    prompt: `a scrawny cartoon desert vulture monster with a bald pink head, hooked beak and ragged brown wings, flying, ${CHAR}`,
    poses: { attack: 'diving forward to the RIGHT with talons out and beak open' },
  },
  cactus_spitter: {
    h: 28, hd: 3, shadow: true, role: 'monster', body: 'blob',
    prompt: `a grumpy round green cactus monster with sharp needles, a small flower on top and two stubby feet, ${CHAR}`,
    poses: { walk_a: 'waddling, near foot forward', walk_mid: 'feet together under the body', walk_b: 'waddling, far foot forward', attack: 'shooting a spray of needles forward to the RIGHT, cheeks puffed' },
  },
  sandworm: {
    h: 34, hd: 3, shadow: true, role: 'special', body: 'blob',
    prompt: `a big segmented sandy-beige desert worm monster rising from the sand, round mouth full of teeth, small eyes, ${CHAR}`,
    poses: {
      walk_a: 'slithering on the surface, body curved low, no sand block or ground under it', walk_mid: 'slithering, body raised in an S curve, no ground under it', walk_b: 'slithering, body stretched forward, no ground under it',
      windup: 'burrowing head-first down into a mound of sand, only the tail sticking out', attack: 'erupting up from a burst of sand with its toothy mouth wide open',
    },
  },
  lizard_shaman: {
    h: 34, hd: 3, shadow: true, role: 'special', body: 'biped', hold: 'the bone staff with the swirling green wind gem',
    prompt: `a desert lizard shaman monster standing upright on two legs, wearing a tribal sand-colored robe and feather headdress, holding a bone staff topped with a swirling green wind gem, ${CHAR}`,
    poses: { windup: 'raising the staff high, a small whirlwind forming around the gem', attack: 'thrusting the staff forward to the RIGHT, releasing a gust of wind' },
  },
  scorpion_emperor: {
    h: 66, hd: 3, shadow: true, wide: true, role: 'boss', body: 'quadruped',
    prompt: `a giant armored golden scorpion emperor boss monster with huge pincers, a crown-like crest and a glowing purple stinger tail, ${CHAR}, menacing`,
    poses: {
      idle: 'standing tall, pincers raised, tail curled high', walk_a: 'scuttling, front legs forward', walk_b: 'scuttling, back legs forward',
      windup: 'rearing back with the glowing stinger raised high, about to strike', attack: 'slamming the stinger down into the ground in front, a burst of sand',
    },
  },
  // ---------- Floresta Sombria (a clareira anos depois: escura, corrompida) ----------
  // a imagem gerada fazia anéis repetidos; o chão é a grama da Clareira, escura e sem cor (a mesma clareira, anos depois)
  ground_dark: { tile: true, regrade: { from: 'ground', sat: 0.35, tint: [0x70, 0x88, 0x98] }, prompt: `a seamless tileable texture of a dark gloomy forest floor seen from directly above, for a top-down RPG map: deep desaturated blue-green moss with soft large patches of dark brown dead leaves. Very clean and calm: only soft, large, painterly patches. NO individual leaves, NO roots, NO outlines, NO dots, NO objects. Even lighting, fills the whole square image edge to edge` },
  dead_tree: { h: 74, shadow: true, prompt: `a single cute spooky dead tree with a twisted dark gray trunk, bare crooked branches and a hollow knot like a sad face, front view, like a top-down RPG map object` },
  thorn_bush: { h: 16, shadow: true, prompt: `a single small dark purple thorny bramble bush with sharp thorns, front view, like a top-down RPG map object` },
  gravestone: { h: 20, shadow: true, prompt: `a single old cracked rounded stone gravestone with moss and a small crooked cross carved on it, front view, like a top-down RPG map object` },
  cobweb: { w: 40, prompt: `a flat white spider web stretched between nothing, seen from directly above, round and slightly torn, like a top-down RPG map decal` },
  cursed_shrine: { h: 40, shadow: true, prompt: `a single small ruined stone shrine altar with a glowing purple cursed crystal on top and cracked pillars, front view, like a top-down RPG map object` },
  werewolf: {
    // mirror: o quadro de dano veio com o focinho para a esquerda
    h: 38, hd: 3, shadow: true, role: 'special', body: 'biped', mirror: ['hurt'],
    prompt: `a hunched gray werewolf monster standing on two legs, shaggy fur, glowing yellow eyes, big claws, torn purple pants, ${CHAR}`,
    poses: { windup: 'crouched low on all fours, claws dug in, snarling, about to pounce', attack: 'leaping forward to the RIGHT with claws out and jaws wide open' },
  },
  wisp: {
    h: 20, hd: 3, role: 'monster', body: 'flyer',
    prompt: `a small cute spooky ghost wisp monster made of pale cyan ghostly flame with a wispy tail, two big hollow eyes, floating, ${CHAR}`,
    poses: { walk_a: 'floating, tail curled up', walk_mid: 'floating, tail straight behind', walk_b: 'floating, tail curled down', attack: 'lunging forward to the RIGHT with a wide ghostly mouth, flames flaring' },
  },
  spider: {
    h: 22, hd: 3, shadow: true, role: 'monster', body: 'quadruped',
    prompt: `a chunky dark purple forest spider monster with eight striped legs, a round fuzzy abdomen with a glowing green mark and many shiny eyes, ${CHAR}`,
    poses: { walk_a: 'scuttling, front legs reaching forward', walk_mid: 'scuttling, legs under the body', walk_b: 'scuttling, back legs pushing', attack: 'rearing up and shooting a glob of sticky white web forward to the RIGHT' },
  },
  witch: {
    h: 36, hd: 3, shadow: true, role: 'special', body: 'biped', hold: 'the gnarled wooden staff with the crackling yellow lightning crystal',
    prompt: `a creepy old forest witch monster with green skin, a tattered dark purple pointy hat and robe, a long nose, holding a gnarled wooden staff topped with a crackling yellow lightning crystal, ${CHAR}`,
    poses: { windup: 'raising the staff high, lightning crackling around the crystal', attack: 'pointing the staff forward to the RIGHT, casting a bolt of lightning' },
  },
  ancient_ent: {
    h: 76, hd: 3, shadow: true, wide: true, role: 'boss', body: 'biped',
    prompt: `a giant corrupted ancient tree ent boss monster walking on root legs, dark twisted bark, glowing purple cracks and eyes, crooked branch arms with claws, a few dead leaves, ${CHAR}, menacing`,
    poses: {
      idle: 'standing tall, branch arms spread, roaring', walk_a: 'stomping, near root leg forward', walk_b: 'stomping, far root leg forward',
      windup: 'raising both branch arms high above its head, purple energy gathering', attack: 'slamming both branch arms down into the ground in front, roots bursting up',
    },
  },
  // ---------- Clareira: chefe final (o Demônio Ancestral fica para fases avançadas) ----------
  goblin_king: {
    h: 64, hd: 3, shadow: true, wide: true, role: 'boss', body: 'biped', hold: 'the huge spiked wooden club in one hand',
    prompt: `a fat cartoon goblin king boss with green skin, a big golden crown, a red royal cape with white fur trim, a pot belly and a huge spiked wooden club, ${CHAR}, menacing but fun`,
    poses: {
      idle: 'standing proud, club resting on the shoulder', walk_a: 'stomping, near foot forward', walk_b: 'stomping, far foot forward',
      windup: 'raising the club high over the head with both hands', attack: 'smashing the club down on the ground in front, a burst of dust',
    },
  },
  // ---------- Pico Congelado (frio, sombrio) ----------
  ground_snow: { tile: true, contrast: 0.45, prompt: `a seamless tileable texture of soft fresh snow ground seen from directly above, for a top-down RPG map: white snow with soft large pale blue shadows. Very clean and calm: only soft, large, painterly patches. NO footprints, NO rocks, NO outlines, NO dots, NO objects. Even lighting, fills the whole square image edge to edge` },
  snow_pine: { h: 76, shadow: true, prompt: `a single cute pine tree covered in thick snow, front view, like a top-down RPG map object` },
  ice_crystal: { h: 26, shadow: true, prompt: `a single cluster of glowing pale blue ice crystals sticking out of the snow, front view, like a top-down RPG map object` },
  snow_rock: { h: 20, shadow: true, prompt: `a single gray boulder with a cap of snow on top, front view, like a top-down RPG map object` },
  snowdrift: { h: 14, prompt: `a small soft mound of snow with a few tiny ice sparkles, like a top-down RPG map decoration` },
  frozen_log: { h: 16, shadow: true, prompt: `a single fallen log covered in frost and small icicles, front view, like a top-down RPG map object` },
  ice_patch: { w: 76, prompt: `a flat irregular patch of slippery smooth blue ice with white glints and thin cracks, seen from directly above, organic blob shape, like a top-down RPG map decal` },
  yeti: {
    h: 38, hd: 3, shadow: true, role: 'monster', body: 'biped',
    prompt: `a big furry white yeti monster with blue face, small horns, long arms and big fists, ${CHAR}`,
    poses: { attack: 'swinging a huge fist forward to the RIGHT, roaring' },
  },
  snow_golem: {
    h: 34, hd: 3, shadow: true, role: 'monster', body: 'biped',
    prompt: `a chunky snow golem monster made of packed snowballs with ice chunk arms, coal eyes and a carrot nose, ${CHAR}`,
    poses: { attack: 'throwing a big snowball forward to the RIGHT with one arm' },
  },
  frost_wraith: {
    h: 36, hd: 3, shadow: true, role: 'special', body: 'biped', hold: 'the icy staff topped with a glowing blue snowflake',
    prompt: `a floating frost wraith monster in a tattered pale blue hooded robe, glowing cyan eyes, icy wisps instead of legs, holding an icy staff topped with a glowing blue snowflake, ${CHAR}`,
    poses: {
      walk_a: 'floating, robe swaying back', walk_mid: 'floating, robe hanging straight', walk_b: 'floating, robe swaying forward',
      windup: 'raising the staff high, frost swirling around it', attack: 'pointing the staff forward to the RIGHT, casting a wave of frost',
    },
  },
  penguin: {
    h: 24, hd: 3, shadow: true, role: 'monster', body: 'biped',
    prompt: `a small angry cartoon penguin warrior monster wearing a little iron helmet and holding a tiny ice spear, ${CHAR}`,
    poses: { attack: 'jabbing the ice spear forward to the RIGHT' },
  },
  snow_owl: {
    h: 22, hd: 3, role: 'monster', body: 'flyer', wideSheets: true,
    prompt: `a fierce cartoon white snow owl monster with big yellow eyes and spread wings, flying, ${CHAR}`,
    poses: { attack: 'diving forward to the RIGHT with talons out' },
  },
  ice_dragon: {
    h: 72, hd: 3, shadow: true, wide: true, role: 'boss', body: 'quadruped',
    prompt: `a majestic pale blue ice dragon boss monster with crystal spikes on its back, frosty wings folded, glowing icy eyes, ${CHAR}, menacing`,
    poses: {
      idle: 'standing tall, wings half open, frost breath curling from the mouth', walk_a: 'prowling, front leg forward', walk_b: 'prowling, back leg forward',
      windup: 'rearing up with wings spread wide, inhaling, mouth glowing blue', attack: 'breathing a blast of icy frost forward to the RIGHT',
    },
  },
  // ---------- Coração do Vulcão (fogo, épico) ----------
  ground_volcano: { tile: true, contrast: 0.5, prompt: `a seamless tileable texture of dark volcanic ground seen from directly above, for a top-down RPG map: dark charcoal and deep brown basalt rock with soft large painterly patches and a faint warm orange glow in a few soft areas. Very clean and calm. NO lava rivers, NO rocks, NO outlines, NO dots, NO objects. Even lighting, fills the whole square image edge to edge` },
  volcanic_rock: { h: 22, shadow: true, prompt: `a single jagged black volcanic rock with glowing orange cracks, front view, like a top-down RPG map object` },
  obsidian: { h: 26, shadow: true, prompt: `a single cluster of shiny black obsidian crystals with purple glints, front view, like a top-down RPG map object` },
  burnt_tree: { h: 70, shadow: true, prompt: `a single charred dead tree with black twisted branches and glowing embers in the bark, front view, like a top-down RPG map object` },
  ash_pile: { h: 12, prompt: `a small pile of grey ash with a few tiny glowing embers, like a top-down RPG map decoration` },
  lava_vent: { h: 20, shadow: true, prompt: `a small volcanic vent mound of dark rock with a glowing orange hole on top and a wisp of smoke, front view, like a top-down RPG map object` },
  lava_pool: { w: 76, prompt: `a flat irregular pool of bright glowing orange and yellow lava with a dark crusted rim and a few bubbles, seen from directly above, organic blob shape, like a top-down RPG map decal` },
  fx_lavaflow: { h: 72, facing: true, ground: true, wideSheets: true, frames: 3, role: 'vfx', effect: 'this same wall of flowing lava (same shape, size and colors as the reference), surging forward', poses: {
    f1: 'the lava wave surging with bubbles and splashing droplets at the front', f2: 'the same lava wave, the splashes and bubbles moved forward', f3: 'the same lava wave, churning, droplets flying in new positions' }, prompt: `${FX}a huge cartoon wave of molten lava surging to the RIGHT, glowing orange and yellow with a dark crust, splashing droplets and bubbles at the front, side view, bold dark outlines` },
  salamander: {
    h: 22, hd: 3, shadow: true, wide: true, role: 'monster', body: 'quadruped',
    prompt: `a fast cartoon fire salamander lizard monster with glossy red-orange skin, yellow spots and a small flame on its tail tip, ${CHAR}`,
    poses: { walk_a: 'scurrying low, front legs forward', walk_mid: 'scurrying, legs under the body', walk_b: 'scurrying, back legs forward', attack: 'lunging forward to the RIGHT with its jaws open, a puff of flame from the mouth' },
  },
  ember_bat: {
    h: 20, hd: 3, role: 'monster', body: 'flyer', wideSheets: true,
    prompt: `a small cartoon fire bat monster with dark red leathery wings with glowing ember edges and glowing yellow eyes, flying, ${CHAR}`,
    poses: { attack: 'diving forward to the RIGHT with fangs bared, trailing sparks' },
  },
  magma_golem: {
    h: 38, hd: 3, shadow: true, role: 'monster', body: 'biped',
    prompt: `a chunky slow magma golem monster made of dark basalt rock plates with glowing molten lava cracks between them, heavy fists, ${CHAR}`,
    poses: { attack: 'slamming both molten fists down forward to the RIGHT' },
  },
  fire_imp: {
    h: 26, hd: 3, shadow: true, role: 'special', body: 'biped',
    prompt: `a mischievous cartoon fire imp monster with red skin, small horns, a pointy tail, bat wings and a fireball floating over its hand, ${CHAR}`,
    poses: { windup: 'holding a growing fireball above its head with both hands, grinning', attack: 'hurling the fireball forward to the RIGHT' },
  },
  lava_serpent: {
    h: 34, hd: 3, shadow: true, role: 'special', body: 'blob',
    prompt: `a big lava serpent monster rising up, body of dark crusted rock scales with glowing molten lava between them, fanged mouth, glowing eyes, ${CHAR}`,
    poses: {
      walk_a: 'slithering on the surface, body curved low, no lava pool under it', walk_mid: 'slithering, body raised in an S curve, no ground under it', walk_b: 'slithering, body stretched forward, no ground under it',
      windup: 'diving head-first down into a small splash of lava, only the tail sticking out', attack: 'erupting up from a burst of lava with its fanged mouth wide open',
    },
  },
  magma_titan: {
    h: 76, hd: 3, shadow: true, wide: true, role: 'boss', body: 'biped',
    prompt: `a colossal volcano titan boss monster, clearly different from a simple rock golem: a hunched giant demon-like beast with a whole small ERUPTING VOLCANO growing out of its back spewing fire and smoke, two huge curved obsidian horns, a long lava-cracked tail, plates of black volcanic armor on its shoulders, a fanged jaw glowing with fire, huge clawed molten hands, ${CHAR}, menacing and epic`,
    poses: {
      idle: 'standing tall, lava dripping from its fists, smoke rising', walk_a: 'stomping forward, front leg forward', walk_b: 'stomping forward, back leg forward',
      windup: 'raising both huge molten fists high over its head, lava glowing brighter', attack: 'smashing both fists into the ground in front to the RIGHT, a burst of lava and rocks',
    },
  },
  // ---------- Ruínas Malditas (mistos, épico) ----------
  ground_ruins: { tile: true, contrast: 0.5, prompt: `a seamless tileable texture of old ruined stone floor seen from directly above, for a top-down RPG map: worn grey-violet flagstones half covered by dark soil and patches of dead grass, soft painterly look, muted and calm. NO objects, NO bones, NO strong outlines, NO dots. Even lighting, fills the whole square image edge to edge` },
  broken_pillar: { h: 44, shadow: true, prompt: `a single broken ancient stone pillar with cracks, ivy and a fallen chunk at its base, front view, like a top-down RPG map object` },
  ruined_wall: { h: 34, shadow: true, prompt: `a single short crumbling section of an ancient stone wall with a broken arch window, moss on top, front view, like a top-down RPG map object` },
  rubble: { h: 14, shadow: true, prompt: `a small pile of grey stone rubble and broken bricks, like a top-down RPG map object` },
  ruin_brazier: { h: 26, shadow: true, prompt: `a single old stone brazier bowl on a short pedestal burning with eerie violet ghost fire, front view, like a top-down RPG map object` },
  curse_circle: { w: 72, prompt: `a flat glowing violet magic curse circle painted on the ground with runes and a skull sigil in the center, seen from directly above, like a top-down RPG map decal` },
  cursed_bell: { h: 56, shadow: true, prompt: `a single huge ancient cracked bronze bell hanging from a ruined stone frame, covered in glowing violet cursed runes, front view, like a top-down RPG map object` },
  zombie: {
    h: 30, hd: 3, shadow: true, role: 'monster', body: 'biped',
    prompt: `a shambling cartoon undead zombie monster with grey-green skin, torn old peasant clothes, hunched, arms reaching forward, glowing eyes, ${CHAR}`,
    poses: { attack: 'lunging forward to the RIGHT and clawing with both hands' },
  },
  lost_soul: {
    h: 20, hd: 3, role: 'monster', body: 'flyer',
    prompt: `a small spooky lost soul ghost monster, a pale violet translucent sheet-like spirit with a sad hollow face and a long wispy tail, floating, ${CHAR}`,
    poses: { walk_a: 'floating, tail curled up', walk_mid: 'floating, tail straight behind', walk_b: 'floating, tail curled down', attack: 'lunging forward to the RIGHT with a wailing open mouth' },
  },
  phantom_knight: {
    h: 38, hd: 3, shadow: true, wide: true, role: 'monster', body: 'biped',
    prompt: `a ghostly phantom knight monster in rusted ancient armor, its body made of glowing pale cyan spectral mist, holding a long lance, tattered cape, ${CHAR}`,
    poses: { windup: 'crouching low with the lance pointed forward, ready to charge', attack: 'charging forward to the RIGHT with the lance, ghostly trail behind' },
  },
  skeleton_archer: {
    h: 32, hd: 3, shadow: true, role: 'monster', body: 'biped', hold: 'the old bow in the front hand',
    prompt: `a skeleton archer monster with a hooded tattered dark cloak, an old wooden bow and a quiver of arrows, glowing violet eye sockets, ${CHAR}`,
    poses: { windup: 'drawing the bow string back, aiming to the RIGHT', attack: 'releasing an arrow to the RIGHT, the bow string snapping forward' },
  },
  gargoyle: {
    h: 30, hd: 3, shadow: true, wide: true, role: 'sleeper', body: 'flyer',
    prompt: `a grey stone gargoyle monster with bat wings, horns, a fanged grin, claws and glowing red eyes, ${CHAR}`,
    poses: {
      idle: 'crouched still on its haunches like a stone statue on a small pedestal, wings folded, eyes dark', walk_a: 'flying, wings up', walk_b: 'flying, wings down',
      windup: 'waking up, wings spread wide, eyes glowing red, cracks of stone falling off', attack: 'diving forward to the RIGHT with claws out',
    },
  },
  necromancer: {
    h: 32, hd: 3, shadow: true, role: 'special', body: 'biped', hold: 'the skull staff in the front hand',
    prompt: `a sinister necromancer monster in a dark violet hooded robe with bone ornaments, a pale skull-like face and a staff topped with a glowing green skull, ${CHAR}`,
    poses: { windup: 'raising the skull staff high, green ghostly energy swirling', attack: 'pointing the staff at the ground in front to the RIGHT, green bony hands rising from the ground' },
  },
  mimic: {
    h: 24, hd: 3, shadow: true, wide: true, role: 'sleeper', body: 'blob',
    prompt: `a mimic monster: a wooden treasure chest with gold trim that is secretly alive, lid open like a huge mouth full of sharp teeth, a long purple tongue and small stubby legs, ${CHAR}`,
    poses: {
      idle: 'closed, looking exactly like a normal treasure chest with gold trim, no teeth, no legs showing', walk_a: 'hopping, lid half open showing teeth, near leg forward', walk_b: 'hopping, lid half open showing teeth, far leg forward',
      windup: 'lid snapping open wide, tongue lashing out',
      attack: 'lunging forward to the RIGHT, lid wide open, teeth and tongue out',
    },
  },
  lich_king: {
    h: 72, hd: 3, shadow: true, wide: true, role: 'boss', body: 'biped',
    prompt: `a terrifying lich king boss monster: a tall skeletal undead sorcerer king in ornate dark violet and gold robes, a jagged golden crown, glowing cyan eyes, a long staff topped with a floating soul crystal, spectral green fire around its hands, ${CHAR}, menacing and epic`,
    poses: {
      idle: 'standing tall, floating slightly, soul crystal glowing', walk_a: 'gliding forward, robe flowing back', walk_b: 'gliding forward, robe flowing the other way',
      windup: 'raising the staff high with both hands, lightning crackling around the crystal', attack: 'thrusting the staff forward to the RIGHT, a blast of green soul fire',
    },
  },
  // ---------- Cidadela Demoníaca (todos os elementos, épico) ----------
  ground_citadel: { tile: true, contrast: 0.5, prompt: `a seamless tileable texture of a demonic fortress floor seen from directly above, for a top-down RPG map: dark blackened red stone tiles with thin glowing crimson cracks between some of them and soft painterly shading, muted and calm. NO objects, NO skulls, NO strong outlines, NO dots. Even lighting, fills the whole square image edge to edge` },
  hell_spire: { h: 52, shadow: true, prompt: `a single tall jagged black obsidian spike pillar with iron chains wrapped around it and small glowing red runes, front view, like a top-down RPG map object` },
  skull_pile: { h: 16, shadow: true, prompt: `a small pile of cartoon horned demon skulls and bones, like a top-down RPG map object` },
  demon_brazier: { h: 30, shadow: true, prompt: `a single black iron brazier shaped like a horned demon head, burning with bright red-orange hellfire, front view, like a top-down RPG map object` },
  demon_banner: { h: 46, shadow: true, prompt: `a single tattered dark crimson war banner with a golden horned skull emblem on a black iron pole with spikes, front view, like a top-down RPG map object` },
  hellfire_grate: { w: 64, prompt: `a flat round black iron floor grate set into dark stone, with glowing red-orange hellfire visible through the bars, seen from directly above, like a top-down RPG map decal` },
  demon_portal: { h: 60, shadow: true, prompt: `a single demonic summoning portal: a jagged ring of black horned stone standing upright, filled with a swirling crimson and purple vortex, small red runes around it, front view, like a top-down RPG map object` },
  winged_imp: {
    h: 20, hd: 3, role: 'monster', body: 'flyer', wideSheets: true,
    prompt: `a small fast cartoon winged imp demon with dark purple skin, big leathery black wings, small curved horns, a barbed tail and a wicked grin, flying, ${CHAR}`,
    poses: { attack: 'diving forward to the RIGHT with claws out' },
  },
  hellhound: {
    h: 26, hd: 3, shadow: true, wide: true, role: 'special', body: 'quadruped',
    prompt: `a lean cartoon hellhound demon dog with charcoal black fur, glowing cracks of fire along its body, a mane of flames, spiked collar and burning red eyes, ${CHAR}`,
    poses: { windup: 'crouching low, ready to pounce, flames flaring', attack: 'pouncing forward to the RIGHT with jaws wide open' },
  },
  demon_brute: {
    h: 42, hd: 3, shadow: true, wide: true, role: 'special', body: 'biped',
    prompt: `a huge hulking demon brute monster with red skin, massive arms, big curved horns, spiked iron shoulder armor and a heavy spiked iron club, ${CHAR}, menacing`,
    poses: { windup: 'raising the spiked club high over its head with both hands', attack: 'smashing the club down into the ground in front, cracks and fire bursting out' },
  },
  floating_eye: {
    h: 24, hd: 3, role: 'special', body: 'flyer', wideSheets: true,
    prompt: `a floating demonic eyeball monster: a big bloodshot eye with a crimson iris, small bat wings and dangling tentacles, flying, ${CHAR}`,
    poses: { windup: 'eye glowing bright red, charging energy, tentacles spread', attack: 'firing a thick red laser beam forward to the RIGHT from the eye' },
  },
  demon_witch: {
    h: 32, hd: 3, shadow: true, role: 'special', body: 'biped', hold: 'the crooked horned staff in the front hand',
    prompt: `a sinister demon sorceress monster with pale red skin, black curled horns, a long dark crimson and black robe, glowing purple eyes and a crooked horned staff with a purple orb, ${CHAR}`,
    poses: { windup: 'raising the staff, a purple curse orb swirling above it', attack: 'thrusting the staff forward to the RIGHT, shooting a purple curse bolt' },
  },
  // objetos dos eventos (no lugar dos provisórios desenhados por código)
  chest: { h: 22, shadow: true, prompt: `a single closed wooden treasure chest with gold trim and a golden lock, front view, like a top-down RPG map object` },
  bomb: { h: 16, prompt: `a single round black cartoon bomb with a short lit fuse sparkling, like a top-down RPG map item` },
  dirt: { w: 72, prompt: `a flat irregular patch of bare brown dirt ground with a few small pebbles, seen from directly above, organic blob shape, like a top-down RPG map decal` },
  dirt2: { w: 64, prompt: `a flat irregular patch of bare brown dirt ground with tiny grass bits around the edges, seen from directly above, elongated organic shape, like a top-down RPG map decal` },
  // itens equipáveis (ícones; a cor da raridade vem na moldura, desenhada pelo jogo)
  item_blade: { h: 16, hd: 4, prompt: `${ICON}: a sharp steel sword with a golden crossguard, diagonal, blade pointing up-right` },
  item_warhammer: { h: 16, hd: 4, prompt: `${ICON}: a heavy steel war hammer with a wooden handle, diagonal` },
  item_staff: { h: 16, hd: 4, prompt: `${ICON}: a wooden magic staff topped with a glowing blue crystal, diagonal` },
  item_shield: { h: 16, hd: 4, prompt: `${ICON}: a round wooden shield with a steel rim and a golden emblem` },
  item_tome: { h: 16, hd: 4, prompt: `${ICON}: a thick closed spell book with a purple leather cover and a golden rune` },
  item_dagger: { h: 16, hd: 4, prompt: `${ICON}: a curved dagger with a red leather grip, diagonal` },
  item_helm: { h: 16, hd: 4, prompt: `${ICON}: a steel knight helmet with a small red plume, front view` },
  item_hood: { h: 16, hd: 4, prompt: `${ICON}: a dark green leather hood, front view` },
  item_plate: { h: 16, hd: 4, prompt: `${ICON}: a shiny steel breastplate armor, front view` },
  item_robe: { h: 16, hd: 4, prompt: `${ICON}: a blue mage robe with golden trim, front view` },
  item_boots: { h: 16, hd: 4, prompt: `${ICON}: a pair of brown leather boots with steel toe caps` },
  item_cape: { h: 16, hd: 4, prompt: `${ICON}: a flowing red cape with a golden clasp` },
  item_ring: { h: 16, hd: 4, prompt: `${ICON}: a golden ring with a blue gem` },
  item_signet: { h: 16, hd: 4, prompt: `${ICON}: a heavy silver signet ring with a red stone` },
  item_amulet: { h: 16, hd: 4, prompt: `${ICON}: a golden amulet necklace with a green gem pendant` },
  item_relic: { h: 16, hd: 4, prompt: `${ICON}: an ancient glowing stone tablet relic with runes` },
  item_idol: { h: 16, hd: 4, prompt: `${ICON}: a small golden idol statue` },
  icon_dust: { h: 16, hd: 4, prompt: `${ICON}: a small pile of sparkling blue forge dust crystals` },
  icon_anvil: { h: 16, hd: 4, prompt: `${ICON}: a black iron blacksmith anvil with a hammer resting on it` },
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
