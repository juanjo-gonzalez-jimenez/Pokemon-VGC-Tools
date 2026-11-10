import {describe, expect, it} from 'vitest';
import {bst, formatSpread, searchRoster, sortRoster} from './dex';
import {meta} from './test-fixtures';

const withStats = (name: string, usage: number, spe: number, hp = 80) => ({
  ...meta(name, usage, {}),
  baseStats: {hp, atk: 80, def: 80, spa: 80, spd: 80, spe},
});
const roster = [withStats('Garchomp', 0.26, 102, 108), withStats('Incineroar', 0.26, 60, 95), withStats('Sneasler', 0.5, 120)];

describe('dex', () => {
  it('computes base stat totals', () => {
    expect(bst(roster[0].baseStats)).toBe(108 + 80 * 4 + 102);
  });
  it('searches by name, ignoring case and punctuation', () => {
    expect(searchRoster(roster, 'GAR').map(p => p.name)).toEqual(['Garchomp']);
    expect(searchRoster(roster, 'inciner-oar')).toHaveLength(1);
    expect(searchRoster(roster, '')).toHaveLength(3);
  });
  it('sorts by base stat total', () => {
    expect(sortRoster(roster, 'bst')[0].name).toBe('Garchomp');
  });
  it('filters by a type in either slot', () => {
    const typed = (name: string, types: string[]) => ({...withStats(name, 0.1, 80), forms: [{name, types, weight: 1, abilities: {}}]});
    const list = [typed('Gambit', ['Dark', 'Steel']), typed('Inci', ['Fire', 'Dark']), typed('Rilla', ['Grass'])];
    expect(searchRoster(list, '', 'Dark').map(p => p.name)).toEqual(['Gambit', 'Inci']);
    expect(searchRoster(list, '', 'Steel').map(p => p.name)).toEqual(['Gambit']);
    expect(searchRoster(list, 'rill', 'Dark')).toEqual([]);
    expect(searchRoster(list, '')).toHaveLength(3);
  });
  it('sorts by base stat total without Mega forms', () => {
    const megaZ = {...withStats('Garchomp-Mega-Z', 0.1, 150, 108), baseStats: {hp: 108, atk: 170, def: 115, spa: 120, spd: 95, spe: 92}};
    const withMega = [...roster, megaZ, withStats('Floette-Mega', 0.1, 200)];
    expect(sortRoster(withMega, 'bst')[0].name).toBe('Garchomp-Mega-Z'); // 700 total
    const noMega = sortRoster(withMega, 'bstNoMega');
    expect(noMega.map(p => p.name)).toEqual(['Garchomp', 'Sneasler', 'Incineroar']);
  });
  it('sorts by usage, name or a stat', () => {
    expect(sortRoster(roster, 'usage')[0].name).toBe('Sneasler');
    expect(sortRoster(roster, 'name').map(p => p.name)).toEqual(['Garchomp', 'Incineroar', 'Sneasler']);
    expect(sortRoster(roster, 'spe').map(p => p.name)).toEqual(['Sneasler', 'Garchomp', 'Incineroar']);
  });
  it('keeps cutoff usage ahead of all-ratings and unused Pokémon when sorting by usage', () => {
    const list = [
      {...withStats('Rare', 0.4, 50), source: 'all' as const},
      {...withStats('Unused', 0, 50), source: 'none' as const},
      withStats('Meta', 0.01, 50),
    ];
    expect(sortRoster(list, 'usage').map(p => p.name)).toEqual(['Meta', 'Rare', 'Unused']);
  });
  it('formats a spread with its final stats', () => {
    const s = formatSpread('Adamant:32/14/10/0/10/0', {hp: 95, atk: 115, def: 90, spa: 80, spd: 90, spe: 60})!;
    expect(s.nature).toBe('Adamant');
    expect(s.text).toBe('32 HP / 14 Atk / 10 Def / 10 SpD');
    expect(s.stats.hp).toBe(202);
    expect(s.stats.atk).toBe(163); // (115 + 14 + 20) * 1.1 = 163.9
    expect(s.stats.spa).toBe(90); // (80 + 0 + 20) * 0.9
  });
});
