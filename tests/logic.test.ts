import { PETS, eggChance, petStage, petXpToNext, rollEggPet } from '../src/data/pets';
import { addEgg, addPetXp, feed, hatch, incubate } from '../src/systems/pets';
import { BAG_SIZE, forgeCost, itemPower, lootCount, makeItem, rollRarity as rollItemRarity } from '../src/data/items';
import { addItems, equip, equipmentModifiers, nextUid } from '../src/systems/inventory';
import { describe, expect, it } from 'vitest';
import SPRITES from '../src/art/sprites.json';
import { ART, FRAME_TEMPLATES } from '../art/manifest.mjs';
import { walkPose } from '../src/art/motion';
import { formatNumber } from '../src/core/format';
import {
  BASE_STATS, combine, cooldownMult, critMultiplier, damageTaken, defenseReduction, moveSpeed, rollCritTier,
} from '../src/core/stats';
import { STAT_CARDS } from '../src/data/cards';
import { CONTROL_RULES, ENEMIES, controlRoll, controlScale } from '../src/data/enemies';
import { STAGES, stageUnlocked } from '../src/data/stages';
import { PRIMARIES, REACTIONS, elementMultiplier, reactionFor, statusRoll } from '../src/data/elements';
import { CHARACTERS } from '../src/data/characters';
import { META_UPGRADES, metaCost, metaModifiers } from '../src/data/meta';
import { applyTagBonuses, countTags } from '../src/data/tags';
import { RUN_DURATION, WAVES, endlessScaling, isEliteTime, waveAt, xpToNext } from '../src/data/waves';
import { MAX_PHYSICAL_AMOUNT, WEAPONS, WEAPON_IDS, capAmount, weaponStatsAt, weaponTags } from '../src/data/weapons';
import { migrate } from '../src/systems/save';
import { applyOption, describeOption, loadoutModifiers, optionKey, rollOptions, rollRarity, type Loadout } from '../src/systems/upgrades';

describe('arte', () => {
  const files = Object.keys(import.meta.glob('../src/assets/art/*.png'));
  const has = (key: string) => key in SPRITES && files.includes(`../src/assets/art/${key}.png`);
  it('toda textura usada pelos dados existe', () => {
    const keys = [
      ...CHARACTERS.flatMap((c) => [c.texture, `portrait_${c.texture}`]),
      ...Object.values(ENEMIES).map((e) => e.texture),
      ...Object.values(WEAPONS).map((w) => w.icon),
      ...STAT_CARDS.map((c) => c.icon),
      ...META_UPGRADES.map((m) => m.icon),
      'ground', 'gem', 'gem_green', 'gem_red', 'coin', 'heart', 'proj_bolt', 'proj_knife', 'proj_axe', 'proj_orb',
      ...Object.values(WEAPONS).flatMap((w) => (w.projectile ? [w.projectile] : [])),
    ];
    for (const key of keys) expect(has(key), key).toBe(true);
  });
  it('corrida do herói alterna os pés: passo, passagem, outro passo', () => {
    const seq = [0.01, 0.11, 0.21, 0.31, 0.41].map((t) => walkPose('hero', t).slot);
    expect(seq).toEqual(['walk_a', 'walk_mid', 'walk_b', 'walk_mid', 'walk_a']);
    expect(walkPose('hero', 1, false).slot).toBe('idle');
  });
  it('personagens animados têm os quadros do seu papel', () => {
    const slots = (key: string) => (SPRITES as Record<string, { slots?: string[] }>)[key]?.slots ?? [];
    for (const c of CHARACTERS) {
      expect(slots(c.texture), c.texture).toEqual(['idle', 'walk_a', 'walk_mid', 'walk_b', 'attack', 'hurt', 'death', 'victory']);
    }
    // cada criatura tem os quadros do modelo do seu papel (variantes de cor usam o da original)
    for (const e of Object.values(ENEMIES)) {
      const a = ART[e.texture];
      const role = (a.variant ? ART[a.variant].role : a.role)!;
      const t = FRAME_TEMPLATES[role];
      expect(slots(e.texture), e.texture).toEqual([...t.move, ...t.action]);
      expect(slots(e.texture), `${e.texture} sem quadro de ataque`).toContain('attack');
    }
  });
});

