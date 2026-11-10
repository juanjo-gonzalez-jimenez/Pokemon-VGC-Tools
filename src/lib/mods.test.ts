import {describe, expect, it} from 'vitest';
import type {ItemTable, MoveTable} from '../data/types';
import {applyMod} from './mods';
import {move} from './test-fixtures';

describe('applyMod', () => {
  const tables: {moves: MoveTable; items: ItemTable} = {
    moves: {growth: move('Growth', 'Normal', {category: 'Status'}), slash: move('Slash', 'Normal', {basePower: 70}), absorb: move('Absorb', 'Grass')},
    items: {choicescarf: {name: 'Choice Scarf', sprite: 69}, zcrystal: {name: 'Z Crystal', sprite: 1}},
  };
  const out = applyMod(tables, {
    moves: {growth: {type: 'Grass'}, slash: {basePower: 80}},
    unavailableMoves: ['absorb'],
    unavailableItems: ['zcrystal'],
  });
  it('applies type and base power changes', () => {
    expect(out.moves.growth.type).toBe('Grass');
    expect(out.moves.slash.basePower).toBe(80);
  });
  it('flags moves and items missing from the game', () => {
    expect(out.moves.absorb.unavailable).toBe(true);
    expect(out.items.zcrystal.unavailable).toBe(true);
    expect(out.items.choicescarf.unavailable).toBeUndefined();
  });
  it('leaves the base tables untouched', () => {
    expect(tables.moves.growth.type).toBe('Normal');
    expect(tables.moves.absorb.unavailable).toBeUndefined();
  });
});
