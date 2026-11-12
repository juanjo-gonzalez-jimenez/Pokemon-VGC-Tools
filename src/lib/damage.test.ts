import {describe, expect, it} from 'vitest';
import {estimateDamage, hitsToKO, koLabel, movePriority, type Combatant, type Field} from './damage';
import {calcStat, STATS, type StatsTable} from './stats';
import {move} from './test-fixtures';

const sp = (s: Partial<StatsTable>): StatsTable => ({hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...s});
const BASE: Record<string, StatsTable> = {
  Rillaboom: {hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85},
  'Swampert-Mega': {hp: 100, atk: 150, def: 110, spa: 95, spd: 110, spe: 70},
  'Salamence-Mega': {hp: 95, atk: 145, def: 130, spa: 120, spd: 90, spe: 120},
};
const TYPES: Record<string, string[]> = {
  Rillaboom: ['Grass'],
  'Swampert-Mega': ['Water', 'Ground'],
  'Salamence-Mega': ['Dragon', 'Flying'],
};
/** A real build: species, nature and stat points, with stats from our Champions formula. */
const built = (species: string, nature: string, points: Partial<StatsTable>, ability: string, item = ''): Combatant => {
  const build = {nature, sp: sp(points)};
  const stats = Object.fromEntries(STATS.map(s => [s, calcStat(s, BASE[species][s], build.sp[s], nature)])) as StatsTable;
  return {name: species, species, types: TYPES[species], ability, item, stats, build};
};

// The user's Rillaboom and a common Mega Swampert / Mega Salamence build.
const rillaboom = built('Rillaboom', 'Adamant', {hp: 15, atk: 32, spe: 19}, 'Grassy Surge', 'Miracle Seed');
const swampert = built('Swampert-Mega', 'Adamant', {hp: 2, atk: 32, spe: 32}, 'Swift Swim', 'Swampertite');
const salamence = built('Salamence-Mega', 'Timid', {spa: 32, spe: 32}, 'Aerilate', 'Salamencite');
const grassy: Field = {weather: '', terrain: 'grassy'};
const grassyGlide = move('Grassy Glide', 'Grass', {basePower: 55});
const icePunch = move('Ice Punch', 'Ice', {basePower: 75});
const hyperVoice = move('Hyper Voice', 'Normal', {category: 'Special', basePower: 90, target: 'allAdjacentFoes', sound: true});

describe('estimateDamage (Smogon calculator, Champions mode)', () => {
  it('gives the same max HP as our stat formula, for real builds and for given stats', () => {
    expect(estimateDamage(swampert, rillaboom, icePunch)!.maxHp).toBe(rillaboom.stats.hp);
    const average: Combatant = {...rillaboom, build: undefined, stats: {hp: 201, atk: 179, def: 111, spa: 73, spd: 103, spe: 111}};
    expect(estimateDamage(swampert, average, icePunch)!.maxHp).toBe(201);
  });
  it('matches the calculator exactly: Grassy Glide vs Mega Swampert in Grassy Terrain', () => {
    const e = estimateDamage(rillaboom, swampert, grassyGlide, grassy)!;
    expect(e.rolls).toHaveLength(16);
    expect([e.rolls[0], e.rolls[15]]).toEqual([292, 348]);
    expect(e.koText).toBe('guaranteed OHKO');
    expect(e.priority).toBe(1);
  });
  it('rates 2× non-STAB coverage well below 4× STAB', () => {
    const e = estimateDamage(swampert, rillaboom, icePunch, grassy)!;
    expect([Math.min(...e.rolls), Math.max(...e.rolls)]).toEqual([114, 136]);
    expect(e.koText).toContain('2HKO');
  });
  it('applies Aerilate and the spread penalty, unless the move hits a single target', () => {
    const spread = estimateDamage(salamence, rillaboom, hyperVoice)!;
    expect(spread.type).toBe('Flying');
    expect([Math.min(...spread.rolls), Math.max(...spread.rolls)]).toEqual([174, 206]);
    expect(spread.koText).toBe('50% chance to OHKO');
    const single = estimateDamage(salamence, rillaboom, hyperVoice, undefined, {singleTarget: true})!;
    expect(single.max / spread.max).toBeCloseTo(4 / 3, 1);
  });
  it('applies screens, Helping Hand, crits, burn and boosts', () => {
    const plain = estimateDamage(swampert, rillaboom, icePunch)!.max;
    const reflect = estimateDamage(swampert, rillaboom, icePunch, undefined, {defenderSide: {reflect: true}})!.max;
    expect(reflect / plain).toBeCloseTo(2732 / 4096, 1);
    const lightScreen = estimateDamage(swampert, rillaboom, icePunch, undefined, {defenderSide: {lightScreen: true}})!.max;
    expect(lightScreen).toBe(plain);
    const helped = estimateDamage(swampert, rillaboom, icePunch, undefined, {attackerSide: {helpingHand: true}})!.max;
    expect(helped / plain).toBeCloseTo(1.5, 1);
    const crit = estimateDamage(swampert, rillaboom, icePunch, undefined, {crit: true, defenderSide: {reflect: true}})!.max;
    expect(crit / plain).toBeCloseTo(1.5, 1);
    const burned = estimateDamage({...swampert, status: 'brn'}, rillaboom, icePunch)!.max;
    expect(burned / plain).toBeCloseTo(0.5, 1);
    const boosted = estimateDamage({...swampert, boosts: {atk: 2}}, rillaboom, icePunch)!.max;
    expect(boosted / plain).toBeCloseTo(2, 1);
  });
  it('reads KO chances from the current HP', () => {
    const half = estimateDamage(swampert, {...rillaboom, hpPercent: 50}, icePunch)!;
    expect(half.koText).toBe('guaranteed OHKO');
  });
  it('types Weather Ball by the weather on the field', () => {
    const ball = move('Weather Ball', 'Normal', {category: 'Special', basePower: 50});
    expect(estimateDamage(salamence, rillaboom, ball, {weather: 'sun', terrain: ''})!.type).toBe('Fire');
  });
  it('handles species the calculator does not know, keeping their types', () => {
    const odd: Combatant = {name: 'Odd', species: 'Notamon', types: ['Fire'], ability: '', item: '', stats: {hp: 150, atk: 120, def: 100, spa: 100, spd: 100, spe: 100}};
    const flare = move('Flare Blitz', 'Fire', {basePower: 120});
    expect(estimateDamage(odd, rillaboom, flare)!.mult).toBe(2);
    expect(estimateDamage(odd, rillaboom, flare)!.percent).toBeGreaterThan(0);
  });
  it('computes weight-based moves such as Low Kick', () => {
    const lowKick = move('Low Kick', 'Fighting', {basePower: 0});
    expect(estimateDamage(rillaboom, swampert, lowKick)!.percent).toBeGreaterThan(0);
  });
  it('returns zero against immunities and null for status moves', () => {
    expect(estimateDamage(swampert, salamence, move('Earthquake', 'Ground', {basePower: 100}))!.percent).toBe(0);
    expect(estimateDamage(swampert, rillaboom, move('Protect', 'Normal', {category: 'Status'}))).toBeNull();
  });
  it('gives Grassy Glide priority only in Grassy Terrain and for grounded users', () => {
    expect(movePriority(grassyGlide, rillaboom, grassy)).toBe(1);
    expect(movePriority(grassyGlide, rillaboom, {weather: '', terrain: ''})).toBe(0);
    expect(movePriority(grassyGlide, {...rillaboom, ability: 'Levitate'}, grassy)).toBe(0);
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
