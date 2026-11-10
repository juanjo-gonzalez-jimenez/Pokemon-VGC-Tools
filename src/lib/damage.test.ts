import {describe, expect, it} from 'vitest';
import {estimateDamage, hitsToKO, koLabel, movePriority, type Combatant, type Field} from './damage';
import {move} from './test-fixtures';

const stats = (s: Partial<Combatant['stats']>) => ({hp: 150, atk: 100, def: 100, spa: 100, spd: 100, spe: 100, ...s});
const mon = (name: string, types: string[], s: Partial<Combatant['stats']>, ability = '', item = ''): Combatant => ({
  name, types, ability, item, stats: stats(s),
});
const grassy: Field = {weather: '', terrain: 'grassy'};

// The user's Rillaboom (Adamant 15 HP / 32 Atk) and an average Mega Swampert from usage stats.
const rillaboom = mon('Rillaboom', ['Grass'], {hp: 190, atk: 194, def: 110, spd: 90}, 'Grassy Surge', 'Miracle Seed');
const swampert = mon('Swampert-Mega', ['Water', 'Ground'], {hp: 186, atk: 217, def: 131, spd: 130}, 'Swift Swim', 'Swampertite');
const grassyGlide = move('Grassy Glide', 'Grass', {basePower: 55});
const icePunch = move('Ice Punch', 'Ice', {basePower: 75});

describe('estimateDamage', () => {
  it('matches a hand-worked Lv. 50 calc: STAB, terrain, item and a 4× hit', () => {
    // power 55 × 1.3 × 1.2 = 85.8; ⌊⌊22·85.8·194/131⌋/50⌋+2 = 57; ×1.5 ×4 = 342; ×0.925 / 186 HP.
    const e = estimateDamage(rillaboom, swampert, grassyGlide, grassy)!;
    expect(e.mult).toBe(4);
    expect(e.percent).toBeCloseTo((342 * 0.925 * 100) / 186, 0);
    expect(koLabel(e.percent)).toBe('OHKO');
  });
  it('rates 2× non-STAB coverage well below 4× STAB', () => {
    // ⌊⌊22·75·217/110⌋/50⌋+2 = 67; ×2 = 134; ×0.925 / 190 HP ≈ 65%.
    const e = estimateDamage(swampert, rillaboom, icePunch, grassy)!;
    expect(e.percent).toBeCloseTo((134 * 0.925 * 100) / 190, 0);
    expect(koLabel(e.percent)).toBe('2HKO');
  });
  it('gives Grassy Glide priority only in Grassy Terrain and for grounded users', () => {
    expect(movePriority(grassyGlide, rillaboom, grassy)).toBe(1);
    expect(movePriority(grassyGlide, rillaboom, {weather: '', terrain: ''})).toBe(0);
    expect(movePriority(grassyGlide, {...rillaboom, ability: 'Levitate'}, grassy)).toBe(0);
  });
  it('applies the spread penalty, weather and Weather Ball', () => {
    const attacker = mon('A', ['Normal'], {spa: 150});
    const target = mon('B', ['Normal'], {});
    const single = estimateDamage(attacker, target, move('Water Pulse', 'Water', {category: 'Special', basePower: 60}))!;
    const spread = estimateDamage(attacker, target, move('Surf', 'Water', {category: 'Special', basePower: 60, target: 'allAdjacent'}))!;
    expect(spread.percent / single.percent).toBeCloseTo(0.75, 1);
    const rain = estimateDamage(attacker, target, move('Water Pulse', 'Water', {category: 'Special', basePower: 60}), {weather: 'rain', terrain: ''})!;
    expect(rain.percent / single.percent).toBeCloseTo(1.5, 1);
    const ball = estimateDamage(attacker, target, move('Weather Ball', 'Normal', {category: 'Special', basePower: 50}), {weather: 'sun', terrain: ''})!;
    expect(ball.type).toBe('Fire');
  });
  it('halves Earthquake in Grassy Terrain against grounded targets', () => {
    const eq = move('Earthquake', 'Ground', {basePower: 100});
    const target = mon('B', ['Fire'], {});
    const plain = estimateDamage(swampert, target, eq)!;
    const terrain = estimateDamage(swampert, target, eq, grassy)!;
    expect(terrain.percent / plain.percent).toBeCloseTo(0.5, 1);
  });
  it('uses the right stats for Foul Play, Body Press and Psyshock', () => {
    const weak = mon('Weak', ['Normal'], {atk: 50, def: 200, spa: 50});
    const target = mon('Strong', ['Normal'], {atk: 200, def: 60, spd: 200});
    const foul = estimateDamage(weak, target, move('Foul Play', 'Dark', {basePower: 95, offensive: 'target'}))!;
    const crunch = estimateDamage(weak, target, move('Crunch', 'Dark', {basePower: 95}))!;
    expect(foul.percent).toBeGreaterThan(crunch.percent * 3);
    const press = estimateDamage(weak, target, move('Body Press', 'Fighting', {basePower: 80, offensive: 'def'}))!;
    const punch = estimateDamage(weak, target, move('Brick Break', 'Fighting', {basePower: 80}))!;
    expect(press.percent).toBeGreaterThan(punch.percent * 3);
    const psyshock = estimateDamage(weak, target, move('Psyshock', 'Psychic', {category: 'Special', basePower: 80, defensive: 'def'}))!;
    const psychic = estimateDamage(weak, target, move('Psychic', 'Psychic', {category: 'Special', basePower: 80}))!;
    expect(psyshock.percent).toBeGreaterThan(psychic.percent * 2);
  });
  it('counts multi-hit moves and Skill Link', () => {
    const blast = move('Rock Blast', 'Rock', {basePower: 25, multihit: [2, 5]});
    const target = mon('B', ['Normal'], {});
    expect(estimateDamage(mon('A', ['Rock'], {}), target, blast)!.hits).toBe(3);
    expect(estimateDamage(mon('A', ['Rock'], {}, 'Skill Link'), target, blast)!.hits).toBe(5);
  });
  it('applies items, berries and Multiscale', () => {
    const plain = estimateDamage(swampert, rillaboom, icePunch)!.percent;
    expect(estimateDamage({...swampert, item: 'Life Orb'}, rillaboom, icePunch)!.percent / plain).toBeCloseTo(1.3, 1);
    expect(estimateDamage(swampert, {...rillaboom, item: 'Yache Berry'}, icePunch)!.percent / plain).toBeCloseTo(0.5, 1);
    expect(estimateDamage(swampert, {...rillaboom, ability: 'Multiscale'}, icePunch)!.percent / plain).toBeCloseTo(0.5, 1);
  });
  it('returns zero against immunities and null for status moves', () => {
    expect(estimateDamage(swampert, mon('F', ['Flying'], {}), move('Earthquake', 'Ground'))!.percent).toBe(0);
    expect(estimateDamage(swampert, rillaboom, move('Protect', 'Normal', {category: 'Status'}))).toBeNull();
  });
});

describe('hitsToKO', () => {
  it('rounds up and handles no damage', () => {
    expect(hitsToKO(100)).toBe(1);
    expect(hitsToKO(50)).toBe(2);
    expect(hitsToKO(49)).toBe(3);
    expect(hitsToKO(0)).toBe(Infinity);
    expect(koLabel(10)).toBe('chip');
  });
});
