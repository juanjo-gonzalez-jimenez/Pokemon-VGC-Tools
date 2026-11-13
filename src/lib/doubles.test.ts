import {describe, expect, it} from 'vitest';
import type {MoveTable} from '../data/types';
import type {Combatant} from './damage';
import {facing, intimidate} from './doubles';
import {duel} from './exchange';
import {member, meta, move, species} from './test-fixtures';

const STATS = {hp: 180, atk: 150, def: 110, spa: 110, spd: 110, spe: 100};
const mon = (name: string, types: string[], ability = '', item = ''): Combatant => ({name, species: name, types, ability, item, stats: STATS});
const incineroar = mon('Incineroar', ['Fire', 'Dark'], 'Intimidate');

describe('intimidate', () => {
  const drop = (ability: string, item = '') => intimidate(incineroar, mon('T', ['Normal'], ability, item));
  it('lowers Attack by one', () => {
    expect(drop('')[1].boosts).toEqual({atk: -1});
  });
  it('is blocked by Clear Body-like abilities and Clear Amulet', () => {
    expect(drop('Clear Body')[1].boosts).toBeUndefined();
    expect(drop('Inner Focus')[1].boosts).toBeUndefined();
    expect(drop('', 'Clear Amulet')[1].boosts).toBeUndefined();
  });
  it('backfires on Defiant, Competitive and Guard Dog', () => {
    expect(drop('Defiant')[1].boosts).toEqual({atk: 1});
    expect(drop('Competitive')[1].boosts).toEqual({atk: -1, spa: 2});
    expect(drop('Guard Dog')[1].boosts).toEqual({atk: 1});
  });
  it('is reflected by Mirror Armor', () => {
    const [user, target] = drop('Mirror Armor');
    expect(user.boosts).toEqual({atk: -1});
    expect(target.boosts).toBeUndefined();
  });
  it('applies both ways when both sides have it', () => {
    const [a, b] = facing(incineroar, {...incineroar, name: 'Other'});
    expect(a.boosts).toEqual({atk: -1});
    expect(b.boosts).toEqual({atk: -1});
  });
});

describe('duel with Intimidate', () => {
  it('cuts a physical attacker’s damage into the Intimidate user', () => {
    const flareBlitz = move('Flare Blitz', 'Fire', {basePower: 120});
    const opp = meta('Garchomp', 0.2, {100: 1}, {
      forms: [{name: 'Garchomp', types: ['Dragon', 'Ground'], weight: 1, abilities: {'Rough Skin': 1}}],
      moves: {Earthquake: 1},
      stats: STATS,
    });
    const moves: MoveTable = {earthquake: move('Earthquake', 'Ground', {basePower: 100, target: 'allAdjacent'})};
    const plain = member(species('Incineroar', ['Fire', 'Dark']), 'Blaze', {moves: [flareBlitz]});
    const intim = {...plain, ability: 'Intimidate'};
    const hit = (m: typeof plain) => duel(m, opp, moves).theirs!.percent;
    expect(hit(intim) / hit(plain)).toBeCloseTo(2 / 3, 1);
  });
});
