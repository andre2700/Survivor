import { describe, expect, it } from 'vitest';
import { SPRITES, PALETTE, PALETTE_SWAPS, expandFrame } from '../src/art/sprites';
import { CHARACTERS } from '../src/data/characters';
import { WAVES, hpMultiplier, isEliteTime, waveAt, xpToNext } from '../src/data/waves';
import { WEAPONS, WEAPON_IDS, MAX_WEAPONS } from '../src/data/weapons';
import { computeStats, damageAfterArmor } from '../src/systems/stats';
import { allOptions, applyOption, rollOptions, type Loadout } from '../src/systems/upgrades';

describe('sprites', () => {
  it('todas as linhas de cada quadro têm a mesma largura e só usam cores da paleta', () => {
    for (const [key, def] of Object.entries(SPRITES)) {
      for (const frame of def.frames) {
        const rows = expandFrame(frame, def.mirror);
        const w = rows[0].length;
        for (const r of rows) {
          expect(r.length, `${key}: "${r}"`).toBe(w);
          for (const ch of r) if (ch !== '.') expect(PALETTE[ch], `${key}: cor '${ch}'`).toBeDefined();
        }
      }
      const sizes = def.frames.map((f) => `${f.length}x${f[0].length}`);
      expect(new Set(sizes).size, key).toBe(1);
    }
    for (const { base } of Object.values(PALETTE_SWAPS)) expect(SPRITES[base]).toBeDefined();
  });
});

describe('ondas', () => {
  it('escolhe a onda pelo minuto', () => {
    expect(waveAt(0)).toBe(WAVES[0]);
    expect(waveAt(61).minute).toBe(1);
    expect(waveAt(599).minute).toBe(9);
  });
  it('vida dos inimigos cresce com o tempo', () => {
    expect(hpMultiplier(0)).toBe(1);
    expect(hpMultiplier(300)).toBeGreaterThan(2);
  });
  it('elite aparece uma vez no meio de cada minuto a partir de 1:30', () => {
    let count = 0;
    for (let t = 0; t < 600; t += 0.016) if (isEliteTime(t, t + 0.016)) count++;
    expect(count).toBe(9);
  });
  it('xp necessária cresce', () => {
    expect(xpToNext(1)).toBe(5);
    expect(xpToNext(10)).toBeGreaterThan(xpToNext(5));
  });
});

describe('melhorias', () => {
  it('nunca oferece arma nova acima do limite de slots', () => {
    const loadout: Loadout = { weapons: {}, passives: {} };
    WEAPON_IDS.slice(0, MAX_WEAPONS).forEach((id) => (loadout.weapons[id] = 1));
    const opts = allOptions(loadout);
    for (const o of opts) if (o.kind === 'weapon') expect(loadout.weapons[o.id]).toBeDefined();
  });
  it('sorteia opções distintas e aplica nível', () => {
    const loadout: Loadout = { weapons: { wand: 1 }, passives: {} };
    const opts = rollOptions(loadout, 3, () => 0.5);
    expect(opts).toHaveLength(3);
    expect(new Set(opts.map((o) => JSON.stringify(o))).size).toBe(3);
    applyOption(loadout, { kind: 'weapon', id: 'wand', nextLevel: 2 });
    expect(loadout.weapons.wand).toBe(2);
  });
  it('com tudo no máximo oferece bônus', () => {
    const loadout: Loadout = { weapons: {}, passives: {} };
    WEAPON_IDS.slice(0, MAX_WEAPONS).forEach((id) => (loadout.weapons[id] = WEAPONS[id].levels.length));
    for (const o of allOptions({ weapons: {}, passives: {} })) if (o.kind === 'passive') loadout.passives[o.id] = 5;
    const opts = rollOptions(loadout, 3);
    expect(opts.every((o) => o.kind === 'gold' || o.kind === 'heal')).toBe(true);
  });
  it('cada arma tem textos de melhoria para todos os níveis', () => {
    for (const w of Object.values(WEAPONS)) expect(w.upgrades.length).toBe(w.levels.length - 1);
  });
});

describe('atributos', () => {
  it('combina personagem, meta e passivas', () => {
    const knight = CHARACTERS[0];
    const s = computeStats(knight, { maxHp: 2, might: 1 }, { vigor: 1, might: 2 });
    expect(s.maxHp).toBe(knight.maxHp + 20 + 20);
    expect(s.might).toBeCloseTo(1.25);
    expect(damageAfterArmor(5, 10)).toBe(1);
  });
});
