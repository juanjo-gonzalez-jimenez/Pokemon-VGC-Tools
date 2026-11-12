import {describe, expect, it} from 'vitest';
import {estimateDamage, type Combatant} from './damage';
import {bestOption, duel, expectedThreat} from './exchange';
import {member, meta, move, species} from './test-fixtures';

const target: Combatant = {name: 'T', species: 'Smeargle', types: ['Normal'], ability: '', item: '', stats: {hp: 155, atk: 100, def: 100, spa: 100, spd: 100, spe: 100}};
const user: Combatant = {...target, name: 'U'};
const est = (bp: number, extra = {}) => estimateDamage(user, target, move(`M${bp}`, 'Fighting', {basePower: bp, ...extra}))!;

describe('expectedThreat', () => {
  it('weights each move by how many sets run it', () => {
    const big = est(150);
    const small = est(40);
    const t = expectedThreat([
      {estimate: big, share: 0.2},
      {estimate: small, share: 1},
    ])!;
    // 20% of sets have the big move; the rest fall back to the small one.
    expect(t.percent).toBeCloseTo(big.percent * 0.2 + small.percent * 0.8, 5);
    expect(t.move.name).toBe('M40');
  });
  it('ignores moves that do nothing', () => {
    expect(expectedThreat([])).toBeNull();
  });
});

describe('bestOption', () => {
  it('prefers fewer hits to KO, then priority, then damage', () => {
    const quick = est(40, {priority: 1});
    const strong = est(120);
    expect(bestOption([quick, strong])!.move.name).toBe('M120');
    // Two moves that both need the same number of hits: the priority one wins.
    const quickEnough = est(110, {priority: 1});
    expect(bestOption([strong, quickEnough])!.move.name).toBe('M110');
  });
});

describe('duel', () => {
  const opp = (spe: number, attack = 'Fighting') =>
    meta('Opp', 0.3, {[spe]: 1}, {
      forms: [{name: 'Opp', types: ['Normal'], weight: 1, abilities: {}}],
      moves: {[`${attack} Hit`]: 1},
      stats: {hp: 155, atk: 140, def: 100, spa: 100, spd: 100, spe},
    });
  const movesFor = (priority = 0) => ({fightinghit: move('Fighting Hit', 'Fighting', {basePower: 100, priority})});
  const me = (spe: number, moves = [move('Strike', 'Fighting', {basePower: 100})]) =>
    member(species('Me', ['Normal'], spe), '', {moves, sp: {hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0}});

  it('wins when it KOs in fewer hits, whoever is faster', () => {
    const strong = me(50, [move('Big Strike', 'Fighting', {basePower: 250})]);
    const d = duel(strong, opp(200), movesFor());
    expect(d.myHits).toBeLessThan(d.theirHits);
    expect(d.first).toBe(0);
    expect(d.win).toBe(1);
  });
  it('lets priority beat Speed when both need the same number of hits', () => {
    const slow = me(50, [move('Quick Strike', 'Fighting', {basePower: 100, priority: 1})]);
    const d = duel(slow, opp(200), movesFor());
    expect(d.myHits).toBe(d.theirHits);
    expect(d.first).toBe(1);
    expect(d.win).toBe(1);
  });
  it('lets their priority move beat your Speed when it KOs in as few hits', () => {
    // Slow opponent whose sets all carry a priority move as strong as its main attack.
    const quickOpp = meta('Quick', 0.3, {'50': 1}, {
      forms: [{name: 'Quick', types: ['Normal'], weight: 1, abilities: {}}],
      moves: {'Fighting Hit': 1, 'Quick Hit': 1},
      stats: {hp: 155, atk: 140, def: 100, spa: 100, spd: 100, spe: 50},
    });
    const moves = {
      fightinghit: move('Fighting Hit', 'Fighting', {basePower: 100}),
      quickhit: move('Quick Hit', 'Fighting', {basePower: 100, priority: 1}),
    };
    const d = duel(me(150), quickOpp, moves);
    expect(d.myHits).toBe(d.theirHits);
    expect(d.first).toBe(0);
    expect(d.win).toBe(0);
  });
  it('counts their priority only for the share of sets that run it', () => {
    const someQuick = meta('Quick', 0.3, {'50': 1}, {
      forms: [{name: 'Quick', types: ['Normal'], weight: 1, abilities: {}}],
      moves: {'Fighting Hit': 1, 'Quick Hit': 0.4},
      stats: {hp: 155, atk: 140, def: 100, spa: 100, spd: 100, spe: 50},
    });
    const moves = {
      fightinghit: move('Fighting Hit', 'Fighting', {basePower: 100}),
      quickhit: move('Quick Hit', 'Fighting', {basePower: 100, priority: 1}),
    };
    // 40% of their sets go first with priority; the rest are slower than you.
    expect(duel(me(150), someQuick, moves).first).toBeCloseTo(0.6, 5);
  });
  it('ignores their priority move when it is too weak to KO as fast', () => {
    const weakQuick = meta('Quick', 0.3, {'50': 1}, {
      forms: [{name: 'Quick', types: ['Normal'], weight: 1, abilities: {}}],
      moves: {'Fighting Hit': 1, 'Quick Hit': 1},
      stats: {hp: 155, atk: 140, def: 100, spa: 100, spd: 100, spe: 50},
    });
    const moves = {
      fightinghit: move('Fighting Hit', 'Fighting', {basePower: 100}),
      quickhit: move('Quick Hit', 'Fighting', {basePower: 20, priority: 1}),
    };
    expect(duel(me(150), weakQuick, moves).first).toBe(1);
  });
  it('blocks priority in Psychic Terrain and against Armor Tail', () => {
    const quick = move('Quick Strike', 'Fighting', {basePower: 100, priority: 1});
    const slow = me(50, [quick]);
    expect(duel(slow, opp(200), movesFor()).first).toBe(1);
    // In Psychic Terrain the priority move fails, so the slow Pokémon has no attack at all.
    expect(duel(slow, opp(200), movesFor(), {weather: '', terrain: 'psychic'}).mine).toBeNull();
    const tail = {...opp(200), forms: [{name: 'Opp', types: ['Normal'], weight: 1, abilities: {'Armor Tail': 1}}]};
    expect(duel(slow, tail, movesFor()).mine).toBeNull();
  });
  it('decides equal hits by Speed otherwise', () => {
    expect(duel(me(150), opp(50), movesFor()).win).toBe(1);
    expect(duel(me(50), opp(200), movesFor()).win).toBe(0);
  });
});