describe('elementos', () => {
  it('ciclo de vantagens: Água > Fogo > Ar > Terra > Água', () => {
    expect(elementMultiplier('water', 'fire')).toBe(2);
    expect(elementMultiplier('fire', 'air')).toBe(2);
    expect(elementMultiplier('air', 'earth')).toBe(2);
    expect(elementMultiplier('earth', 'water')).toBe(2);
    expect(elementMultiplier('fire', 'water')).toBe(0.5);
    expect(elementMultiplier('fire', 'fire')).toBe(0.25);
    expect(elementMultiplier('physical', 'fire')).toBe(1);
    expect(elementMultiplier('fire', undefined)).toBe(1);
  });
  it('derivado herda a melhor vantagem das origens (Raio = Fogo + Ar)', () => {
    expect(elementMultiplier('lightning', 'earth')).toBe(2);
    expect(elementMultiplier('lightning', 'water')).toBe(1);
  });
  it('todo par de primários tem uma reação, nos dois sentidos', () => {
    for (const a of PRIMARIES) for (const b of PRIMARIES) {
      if (a === b) continue;
      expect(reactionFor(a, b), `${a}+${b}`).toBeDefined();
      expect(reactionFor(a, b)).toBe(reactionFor(b, a));
    }
    expect(REACTIONS).toHaveLength(6);
  });
  it('chance de efeito cresce com a potência; acima de 100% vira potência', () => {
    expect(statusRoll(1, 0, 0, () => 0.19).applied).toBe(true);
    expect(statusRoll(1, 0, 0, () => 0.21).applied).toBe(false);
    expect(statusRoll(1, 1, 0, () => 0.39).applied).toBe(true);
    expect(statusRoll(2, 4, 0, () => 0.99).potency).toBeCloseTo(2);
  });
  it('armas derivadas contam nas duas origens para os bônus de conjunto', () => {
    expect(weaponTags(WEAPONS.lightning)).toEqual(expect.arrayContaining(['fire', 'air']));
    expect(weaponTags(WEAPONS.wave)).toContain('water');
  });
  it('inimigos elementais existem para os quatro primários', () => {
    const els = new Set(Object.values(ENEMIES).map((e) => e.element).filter(Boolean));
    for (const p of PRIMARIES) expect(els.has(p), p).toBe(true);
  });
});

describe('atributos', () => {
  it('combina base, valores fixos e percentuais', () => {
    const s = combine(BASE_STATS, [{ stat: 'maxHp', flat: 20 }, { stat: 'maxHp', pct: 0.5 }, { stat: 'power', flat: 0.25 }]);
    expect(s.maxHp).toBe((100 + 20) * 1.5);
    expect(s.power).toBeCloseTo(0.25);
  });
  it('recarga nunca chega a zero e sempre melhora', () => {
    let prev = Infinity;
    for (const as of [0, 1, 10, 100, 1e6]) {
      const m = cooldownMult({ ...BASE_STATS, attackSpeed: as });
      expect(m).toBeGreaterThan(0);
      expect(m).toBeLessThan(prev);
      prev = m;
    }
  });
  it('crítico acima de 100% vira supercrítico', () => {
    expect(rollCritTier(0.5, () => 0.4)).toBe(1);
    expect(rollCritTier(0.5, () => 0.6)).toBe(0);
    expect(rollCritTier(1.3, () => 0.2)).toBe(2);
    expect(rollCritTier(2, () => 0.99)).toBe(2);
    expect(critMultiplier({ ...BASE_STATS, critDamage: 2 }, 2)).toBe(4);
  });
  it('defesa tem retorno decrescente e nunca bloqueia tudo', () => {
    expect(defenseReduction({ ...BASE_STATS, defense: 20 })).toBeCloseTo(0.5);
    expect(defenseReduction({ ...BASE_STATS, defense: 1e9 })).toBeLessThan(1);
    expect(damageTaken(10, { ...BASE_STATS, defense: 1e9 })).toBe(1);
  });
  it('velocidade cresce mais devagar acima do dobro', () => {
    const fast = moveSpeed({ ...BASE_STATS, moveSpeed: 600 });
    expect(fast).toBeGreaterThan(120);
    expect(fast).toBeLessThan(600);
  });
});

