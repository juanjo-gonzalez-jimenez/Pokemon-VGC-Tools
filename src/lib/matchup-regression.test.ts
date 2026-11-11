/**
 * Regression: a real reported case, on the real Reg M-C data. Mega Swampert's Ice Punch (2×,
 * non-STAB) used to count as much as Rillaboom's 4× STAB Grassy Glide (priority in its own
 * Grassy Terrain), so Rillaboom was benched as "weak to Swampert-Mega".
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import type {MetaPokemon, MoveTable, SpeciesTable} from '../data/types';
import fixture from './__fixtures__/rillaboom-vs-swampert.json';
import {matchupGrid, suggestBrings} from './matchup';
import {parseTeam} from './paste';

// Frozen data (src/lib/__fixtures__), so monthly data refreshes can't change or break this test.
const moves = fixture.moves as unknown as MoveTable;
const text = readFileSync(join(import.meta.dirname, '__fixtures__', 'rillaboom-vs-swampert-team.txt'), 'utf8');
const team = parseTeam(text, fixture.species as unknown as SpeciesTable, moves).members;
const opponents = fixture.opponents as unknown as MetaPokemon[];

describe('Rillaboom against Mega Swampert (reported case)', () => {
  it('reads the whole team and all six opponents', () => {
    expect(team.map(m => m.label)).toEqual(['Raichu-Mega-Y', 'Sneasler', 'Salamence', 'Annihilape', 'Kingambit', 'Rillaboom']);
    expect(opponents.every(Boolean)).toBe(true);
  });
  it('has Rillaboom win the one-on-one with a priority Grassy Glide OHKO', () => {
    const grid = matchupGrid(team, opponents, moves);
    const s = grid[team.findIndex(m => m.label === 'Rillaboom')][0];
    expect(s.mine?.move.name).toBe('Grassy Glide');
    expect(s.mine?.priority).toBe(1);
    expect(s.myHits).toBe(1);
    expect(s.theirHits).toBeGreaterThan(1);
    expect(s.win).toBe(1);
  });
  it('lets only one of the two Mega Stone holders Mega Evolve', () => {
    expect(team.filter(m => m.isMega).map(m => m.label)).toEqual(['Raichu-Mega-Y', 'Salamence']);
    for (const l of suggestBrings(team, opponents, moves, 'normal', 15)) {
      const four = [...l.leads, ...l.back];
      expect(four.filter(m => m.isMega).length).toBeLessThanOrEqual(1);
      if (four.filter(m => m.label === 'Raichu-Mega-Y' || m.label === 'Salamence').length === 2) {
        expect(l.mega).not.toBeNull();
        const other = four.find(m => (m.label === 'Raichu-Mega-Y' || m.label === 'Salamence') && m !== l.mega)!;
        expect(other.isMega).toBe(false);
        expect(other.species.name).toBe(other.label === 'Salamence' ? 'Salamence' : 'Raichu');
        expect(l.reasons.some(r => r.startsWith(`Mega Evolve ${l.mega!.label}`))).toBe(true);
      }
    }
  });
  it('brings Rillaboom in every suggested line-up and never calls it weak to Rillaboom', () => {
    const lineups = suggestBrings(team, opponents, moves);
    expect(lineups).toHaveLength(3);
    for (const l of lineups) {
      expect([...l.leads, ...l.back].map(m => m.label)).toContain('Rillaboom');
      expect(l.reasons.join(' ')).not.toMatch(/weak to/);
    }
  });
});
