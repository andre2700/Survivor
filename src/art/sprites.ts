// Pixel art definida como matrizes de caracteres. Cada caractere é uma cor da PALETTE.
// Sprites marcados com `mirror` têm só a metade esquerda desenhada; a direita é espelhada.

export const PALETTE: Record<string, string> = {
  k: '#1a1c2c', // contorno
  p: '#5d275d', // roxo escuro
  r: '#b13e53', // vermelho
  o: '#ef7d57', // laranja
  y: '#ffcd75', // amarelo
  L: '#a7f070', // verde claro
  g: '#38b764', // verde
  t: '#257179', // verde-azulado
  n: '#29366f', // azul marinho
  b: '#3b5dc9', // azul
  c: '#41a6f6', // azul claro
  C: '#73eff7', // ciano
  w: '#f4f4f4', // branco
  e: '#94b0c2', // cinza claro
  E: '#566c86', // cinza
  d: '#333c57', // cinza escuro
  s: '#f2c391', // pele
  h: '#8b5a2b', // marrom
  m: '#c56cf0', // lilás
};

export interface SpriteDef {
  frames: string[][];
  mirror?: boolean;
}

const heroLegsA = [
  '....knnkknnk....',
  '....knk..knk....',
  '....khk..khk....',
  '....kkk..kkk....',
];
const heroLegsB = [
  '....knnkknnk....',
  '...knk....knk...',
  '...khk....khk...',
  '...kkk....kkk...',
];
const heroTop = [
  '................',
  '.....kkkkkk.....',
  '....kweeeeek....',
  '....keeeeeEk....',
  '....kssssssk....',
  '....kskssksk....',
  '....kssssssk....',
  '.....kkkkkk.....',
  '...kkbbbbbbkk...',
  '..ksbbbybbbbsk..',
  '..kskbbybbbksk..',
  '...kknnynnnkk...',
];

