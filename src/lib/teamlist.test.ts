import {describe, expect, it} from 'vitest';
import {member, move, species} from './test-fixtures';
import {
  EMPTY_PLAYER,
  formatBirthDate,
  missingDetails,
  parsePlayer,
  sheetPokemon,
  teamListFileName,
  type LocalNames,
} from './teamlist';

const withStats = (name: string, baseStats: [number, number, number, number, number, number], extra = {}) => {
  const [hp, atk, def, spa, spd, spe] = baseStats;
  return {...species(name, ['Normal']), baseStats: {hp, atk, def, spa, spd, spe}, ...extra};
};
const raichu = withStats('Raichu', [60, 90, 55, 90, 80, 110]);
const raichuSet = {nature: 'Timid', sp: {hp: 23, atk: 0, def: 14, spa: 0, spd: 2, spe: 27}};

const names: LocalNames = {
  species: {raichu: 'Raichu', sneasler: 'Sneasler'},
  moves: {fakeout: 'Sorpresa'},
  items: {raichunitey: 'Raichunita Y'},
  abilities: {lightningrod: 'Pararrayos'},
  natures: {timid: 'Miedosa'},
};

describe('sheetPokemon', () => {
  it('computes level-50 stats from stat points and nature', () => {
    const sneasler = withStats('Sneasler', [80, 130, 60, 40, 80, 120]);
    const m = member(sneasler, 'Unburden', {nature: 'Jolly', sp: {hp: 28, atk: 14, def: 2, spa: 0, spd: 14, spe: 8}});
    expect(sheetPokemon(m, 'en', null).stats).toEqual({hp: 183, atk: 164, def: 82, spa: 54, spd: 114, spe: 162});
  });

  it('lists a Mega holder as its base species with base stats', () => {
    const mega = withStats('Raichu-Mega-Y', [60, 100, 55, 160, 80, 130], {baseSpecies: 'Raichu'});
    const m = member(mega, 'Lightning Rod', {...raichuSet, baseSpecies: raichu, isMega: true, item: 'Raichunite Y'});
    const row = sheetPokemon(m, 'en', null);
    expect(row.species).toBe('Raichu');
    expect(row.stats).toEqual({hp: 158, atk: 99, def: 89, spa: 110, spd: 102, spe: 172});
  });

  it("prints the base form's ability for a Mega holder pasted without an ability line", () => {
    const base = {...raichu, abilities: ['Static', 'Lightning Rod']};
    const mega = withStats('Raichu-Mega-Y', [60, 100, 55, 160, 80, 130], {baseSpecies: 'Raichu', abilities: ['Mega Ability']});
    const m = member(mega, 'Mega Ability', {...raichuSet, baseSpecies: base, isMega: true, pastedAbility: ''});
    expect(sheetPokemon(m, 'en', null).ability).toBe('Static');
  });

  it('uses Spanish names, keeps form suffixes, and falls back to English', () => {
    const alola = withStats('Raichu-Alola', [60, 85, 50, 95, 85, 110], {baseSpecies: 'Raichu'});
    const m = member(alola, 'Lightning Rod', {
      ...raichuSet,
      item: 'Raichunite Y',
      moves: [move('Fake Out', 'Normal'), move('Zap Cannon', 'Electric')],
    });
    const row = sheetPokemon(m, 'es', names);
    expect(row.species).toBe('Raichu-Alola');
    expect(row.nature).toBe('Miedosa');
    expect(row.ability).toBe('Pararrayos');
    expect(row.item).toBe('Raichunita Y');
    expect(row.moves).toEqual(['Sorpresa', 'Zap Cannon', '', '']);
  });

  it('keeps English names in English', () => {
    const m = member(raichu, 'Lightning Rod', {...raichuSet, moves: [move('Fake Out', 'Normal')]});
    const row = sheetPokemon(m, 'en', names);
    expect([row.nature, row.ability, row.moves[0]]).toEqual(['Timid', 'Lightning Rod', 'Fake Out']);
  });

  it('prints the pasted ability and blanks for missing moves and item', () => {
    const m = member(raichu, 'Other', {pastedAbility: 'Defiant', moves: [move('Ice Punch', 'Ice')]});
    const row = sheetPokemon(m, 'en', null);
    expect(row.ability).toBe('Defiant');
    expect(row.item).toBe('');
    expect(row.moves).toEqual(['Ice Punch', '', '', '']);
  });
});

describe('player details', () => {
  it('prints dates as DD/MM/YYYY', () => {
    expect(formatBirthDate('1999-12-31')).toBe('31/12/1999');
    expect(formatBirthDate('')).toBe('');
  });

  it('validates stored details', () => {
    expect(parsePlayer('{oops')).toBeUndefined();
    expect(parsePlayer('[1]')).toBeUndefined();
    expect(parsePlayer(JSON.stringify({name: 'x'.repeat(40), evil: 1, division: 'kings'}))).toEqual({
      ...EMPTY_PLAYER,
      name: 'x'.repeat(24),
    });
  });

  it('lists only the required details that are empty', () => {
    expect(missingDetails({...EMPTY_PLAYER, name: 'Ana', division: 'masters', battleTeam: ''})).toEqual([
      'trainer',
      'switchProfile',
      'playerId',
      'birthDate',
    ]);
  });
});

describe('teamListFileName', () => {
  it('turns the team name into a safe file name', () => {
    expect(teamListFileName('Rain / Sun!')).toBe('team-list-rain-sun.pdf');
    expect(teamListFileName('')).toBe('team-list.pdf');
  });
});