describe('armas', () => {
  it('crescem sem teto e despertam a cada 10 níveis', () => {
    for (const id of WEAPON_IDS) {
      const def = WEAPONS[id];
      const l9 = weaponStatsAt(def, 9);
      const l10 = weaponStatsAt(def, 10);
      const l200 = weaponStatsAt(def, 200);
      expect(l10.damage).toBeGreaterThan(l9.damage * 1.4);
      expect(l200.damage).toBeGreaterThan(l10.damage);
      expect(l200.cooldown).toBeGreaterThan(0);
    }
  });
  it('quantidade acima do limite vira dano', () => {
    const s = capAmount({ ...WEAPONS.wand.base, amount: MAX_PHYSICAL_AMOUNT + 5, damage: 100 });
    expect(s.amount).toBe(MAX_PHYSICAL_AMOUNT);
    expect(s.damage).toBeCloseTo(160);
  });
  it('bônus de tag só ativa com armas suficientes', () => {
    const counts = countTags([WEAPONS.wand.tags, WEAPONS.hammer.tags, WEAPONS.knives.tags]);
    const s = { ...WEAPONS.wand.base };
    applyTagBonuses(s, WEAPONS.wand.tags, counts);
    expect(s.amount).toBe(WEAPONS.wand.base.amount + 1); // 3 armas de projétil
  });
});

describe('cartas', () => {
  const empty = (): Loadout => ({ weapons: {}, stats: {} });
  it('sorteia opções distintas, sem limite de armas', () => {
    const loadout = empty();
    for (const id of WEAPON_IDS) loadout.weapons[id] = 3;
    const opts = rollOptions(loadout, 6, 0);
    expect(opts).toHaveLength(6);
    expect(new Set(opts.map(optionKey)).size).toBe(6);
  });
  it('banidas nunca aparecem e fixadas vêm primeiro', () => {
    const banned = new Set(WEAPON_IDS.map((id) => `w:${id}`));
    const locked = [{ kind: 'stat' as const, stat: 'luck' as const, rarity: 2 }];
    for (let i = 0; i < 50; i++) {
      const opts = rollOptions(empty(), 4, 0, banned, locked);
      expect(opts[0]).toEqual(locked[0]);
      expect(opts.every((o) => o.kind !== 'weapon')).toBe(true);
    }
  });
  it('sorte aumenta a chance de cartas raras', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const count = (luck: number) => {
      let rare = 0;
      for (let i = 0; i < 5000; i++) if (rollRarity(luck, rnd) >= 2) rare++;
      return rare;
    };
    expect(count(200)).toBeGreaterThan(count(0) * 2);
  });
  it('raridade multiplica níveis e valores', () => {
    const loadout = empty();
    applyOption(loadout, { kind: 'weapon', id: 'axe', rarity: 3 });
    expect(loadout.weapons.axe).toBe(5);
    applyOption(loadout, { kind: 'stat', stat: 'power', rarity: 1 });
    const mods = loadoutModifiers(loadout);
    expect(mods[0].flat).toBeCloseTo(0.3);
  });
  it('toda carta de atributo tem descrição com antes → depois', () => {
    const loadout = empty();
    for (const c of STAT_CARDS) {
      const info = describeOption({ kind: 'stat', stat: c.stat, rarity: 0 }, loadout, BASE_STATS, (m) => combine(BASE_STATS, m));
      expect(info.change).toContain('>');
    }
  });
});

