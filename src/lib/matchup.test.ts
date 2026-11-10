import {describe, expect, it} from 'vitest';
import type {MetaPokemon, MoveTable} from '../data/types';
import {matchupGrid, pairScore, previewForms, suggestBrings} from './matchup';
import {member, meta, move, species} from './test-fixtures';

const moves: MoveTable = {
  flamethrower: move('Flamethrower', 'Fire', {category: 'Special'}),
  earthquake: move('Earthquake', 'Ground'),
  protect: move('Protect', 'Normal', {category: 'Status'}),
};
const form = (name: string, types: string[]) => [{name, types, weight: 1, abilities: {}}];
/** A Fire-type opponent that attacks with Flamethrower at 100 Speed. */
const fireOpp = (name: string, extra: Partial<MetaPokemon> = {}) =>
  meta(name, 0.2, {'100': 1}, {forms: form(name, ['Fire']), moves: {Flamethrower: 1}, ...extra});

const attacker = (name: string, types: string[], attackType: string, spe: number, extraMoves = [] as ReturnType<typeof move>[]) =>
  member(species(name, types, spe), '', {moves: [move(`${attackType} Attack`, attackType), ...extraMoves]});

describe('pairScore', () => {
  const water = attacker('Water', ['Water'], 'Water', 120);
  const grass = attacker('Grass', ['Grass'], 'Grass', 50);
  const opp = fireOpp('Blaze');

  it('favours the Pokémon that hits harder, takes less and acts first', () => {
    const good = pairScore(water, opp, moves);
    const bad = pairScore(grass, opp, moves);
    expect(good.mine!.mult).toBe(2);
    expect(good.theirs!.estimate.mult).toBe(0.5);
    expect(good.first).toBe(1);
    expect(good.win).toBe(1);
    expect(bad.theirs!.estimate.mult).toBe(2);
    expect(good.total).toBeGreaterThan(0.8);
    expect(bad.total).toBeLessThan(0.3);
  });
  it('assumes STAB attacks and even Speed when the opponent has no usage data', () => {
    const unknown = meta('Unknown', 0, {}, {forms: form('Unknown', ['Fire'])});
    const s = pairScore(water, unknown, moves);
    expect(s.theirs!.assumed).toBe(true);
    expect(s.theirs!.move.type).toBe('Fire');
    expect(s.first).toBe(0.5);
  });
  it('builds a grid of your team against theirs', () => {
    const grid = matchupGrid([water, grass], [opp, fireOpp('Other')], moves);
    expect(grid).toHaveLength(2);
    expect(grid[0]).toHaveLength(2);
  });
});

describe('suggestBrings', () => {
  const opponents = ['A', 'B', 'C', 'D', 'E', 'F'].map(n => fireOpp(n));
  const team = [
    attacker('Water1', ['Water'], 'Water', 120),
    attacker('Grass1', ['Grass'], 'Grass', 50),
    attacker('Water2', ['Water'], 'Water', 110),
    attacker('Grass2', ['Grass'], 'Grass', 50),
    attacker('Normal1', ['Normal'], 'Normal', 90),
    attacker('Normal2', ['Normal'], 'Normal', 90),
  ];

  it('leads with the best matchups and benches the worst', () => {
    const [best] = suggestBrings(team, opponents, moves);
    expect(best.leads.map(m => m.label).sort()).toEqual(['Water1', 'Water2']);
    expect(best.bench.map(m => m.label).sort()).toEqual(['Grass1', 'Grass2']);
    expect(best.back.map(m => m.label).sort()).toEqual(['Normal1', 'Normal2']);
    expect(best.reasons.some(r => r.includes('Grass1 stays out: loses to'))).toBe(true);
  });
  it('returns one entry per group of four, best first', () => {
    const all = suggestBrings(team, opponents, moves, 'normal', 99);
    expect(all).toHaveLength(15);
    expect(all[0].score).toBeGreaterThanOrEqual(all[1].score);
  });
  it('prefers a Fake Out user as a lead, all else equal', () => {
    const fakeOut = move('Fake Out', 'Normal', {priority: 3});
    const twins = [
      attacker('Plain1', ['Normal'], 'Normal', 90),
      attacker('Plain2', ['Normal'], 'Normal', 90),
      attacker('Faker', ['Normal'], 'Normal', 90, [fakeOut]),
      attacker('Plain3', ['Normal'], 'Normal', 90),
    ];
    const [best] = suggestBrings(twins, opponents, moves);
    expect(best.leads.map(m => m.label)).toContain('Faker');
    expect(best.reasons.some(r => r.includes('Fake Out pressure from Faker'))).toBe(true);
  });
  it('warns when most of the four share a weakness', () => {
    const grassTeam = ['G1', 'G2', 'G3', 'G4'].map(n => attacker(n, ['Grass'], 'Grass', 50));
    // Strong enough to OHKO each of them with Flamethrower.
    const blaze = fireOpp('Blaze', {stats: {hp: 155, atk: 100, def: 100, spa: 200, spd: 100, spe: 100}});
    const [only] = suggestBrings(grassTeam, [blaze], moves);
    expect(only.warnings[0]).toMatch(/Blaze can likely OHKO \d of these four/);
  });
  it('handles small teams and empty input', () => {
    expect(suggestBrings([], opponents, moves)).toEqual([]);
    expect(suggestBrings(team, [], moves)).toEqual([]);
    const [solo] = suggestBrings(team.slice(0, 1), opponents, moves);
    expect(solo.leads).toHaveLength(1);
    expect(solo.back).toHaveLength(0);
  });
});

describe('previewForms', () => {
  const dex = [
    meta('Charizard', 0.001, {}, {forms: form('Charizard', ['Fire', 'Flying'])}),
    meta('Charizard-Mega-Y', 0.32, {}, {id: 'charizardmegay', baseSprite: 'charizard'}),
    meta('Charizard-Mega-X', 0.01, {}, {id: 'charizardmegax', baseSprite: 'charizard'}),
    meta('Rotom-Wash', 0.05, {}, {id: 'rotomwash', baseSprite: 'rotom'}),
    meta('Rotom-Heat', 0.02, {}, {id: 'rotomheat', baseSprite: 'rotom'}),
  ];
  it('lists the base form and its Megas, most used first', () => {
    expect(previewForms(dex[0], dex).map(p => p.name)).toEqual(['Charizard-Mega-Y', 'Charizard-Mega-X', 'Charizard']);
    expect(previewForms(dex[1], dex).map(p => p.name)).toEqual(['Charizard-Mega-Y', 'Charizard-Mega-X', 'Charizard']);
  });
  it('does not mix regular forms that are distinct at team preview', () => {
    expect(previewForms(dex[3], dex).map(p => p.name)).toEqual(['Rotom-Wash']);
  });
});
