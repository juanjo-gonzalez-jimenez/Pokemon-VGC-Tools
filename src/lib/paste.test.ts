import {describe, expect, it} from 'vitest';
import type {MoveTable, SpeciesTable} from '../data/types';
import {parseHeader, parseTeam} from './paste';

const stats = (spe: number) => ({hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe});
const species: SpeciesTable = {
  garchomp: {name: 'Garchomp', types: ['Dragon', 'Ground'], baseStats: stats(102), abilities: ['Rough Skin']},
  incineroar: {name: 'Incineroar', types: ['Fire', 'Dark'], baseStats: stats(60), abilities: ['Blaze', 'Intimidate']},
  charizard: {name: 'Charizard', types: ['Fire', 'Flying'], baseStats: stats(100), abilities: ['Blaze']},
  charizardmegay: {
    name: 'Charizard-Mega-Y', types: ['Fire', 'Flying'], baseStats: stats(100), abilities: ['Drought'],
    requiredItem: 'Charizardite Y', baseSpecies: 'Charizard',
  },
};
const moves: MoveTable = {
  earthquake: {name: 'Earthquake', type: 'Ground', category: 'Physical', basePower: 100, target: 'allAdjacent', priority: 0},
  fakeout: {name: 'Fake Out', type: 'Normal', category: 'Physical', basePower: 40, target: 'normal', priority: 3},
  heatwave: {name: 'Heat Wave', type: 'Fire', category: 'Special', basePower: 95, target: 'allAdjacentFoes', priority: 0},
};

describe('parseHeader', () => {
  it('reads nickname, species, gender and item', () => {
    expect(parseHeader('Chompy (Garchomp) (M) @ Choice Scarf')).toEqual({
      label: 'Chompy', species: 'Garchomp', item: 'Choice Scarf',
    });
  });
  it('reads a bare species', () => {
    expect(parseHeader('Garchomp')).toEqual({label: 'Garchomp', species: 'Garchomp', item: ''});
  });
});

describe('parseTeam', () => {
  const paste = `
Chompy (Garchomp) (M) @ Choice Scarf
Ability: Rough Skin
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Earthquake
- Splash Dance

Incineroar @ Sitrus Berry
- Fake Out

Charizard @ Charizardite Y
Ability: Blaze
- Heat Wave
`;
  const {members, warnings} = parseTeam(paste, species, moves);

  it('parses every member', () => {
    expect(members.map(m => m.label)).toEqual(['Chompy', 'Incineroar', 'Charizard']);
  });
  it('reads stat points, nature, item and moves', () => {
    const [chomp] = members;
    expect(chomp.sp).toEqual({hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32});
    expect(chomp.nature).toBe('Jolly');
    expect(chomp.item).toBe('Choice Scarf');
    expect(chomp.moves.map(m => m.name)).toEqual(['Earthquake']);
  });
  it('warns about unknown moves and missing abilities', () => {
    expect(warnings.some(w => w.includes('Splash Dance'))).toBe(true);
    expect(warnings.some(w => w.includes('Incineroar: no ability'))).toBe(true);
    expect(members[1].ability).toBe('Blaze');
  });
  it('switches to the Mega form when holding its stone', () => {
    const zard = members[2];
    expect(zard.isMega).toBe(true);
    expect(zard.species.name).toBe('Charizard-Mega-Y');
    expect(zard.ability).toBe('Drought');
  });
  it('skips unknown Pokémon', () => {
    const r = parseTeam('Fakemon @ Leftovers\n- Earthquake', species, moves);
    expect(r.members).toEqual([]);
    expect(r.warnings[0]).toContain('Fakemon');
  });
});
