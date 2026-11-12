import {describe, expect, it} from 'vitest';
import type {MoveTable, SpeciesData} from '../data/types';
import {calcMoves, setStats, spProblems, usageSet, withSpread} from './calcset';
import {meta, move} from './test-fixtures';

const moves: MoveTable = {
  grassyglide: move('Grassy Glide', 'Grass', {basePower: 55}),
  woodhammer: move('Wood Hammer', 'Grass', {basePower: 120}),
  fakeout: move('Fake Out', 'Normal', {basePower: 40, priority: 3}),
  uturn: move('U-turn', 'Bug', {basePower: 70}),
  protect: move('Protect', 'Normal', {category: 'Status'}),
  icepunch: move('Ice Punch', 'Ice', {basePower: 75}),
  wavecrash: move('Wave Crash', 'Water', {basePower: 120}),
};
const rillaboomSpecies: SpeciesData = {
  name: 'Rillaboom', types: ['Grass'], baseStats: {hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85}, abilities: ['Overgrow', 'Grassy Surge'],
};
const swampertSpecies: SpeciesData = {
  name: 'Swampert-Mega', types: ['Water', 'Ground'], baseStats: {hp: 100, atk: 150, def: 110, spa: 95, spd: 110, spe: 70}, abilities: ['Swift Swim'],
  baseSpecies: 'Swampert', requiredItem: 'Swampertite',
};
const rillaboom = meta('Rillaboom', 0.27, {}, {
  forms: [{name: 'Rillaboom', types: ['Grass'], weight: 1, abilities: {'Grassy Surge': 0.99}}],
  moves: {'Grassy Glide': 0.99, 'Fake Out': 0.99, 'Wood Hammer': 0.87, 'U-turn': 0.51, Protect: 0.13},
  items: {'Miracle Seed': 0.74, 'Life Orb': 0.08},
  spreads: {'Adamant:15/32/0/0/0/19': 0.05, 'Adamant:32/32/0/0/0/2': 0.04},
});

describe('usageSet', () => {
  const set = usageSet(rillaboom, rillaboomSpecies, moves);
  it('takes the most common ability, item and spread', () => {
    expect(set.ability).toBe('Grassy Surge');
    expect(set.item).toBe('Miracle Seed');
    expect(set.nature).toBe('Adamant');
    expect(set.sp).toEqual({hp: 15, atk: 32, def: 0, spa: 0, spd: 0, spe: 19});
  });
  it('picks its four most used damaging moves first', () => {
    expect(set.moves).toEqual(['Grassy Glide', 'Fake Out', 'Wood Hammer', 'U-turn']);
  });
  it('falls back to base data for a Pokémon without usage data', () => {
    const unused = usageSet(meta('Rillaboom', 0, {}), rillaboomSpecies, moves);
    expect(unused.ability).toBe('Overgrow');
    expect(unused.moves).toEqual(['', '', '', '']);
    expect(unused.nature).toBe('Serious');
  });
});

describe('set helpers', () => {
  it('applies a chosen spread and computes Champions stats', () => {
    const set = withSpread(usageSet(rillaboom, rillaboomSpecies, moves), 'Jolly:2/32/0/0/0/32');
    expect(set.nature).toBe('Jolly');
    expect(setStats(set, rillaboomSpecies)).toMatchObject({hp: 177, atk: 177, spe: 150});
  });
  it('reports stat point problems', () => {
    expect(spProblems({hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0})).toEqual([]);
    expect(spProblems({hp: 33, atk: 32, def: 2, spa: 0, spd: 0, spe: 0})).toHaveLength(2);
  });
});

describe('calcMoves', () => {
  it('runs every move both ways with the field and side conditions', () => {
    const a = {set: usageSet(rillaboom, rillaboomSpecies, moves), species: rillaboomSpecies};
    const b = {
      set: {...usageSet(rillaboom, rillaboomSpecies, moves), id: 'swampertmega', ability: 'Swift Swim', item: 'Swampertite', nature: 'Adamant',
        sp: {hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32}, moves: ['Wave Crash', 'Ice Punch', 'Protect', '']},
      species: swampertSpecies,
    };
    const grassy = {weather: '' as const, terrain: 'grassy' as const};
    const forward = calcMoves(a, b, moves, grassy, {}, {}, false);
    const glide = forward.find(r => r.name === 'Grassy Glide')!.estimate!;
    expect([glide.rolls[0], glide.rolls[15]]).toEqual([292, 348]);
    const back = calcMoves(b, a, moves, grassy, {}, {reflect: true}, false);
    expect(back.map(r => r.name)).toEqual(['Wave Crash', 'Ice Punch', 'Protect']);
    expect(back.find(r => r.name === 'Protect')!.estimate).toBeNull();
    const plainIce = calcMoves(b, a, moves, grassy, {}, {}, false).find(r => r.name === 'Ice Punch')!.estimate!;
    expect(back.find(r => r.name === 'Ice Punch')!.estimate!.max).toBeLessThan(plainIce.max);
  });
});