export const SPRITES: Record<string, SpriteDef> = {
  hero: { frames: [[...heroTop, ...heroLegsA], [...heroTop, ...heroLegsB]] },

  slime: {
    mirror: true,
    frames: [
      [
        '........', '........', '........', '........', '........', '......kk', '....kkLL', '...kLwLg',
        '..kLLLgg', '..kLgkgg', '..kggggg', '.kgggggg', '.kgggggg', '.ktggggg', '..kttttt', '...kkkkk',
      ],
      [
        '........', '........', '........', '........', '........', '........', '.....kkk', '...kkLLL',
        '..kLwLgg', '.kLLgkgg', '.kgggggg', 'kggggggg', 'kggggggg', 'ktgggggg', '.ktttttt', '..kkkkkk',
      ],
    ],
  },

  bat: {
    mirror: true,
    frames: [
      [
        '........', '........', '.k......', '.pk.....', '.ppk..k.', '.pppkkpk', '.ppppppp', '..pppprp',
        '...ppppp', '....kppp', '.....kpw', '......kk', '........', '........', '........', '........',
      ],
      [
        '........', '........', '........', '........', '......k.', '....kkpk', '..kppppp', '.ppppprp',
        'pppppppp', 'pk.kpppp', 'k...kppw', '......kk', '........', '........', '........', '........',
      ],
    ],
  },

  skeleton: {
    mirror: true,
    frames: [
      [
        '........', '.....kkk', '....kwww', '...kwwww', '...kwkkw', '...kwwww', '....kwkw', '.....kkk',
        '...kkwkw', '..kwkwkw', '..kwkwkw', '..k.kwkw', '....kwkk', '....kwk.', '....kwk.', '....kkk.',
      ],
      [
        '........', '.....kkk', '....kwww', '...kwwww', '...kwkkw', '...kwwww', '....kwkw', '.....kkk',
        '...kkwkw', '..kwkwkw', '..kwkwkw', '..k.kwkw', '....kwkk', '...kwk..', '...kwk..', '...kkk..',
      ],
    ],
  },

  orc: {
    mirror: true,
    frames: [
      [
        '........', '........', '....kkkk', '...kgggg', '..kggggg', '..kgrkgg', '..kggggg', '..kgwkkk',
        '..kkgggg', '.kghhhhh', 'kgghhyhh', 'kgkhhhhh', 'kk.kdddd', '...kddkk', '...kddk.', '...kkkk.',
      ],
      [
        '........', '........', '....kkkk', '...kgggg', '..kggggg', '..kgrkgg', '..kggggg', '..kgwkkk',
        '..kkgggg', '.kghhhhh', 'kgghhyhh', 'kgkhhhhh', 'kk.kdddd', '..kddkk.', '..kddk..', '..kkkk..',
      ],
    ],
  },

  demon: {
    mirror: true,
    frames: [
      [
        'k.......', 'rk......', 'rrk..kkk', '.rrkkrrr', '..krrrrr', '..krykrr', '..krrrrr', '..krkwkw',
        '...krrrr', '.kkrrrrr', 'krrkrrpp', 'kr.krppp', 'k..krrrr', '...krrkk', '...krrk.', '...kkkk.',
      ],
      [
        '........', 'k.......', 'rk...kkk', 'rrkkkrrr', '.rkrrrrr', '..krykrr', '..krrrrr', '..krkwkw',
        '...krrrr', '.kkrrrrr', 'krrkrrpp', 'kr.krppp', 'k..krrrr', '..krrkk.', '..krrk..', '..kkkk..',
      ],
    ],
  },

  // Decoração do cenário
  tree: {
    mirror: true,
    frames: [[
      '......kk', '....kkgg', '...kgggL', '..kgggLL', '..kggggL', '.kggtggg', '.kgggggg', 'kgggtggg',
      'kgtggggg', 'kggggtgg', '.kgggggg', '..kktggg', '..kgggtg', '.kgtgggg', '.kgggggg', '..kkkggg',
      '....kkkh', '.....kkh', '......kh', '......kh', '.....kkh', '....kkkk',
    ]],
  },
  rock: { mirror: true, frames: [['..kk', '.keE', 'keeE', 'keEE', 'kEEd', '.kkk']] },
  bush: { mirror: true, frames: [['...kk.', '..ktgk', '.kttgt', 'kttttt', 'kttttt', '.kkkkk']] },
  mushroom: { mirror: true, frames: [['.kk', 'krr', 'krw', 'kkk', '.ke', '.kk']] },

  // Itens
  gem: { mirror: true, frames: [['...k', '..kc', '.kcC', 'kcCw', 'kccc', '.kcc', '..kc', '...k']] },
  coin: { mirror: true, frames: [['..kk', '.kyy', 'kyyw', 'kyoy', 'kyoy', 'kyyy', '.kyy', '..kk']] },
  heart: { mirror: true, frames: [['....', '.kk.', 'krrk', 'krwr', 'krrr', '.krr', '..kr', '...k']] },

  // Projéteis
  bolt: { mirror: true, frames: [['....', '..cc', '.cCC', 'cCww', 'cCww', '.cCC', '..cc', '....']] },
  knife: { frames: [['..k.....', 'hhkeeeew', '..k.....']] },
  axe: {
    frames: [[
      '....kkkk....',
      '...keeeek...',
      '..keewweek..',
      '..keeeeeek..',
      '...kkhhkk...',
      '.....hh.....',
      '.....hh.....',
      '.....hh.....',
      '.....hh.....',
      '.....hh.....',
      '.....kk.....',
      '............',
    ]],
  },
  orb: { mirror: true, frames: [['...kk', '..kyy', '.kyww', 'kyywy', 'kyyyy', 'kyyyy', 'koyyy', '.kooy', '..koo', '...kk']] },

  // Ícones (10x10)
  icon_sword: {
    frames: [[
      '........ew', '.......ewe', '......ewe.', '.....ewe..', '....ewe...',
      '.k.ewe....', '..kwe.....', '..hk......', '.h..k.....', 'h.........',
    ]],
  },
  icon_boot: {
    frames: [[
      '..kkkk....', '..khhk....', '..khhk....', '..khhk....', '..khhk....',
      '..khhkkk..', '..khhhhhk.', '..khhhhhhk', '..kkkkkkkk', '..........',
    ]],
  },
  icon_book: {
    frames: [[
      '.kkkkkkk..', '.kbbbbbbk.', '.kbyyyybk.', '.kbbbbbbk.', '.kbyyybbk.',
      '.kbbbbbbk.', '.kbbbbbbk.', '.kwwwwwwk.', '.kkkkkkkk.', '..........',
    ]],
  },
  icon_magnet: {
    frames: [[
      'kkkk..kkkk', 'kwwk..kwwk', 'krrk..kbbk', 'krrk..kbbk', 'krrk..kbbk',
      'krrkkkkbbk', 'krrrrbbbbk', '.krrrbbbk.', '..kkkkkk..', '..........',
    ]],
  },
  icon_cross: {
    frames: [[
      '...kkkk...', '...kggk...', '...kggk...', 'kkkkggkkkk', 'kggggggggk',
      'kggggggggk', 'kkkkggkkkk', '...kggk...', '...kggk...', '...kkkk...',
    ]],
  },
  icon_shield: {
    frames: [[
      'kkkkkkkkkk', 'keeeweeeek', 'keebbbbeek', 'kebbbbbbek', 'kebbybbbek',
      '.kebbbbek.', '.kebbbbek.', '..kebbek..', '...keek...', '....kk....',
    ]],
  },
  icon_fire: {
    frames: [[
      '....k.....', '...kok....', '...koyk...', '..koyok.k.', '.kooyyokok',
      '.koyyyyook', 'kooywwyyok', 'koyywwyyok', '.koyyyyok.', '..kkkkkk..',
    ]],
  },
  icon_bolt: {
    frames: [[
      '.....kkkk.', '....kyyk..', '...kyyk...', '..kyyk....', '.kyyyyyyk.',
      '....kyyk..', '...kyyk...', '..kyk.....', '.kyk......', '.kk.......',
    ]],
  },
  icon_potion: {
    frames: [[
      '...kkkk...', '....kk....', '...kwwk...', '..krrrrk..', '.krwrrrrk.',
      '.krrrrrrk.', '.krrrrrrk.', '..krrrrk..', '...kkkk...', '..........',
    ]],
  },
  icon_dice: {
    frames: [[
      'kkkkkkkkkk', 'kwwwwwwwwk', 'kwkwwwwwwk', 'kwwwwwwwwk', 'kwwwkkwwwk',
      'kwwwkkwwwk', 'kwwwwwwwwk', 'kwwwwwwkwk', 'kwwwwwwwwk', 'kkkkkkkkkk',
    ]],
  },
};

/** Trocas de paleta para variações (heróis, gemas maiores). */
export const PALETTE_SWAPS: Record<string, { base: string; swap: Record<string, string> }> = {
  hero_knight: { base: 'hero', swap: {} },
  hero_mage: { base: 'hero', swap: { e: 'm', E: 'p', w: 'm', b: 'p', n: 'd', y: 'C' } },
  hero_ranger: { base: 'hero', swap: { e: 'g', E: 't', w: 'L', b: 'h', n: 't' } },
  hero_barbarian: { base: 'hero', swap: { e: 'h', E: 'k', w: 'o', b: 'r', n: 'h' } },
  gem_green: { base: 'gem', swap: { c: 'g', C: 'L' } },
  gem_red: { base: 'gem', swap: { c: 'r', C: 'o' } },
};

/** Expande um sprite (espelhando se necessário) para linhas completas. */
export function expandFrame(rows: string[], mirror?: boolean): string[] {
  if (!mirror) return rows;
  return rows.map((r) => r + r.split('').reverse().join(''));
}
