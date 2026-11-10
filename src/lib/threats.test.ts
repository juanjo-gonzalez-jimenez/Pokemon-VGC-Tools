import {describe, expect, it} from 'vitest';
import type {MoveTable} from '../data/types';
import {threatList} from './threats';
import {member, meta, move, species} from './test-fixtures';

const moves: MoveTable = {
  earthquake: move('Earthquake', 'Ground'),
  surf: move('Surf', 'Water'),
  protect: move('Protect', 'Normal', {category: 'Status'}),
};

describe('threatList', () => {
  // Three Fire types that only attack with Fire moves.
  const team = ['A', 'B', 'C'].map(n =>
    member(species(n, ['Fire'], 80), '', {moves: [move('Flare Blitz', 'Fire')]}),
  );
  const roster = [
    // Water attacker, resists Fire, faster than everyone: the worst matchup.
    meta('Drowner', 0.3, {'200': 1}, {forms: [{name: 'Drowner', types: ['Water'], weight: 1, abilities: {}}], moves: {Surf: 1, Protect: 0.9}}),
    // Grass type with no damaging moves listed: weak to Fire, slow.
    meta('Leafy', 0.3, {'50': 1}, {forms: [{name: 'Leafy', types: ['Grass'], weight: 1, abilities: {}}], moves: {Protect: 1}}),
  ];
  const [first, second] = threatList(team, roster, moves);

  it('ranks the Pokémon that hits everyone and is not answered first', () => {
    expect(first.pokemon.name).toBe('Drowner');
    expect(first.hits.map(h => h.label)).toEqual(['A', 'B', 'C']);
    expect(first.answers).toEqual([]);
    expect(first.fasterThan).toEqual(['A', 'B', 'C']);
    expect(first.severity).toBeCloseTo(1);
  });
  it('scores an answered, slow Pokémon low', () => {
    expect(second.answers).toEqual(['A', 'B', 'C']);
    expect(second.severity).toBeCloseTo(0);
  });
  it('weights a move by how many sets run it, so a rare coverage move is not a threat', () => {
    const dragons = [member(species('Chomp', ['Dragon', 'Ground'], 80), '', {moves: [move('Flare Blitz', 'Fire')]})];
    const moveTable: MoveTable = {...moves, dragonpulse: move('Dragon Pulse', 'Dragon', {category: 'Special'})};
    const strong = {hp: 155, atk: 100, def: 100, spa: 200, spd: 100, spe: 100};
    const zard = (share: number) =>
      meta('Zard', 0.3, {'100': 1}, {forms: [{name: 'Zard', types: ['Fire', 'Flying'], weight: 1, abilities: {}}], moves: {'Dragon Pulse': share}, stats: strong});
    // Dragon Pulse on 31% of sets: the expected hit is too small to 2HKO.
    expect(threatList(dragons, [zard(0.31)], moveTable)[0].hits).toEqual([]);
    // On every set it 2HKOs.
    const [t] = threatList(dragons, [zard(1)], moveTable);
    expect(t.hits).toEqual([expect.objectContaining({label: 'Chomp', move: 'Dragon Pulse', hitsToKO: 2})]);
  });
  it('types Weather Ball by the user\'s weather ability', () => {
    const grass = [member(species('Leaf', ['Grass'], 80))];
    const moveTable: MoveTable = {...moves, weatherball: move('Weather Ball', 'Normal', {category: 'Special'})};
    const sunZard = meta('SunZard', 0.3, {'100': 1}, {
      forms: [{name: 'SunZard', types: ['Fire', 'Flying'], weight: 1, abilities: {Drought: 1}}],
      moves: {'Weather Ball': 0.97},
    });
    const [t] = threatList(grass, [sunZard], moveTable);
    expect(t.attackTypes).toEqual(['Fire']);
    expect(t.hits.map(h => h.label)).toEqual(['Leaf']);
  });
  it('ignores moves run on fewer than 15% of sets', () => {
    const rare = meta('Rare', 0.3, {'50': 1}, {forms: [{name: 'Rare', types: ['Normal'], weight: 1, abilities: {}}], moves: {Surf: 0.1}});
    expect(threatList(team, [rare], moves)[0].attackTypes).toEqual([]);
  });
});
