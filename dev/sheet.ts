import { heroFrames } from '../src/art/characters';
import { bush, flowers, grassTile, mushroom, rock, stump, tallGrass, tree } from '../src/art/environment';
import { ICONS, auraRing, axeProjectile, boltProjectile, coinFrames, gem, heart, holyOrb, knifeProjectile, slash } from '../src/art/items';
import { batFrames, demonFrames, goblinFrames, orcFrames, skeletonFrames, slimeFrames, wolfFrames } from '../src/art/monsters';
import { R, strip } from '../src/art/pixel';

export function SHEET(): { label: string; canvas: HTMLCanvasElement }[] {
  const out: { label: string; canvas: HTMLCanvasElement }[] = [];
  const add = (label: string, c: HTMLCanvasElement) => out.push({ label, canvas: c });
  for (const k of ['hero_knight', 'hero_mage']) add(k, strip(heroFrames(k)));
  add('slime', strip(slimeFrames()));
  add('goblin', strip(goblinFrames()));
  add('wolf', strip(wolfFrames()));
  add('tree', tree(0).toCanvas());
  add('tree2', tree(1).toCanvas());
  add('bush', bush().toCanvas());
  add('rock', rock().toCanvas());
  add('stump', stump().toCanvas());
  add('flowers', flowers().toCanvas());
  add('mushroom', mushroom().toCanvas());
  add('tallgrass', tallGrass().toCanvas());
  add('gems', strip([gem(R.water), gem(R.green), gem(R.red)]));
  add('coin', strip(coinFrames()));
  add('heart', heart().toCanvas());
  add('proj', strip([boltProjectile(), holyOrb()]));
  add('knife', knifeProjectile().toCanvas());
  add('axe', axeProjectile().toCanvas());
  add('slash', slash().toCanvas());
  add('aura', auraRing().toCanvas());
  add('icons', strip(Object.values(ICONS).map((f) => f())));
  add('grass', grassTile().toCanvas());
  return out;
}