describe('ondas e progressão', () => {
  it('partida padrão dura 15 minutos', () => {
    expect(RUN_DURATION).toBe(900);
    expect(waveAt(14 * 60 + 30).minute).toBe(14);
    expect(waveAt(0)).toBe(WAVES[0]);
  });
  it('modo infinito escala sem teto', () => {
    expect(endlessScaling(5).hp).toBeGreaterThan(endlessScaling(4).hp);
    expect(endlessScaling(5).reward).toBeGreaterThan(endlessScaling(1).reward);
  });
  it('elite surge uma vez por minuto a partir de 1:30', () => {
    let count = 0;
    for (let t = 0; t < 600; t += 0.016) if (isEliteTime(t, t + 0.016)) count++;
    expect(count).toBe(9);
  });
  it('xp necessária cresce', () => {
    expect(xpToNext(1)).toBe(5);
    expect(xpToNext(20)).toBeGreaterThan(xpToNext(10));
  });
  it('melhorias permanentes sem teto têm preço crescente', () => {
    const def = META_UPGRADES.find((d) => d.id === 'power')!;
    expect(metaCost(def, 50)).toBeGreaterThan(metaCost(def, 49));
    // as que podem quebrar o jogo ficam caríssimas rápido
    const revival = META_UPGRADES.find((d) => d.id === 'revival')!;
    expect(metaCost(revival, 5)).toBeGreaterThan(100000);
    const mods = metaModifiers({ power: 10 });
    expect(mods[0].flat).toBeCloseTo(0.5);
  });
  it('heróis definem arma inicial válida', () => {
    for (const c of CHARACTERS) expect(WEAPONS[c.weapon]).toBeDefined();
  });
  it('save antigo é migrado', () => {
    const s = migrate({ gold: 50, meta: { might: 2, armor: 1, reroll: 1 } });
    expect(s.meta.power).toBe(2);
    expect(s.meta.defense).toBe(1);
    expect(s.meta.reroll).toBe(1);
    expect(s.gold).toBe(50);
  });
  it('estrelas antigas viram o progresso da dificuldade Normal', () => {
    const s = migrate({ version: 2, stars: { clareira: [true, false, true] } });
    expect(s.tiers.clareira?.[0]).toEqual({ stars: [true, false, true], bosses: 3 });
    expect((s as unknown as { stars?: unknown }).stars).toBeUndefined();
  });
});

describe('formatação', () => {
  it('números grandes', () => {
    expect(formatNumber(950)).toBe('950');
    expect(formatNumber(1200)).toBe('1,2K');
    expect(formatNumber(3_400_000)).toBe('3,4M');
    expect(formatNumber(15_000)).toBe('15K');
    expect(formatNumber(1.5e30)).toContain('e');
  });
});

describe('resistência a controle', () => {
  it('monstro comum sofre o controle inteiro; resistente ignora às vezes e sofre menos', () => {
    expect(controlRoll(0, () => 0)).toBe(1);
    const boss = ENEMIES.demon.resist;
    expect(controlRoll(boss, () => 0)).toBe(0);
    const f = controlRoll(boss, () => 0.99);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(0.6);
    expect(controlScale(boss)).toBeCloseTo(1 - boss * CONTROL_RULES.reduce);
  });
  it('chefe resiste mais que monstros comuns', () => {
    for (const e of Object.values(ENEMIES)) if (!e.boss) expect(e.resist, e.id).toBeLessThan(ENEMIES.demon.resist);
    expect(ENEMIES.slime.resist).toBe(0);
  });
});

