import {describe, expect, it} from 'vitest';
import type {MetaPokemon, MoveTable, SpeciesTable} from '../data/types';
import {suggestTeammates} from './teammates';
import {member, meta, move, species} from './test-fixtures';

const moves: MoveTable = {
  tailwind: move('Tailwind', 'Flying', {category: 'Status'}),
  surf: move('Surf', 'Water'),
  flareblitz: move('Flare Blitz', 'Fire'),
};

const form = (name: string, types: string[], ability = 'Pressure') => [{name, types, weight: 1, abilities: {[ability]: 1}}];

// Two Fire types: weak to Water and Ground, no speed control.
const fireA = species('FireA', ['Fire'], 80, ['Blaze']);
const fireB = species('FireB', ['Fire'], 80, ['Blaze']);
const team = [
  member(fireA, 'Blaze', {moves: [moves.flareblitz]}),
  member(fireB, 'Blaze', {moves: [moves.flareblitz]}),
];

const roster: MetaPokemon[] = [
  meta('FireA', 0.4, {'100': 1}, {forms: form('FireA', ['Fire']), teammates: {Helper: 0.5}}),
  meta('FireB', 0.3, {'100': 1}, {forms: form('FireB', ['Fire']), teammates: {Helper: 0.3}}),
  // Water type with Tailwind, often paired with the team: resists Fire/Water threats, fills speed control.
  meta('Helper', 0.2, {'90': 1}, {forms: form('Helper', ['Water']), moves: {Tailwind: 0.8, Surf: 0.9}}),
  // Mega form of Helper with no pairings: same species, so only the better form is shown.
  meta('Helper-Mega', 0.05, {'110': 1}, {forms: form('Helper-Mega', ['Water'])}),
  // Unrelated Normal type nobody pairs with.
  meta('Loner', 0.3, {'90': 1}, {forms: form('Loner', ['Normal']), moves: {}}),
  // Water attacker that threatens the team.
  meta('Drowner', 0.3, {'150': 1}, {forms: form('Drowner', ['Water']), moves: {Surf: 1}}),
];
const speciesTable: SpeciesTable = {
  firea: fireA, fireb: fireB,
  helper: species('Helper', ['Water'], 70, ['Pressure']),
  helpermega: {...species('Helper-Mega', ['Water'], 90, ['Pressure']), baseSpecies: 'Helper', requiredItem: 'Helperite'},
  loner: species('Loner', ['Normal'], 70, ['Pressure']),
  drowner: species('Drowner', ['Water'], 130, ['Pressure']),
};

describe('suggestTeammates', () => {
  const suggestions = suggestTeammates(team, roster, speciesTable, moves);
  const helper = suggestions.find(s => s.pokemon.name === 'Helper')!;

  it('never suggests a species already on the team', () => {
    expect(suggestions.map(s => s.pokemon.name)).not.toContain('FireA');
    expect(suggestions.map(s => s.pokemon.name)).not.toContain('FireB');
  });
  it('ranks the commonly paired Pokémon that patches the team first', () => {
    expect(suggestions[0].pokemon.name).toBe('Helper');
  });
  it('explains the fit', () => {
    expect(helper.pairing).toBeCloseTo(0.4);
    expect(helper.pairings.map(p => p.label)).toEqual(['FireA', 'FireB']);
    expect(helper.covers).toContain('Water');
    expect(helper.roles).toContain('Speed control');
  });
  it('shows only the best form of each species', () => {
    expect(suggestions.map(s => s.pokemon.name)).not.toContain('Helper-Mega');
  });
  it('scores an unrelated Pokémon lower', () => {
    const loner = suggestions.find(s => s.pokemon.name === 'Loner')!;
    expect(loner.score).toBeLessThan(helper.score);
    expect(loner.pairing).toBe(0);
  });
});
