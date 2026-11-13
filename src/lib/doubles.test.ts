import {describe, expect, it} from 'vitest';
import type {MoveTable} from '../data/types';
import {estimateDamage, type Combatant} from './damage';
import {facing, intimidate, leadBoard} from './doubles';
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

describe('leadBoard', () => {
  const moves: MoveTable = {
    discharge: move('Discharge', 'Electric', {category: 'Special', basePower: 80, target: 'allAdjacent'}),
    thunderbolt: move('Thunderbolt', 'Electric', {category: 'Special', basePower: 90}),
    flamethrower: move('Flamethrower', 'Fire', {category: 'Special', basePower: 90}),
  };
  const opp = (name: string, types: string[], ability: string, moveShares: Record<string, number>) =>
    meta(name, 0.2, {100: 1}, {forms: [{name, types, weight: 1, abilities: {[ability]: 1}}], moves: moveShares, stats: STATS});
  const rotom = member(species('Rotom-Wash', ['Electric', 'Water'], 86, ['Levitate']), 'Levitate', {
    moves: [moves.discharge, moves.thunderbolt],
  });
  const garchomp = member(species('Garchomp', ['Dragon', 'Ground'], 102, ['Rough Skin']), 'Rough Skin', {moves: [moves.flamethrower]});
  const raichu = opp('Raichu', ['Electric'], 'Lightning Rod', {Thunderbolt: 1});
  const pelipper = opp('Pelipper', ['Water', 'Flying'], 'Drizzle', {Flamethrower: 0.5});

  const board = leadBoard([rotom, garchomp], [pelipper, raichu], moves);
  const row = (name: string) => board.mine.find(r => r.move.name === name)!;

  it('picks up the field from the abilities on it', () => {
    expect(board.field.weather).toBe('rain');
  });
  it('shows spread moves on both foes and on the partner', () => {
    const d = row('Discharge');
    expect(d.spread).toBe(true);
    expect(d.foes[0].estimate!.percent).toBeGreaterThan(0);
    // Raichu's Lightning Rod makes it immune; Garchomp is a Ground type.
    expect(d.foes[1].estimate!.percent).toBe(0);
    expect(d.partner!.estimate!.percent).toBe(0);
  });
  it('redirects single-target Electric moves into the Lightning Rod partner', () => {
    const t = row('Thunderbolt');
    expect(t.foes[0].redirectedTo).toBe('Raichu');
    expect(t.foes[0].estimate).toBeNull();
  });
  it('lists their common moves with the share of sets running them', () => {
    expect(board.against.map(r => [r.attacker, r.move.name, r.share])).toEqual([
      ['Pelipper', 'Flamethrower', 0.5],
      ['Raichu', 'Thunderbolt', 1],
    ]);
  });
  it('notes Intimidate from the leads', () => {
    const lead = leadBoard([{...garchomp, ability: 'Intimidate'}, rotom], [pelipper, raichu], moves);
    expect(lead.notes).toEqual(["Your Garchomp's Intimidate: their Pelipper −1 Atk", "Your Garchomp's Intimidate: their Raichu −1 Atk"]);
    expect(lead.theirs[0].boosts).toEqual({atk: -1});
  });
  it('lets only the first of two Mega Stone holders Mega Evolve', () => {
    const base = species('Charizard', ['Fire', 'Flying']);
    const mega = species('Charizard-Mega-Y', ['Fire', 'Flying']);
    const zard = member(mega, 'Drought', {isMega: true, baseSpecies: base, item: 'Charizardite Y'});
    const lead = leadBoard([rotom, zard].map((m, i) => (i === 0 ? {...m, isMega: true} : m)) as [typeof rotom, typeof rotom], [pelipper, raichu], moves);
    expect(lead.notes[0]).toBe('One Mega per battle: Charizard-Mega-Y stays as Charizard');
    expect(lead.yours[1].species).toBe('Charizard');
  });
  it('agrees with a direct calculation', () => {
    const e = estimateDamage(board.yours[0], board.theirs[0], moves.discharge, board.field)!;
    expect(row('Discharge').foes[0].estimate!.rolls).toEqual(e.rolls);
  });
});