describe('fases', () => {
  it('a próxima fase libera ao vencer o chefe da anterior', () => {
    expect(stageUnlocked(0, {})).toBe(true);
    expect(stageUnlocked(1, {})).toBe(false);
    expect(stageUnlocked(1, { clareira: [{ stars: [true, false, false], bosses: 3 }] })).toBe(true);
    expect(stageUnlocked(2, { clareira: [{ stars: [true, false, false], bosses: 3 }] })).toBe(false);
    expect(stageUnlocked(5, {}, true)).toBe(true);
  });
  it('fases jogáveis têm chefe, ondas com inimigos existentes e o evento do objetivo', () => {
    for (const st of STAGES.filter((s) => s.playable)) {
      for (const b of st.bosses) expect(ENEMIES[b].boss, `${st.id}:${b}`).toBe(true);
      for (const w of st.waves) for (const id of w.pool) expect(ENEMIES[id], `${st.id}:${id}`).toBeDefined();
      for (const o of st.objectives) if (o.kind === 'event') expect(st.events).toContain(o.event);
    }
  });
  it('inimigos com habilidade têm o comportamento certo', () => {
    for (const e of Object.values(ENEMIES)) if (e.behavior && e.behavior !== 'melee') expect(e.skill, e.id).toBeDefined();
  });
  it('tribos da guerra e criaturas da fase existem e não são chefes', () => {
    for (const st of STAGES.filter((s) => s.playable)) {
      for (const tribe of st.tribes ?? []) for (const id of tribe.pool) expect(ENEMIES[id].boss, `${st.id}:${id}`).toBeFalsy();
      for (const id of [st.swarm, ...(st.ring ?? [])]) if (id) expect(ENEMIES[id], `${st.id}:${id}`).toBeDefined();
    }
  });
  it('cada criatura pertence a uma fase só (ondas, cerco, revoada, tribos e chefes)', () => {
    const owner = new Map<string, string>();
    for (const st of STAGES.filter((s) => s.playable)) {
      const ids = new Set<string>([...st.waves.flatMap((w) => w.pool), ...(st.ring ?? []), ...(st.swarm ? [st.swarm] : []), ...(st.tribes ?? []).flatMap((t) => t.pool), ...st.bosses]);
      for (const id of ids) {
        expect(owner.get(id) ?? st.id, `${id} em ${owner.get(id)} e ${st.id}`).toBe(st.id);
        owner.set(id, st.id);
      }
    }
  });
  it('as fases ficam mais difíceis ao longo do mapa', () => {
    const playable = STAGES.filter((s) => s.playable);
    for (let i = 1; i < playable.length; i++) expect(playable[i].difficulty).toBeGreaterThan(playable[i - 1].difficulty);
  });
});

describe('itens', () => {
  it('raridade define quantos atributos e se tem efeito único', () => {
    const rnd = () => 0.3;
    expect(makeItem(1, 0, 1, rnd).rolls.length).toBe(0);
    expect(makeItem(2, 0, 1, rnd).effect).toBeUndefined();
    const raro = makeItem(3, 2, 1, rnd);
    expect(raro.rolls.length).toBe(2);
    expect(raro.effect).toBeDefined();
    expect(makeItem(4, 5, 1, rnd).rolls.length).toBe(4);
  });
  it('item mais raro, de nível maior ou forjado é mais forte', () => {
    const a = makeItem(1, 1, 1, () => 0.5, 'boots');
    const b = { ...a, rarity: 3 };
    const c = { ...a, ilvl: 10 };
    const d = { ...a, forge: 5 };
    for (const x of [b, c, d]) expect(itemPower(x)).toBeGreaterThan(itemPower(a));
  });
  it('forja não tem teto e fica mais cara', () => {
    const it = makeItem(1, 2, 3, () => 0.5);
    const c1 = forgeCost(it);
    const c2 = forgeCost({ ...it, forge: 20 });
    expect(c2.gold).toBeGreaterThan(c1.gold);
    expect(c2.dust).toBeGreaterThan(c1.dust);
  });
  it('mochila cheia desmancha os mais fracos e nunca o equipado', () => {
    const save = migrate({ version: 2 });
    const weak = makeItem(nextUid(save), 0, 1, () => 0.5, 'ring');
    addItems(save, [weak]);
    equip(save, weak.uid);
    const many = Array.from({ length: BAG_SIZE + 5 }, () => makeItem(nextUid(save), 2, 5, Math.random));
    addItems(save, many);
    expect(save.items.length).toBe(BAG_SIZE);
    expect(save.items.some((i) => i.uid === weak.uid)).toBe(true);
    expect(save.dust).toBeGreaterThan(0);
  });
  it('dois anéis ocupam os dois espaços de anel', () => {
    const save = migrate({ version: 2 });
    const r1 = makeItem(nextUid(save), 1, 1, Math.random, 'ring');
    const r2 = makeItem(nextUid(save), 1, 1, Math.random, 'signet');
    addItems(save, [r1, r2]);
    equip(save, r1.uid);
    equip(save, r2.uid);
    expect(save.equipped.ring1).toBe(r1.uid);
    expect(save.equipped.ring2).toBe(r2.uid);
    expect(equipmentModifiers(save).length).toBeGreaterThanOrEqual(4);
  });
  it('baú: 1 item por sobreviver, +1 por chefe, +1 na vitória', () => {
    expect(lootCount(60, 0, false)).toBe(0);
    expect(lootCount(200, 0, false)).toBe(1);
    expect(lootCount(900, 3, true)).toBe(5);
  });
  it('sorte e bônus deixam itens mais raros em média', () => {
    let s = 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const avg = (luck: number, bonus: number) => {
      let t = 0;
      for (let i = 0; i < 2000; i++) t += rollItemRarity(luck, bonus, 0, rnd);
      return t / 2000;
    };
    expect(avg(100, 0.5)).toBeGreaterThan(avg(0, 0));
  });
});

describe('pets', () => {
  it('evolui nos níveis 10 e 20', () => {
    expect([1, 9, 10, 19, 20, 50].map(petStage)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(petXpToNext(10)).toBeGreaterThan(petXpToNext(1));
  });
  it('ovo choca com tempo de partida; o primeiro choca rápido; repetido vira XP', () => {
    const s = migrate({});
    expect(addEgg(s, 'dragon')).toBe(true);
    addEgg(s, 'dragon');
    expect(s.eggs[0].need).toBeLessThan(s.eggs[1].need);
    expect(hatch(s, s.eggs[0].uid)).toBeUndefined();
    incubate(s, 10_000);
    const first = hatch(s, s.eggs[0].uid)!;
    expect(first.isNew).toBe(true);
    expect(s.activePet).toBe('dragon');
    incubate(s, 10_000);
    const dup = hatch(s, s.eggs[0].uid)!;
    expect(dup.isNew).toBe(false);
    expect(s.pets.dragon!.level).toBeGreaterThan(1);
  });
  it('XP sobe vários níveis e a ração custa ouro', () => {
    const s = migrate({});
    s.pets.dragon = { level: 1, xp: 0 };
    expect(addPetXp(s, 'dragon', 1000)).toBeGreaterThan(3);
    s.gold = 0;
    expect(feed(s, 'dragon')).toBe(false);
    s.gold = 1e6;
    expect(feed(s, 'dragon')).toBe(true);
  });
  it('ovos: chance limitada e pet da fase', () => {
    expect(eggChance(3, true, 50)).toBeLessThanOrEqual(0.9);
    expect(eggChance(0, false, 0)).toBe(0);
    expect(rollEggPet('outono')).toBe('dragon');
    for (const p of PETS.filter((x) => x.available)) for (const t of [...p.textures, p.egg]) expect(SPRITES).toHaveProperty(t);
  });
});
