import {describe, expect, it} from 'vitest';
import type {SpeciesData} from '../data/types';
import type {CalcSet} from './calcset';
import {toCombatant} from './calcset';
import {estimateDamage, NO_FIELD} from './damage';
import {candidateNatures, effectiveSpeed, optimizeSpread, type OptimizeGoal, type OptimizeResult} from './optimizer';
import {move} from './test-fixtures';

const incineroar: SpeciesData = {name: 'Incineroar', types: ['Fire', 'Dark'], baseStats: {hp: 95, atk: 115, def: 90, spa: 80, spd: 90, spe: 60}, abilities: ['Intimidate']};
const garchomp: SpeciesData = {name: 'Garchomp', types: ['Dragon', 'Ground'], baseStats: {hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102}, abilities: ['Rough Skin']};
const set = (id: string, nature: string, sp: Partial<CalcSet['sp']>, item = ''): CalcSet => ({
  id, ability: '', item, nature, sp: {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...sp}, moves: [],
  boosts: {atk: 0, def: 0, spa: 0, spd: 0, spe: 0}, burned: false, crit: false, hp: 100,
});
const earthquake = move('Earthquake', 'Ground', {basePower: 100, target: 'allAdjacent'});
const dracoMeteor = move('Draco Meteor', 'Dragon', {category: 'Special', basePower: 130});

const goal = (extra: Partial<OptimizeGoal>): OptimizeGoal => ({
  set: set('incineroar', 'Careful', {atk: 32}),
  species: incineroar,
  attacker: {set: set('garchomp', 'Adamant', {atk: 32, spa: 32}), species: garchomp},
  survive: [],
  field: NO_FIELD,
  attackerSide: {},
  defenderSide: {},
  // Earthquake hits both foes (0.75× each), as in doubles.
  singleTarget: false,
  ...extra,
});

describe('optimizeSpread', () => {
  it('finds the fewest points to survive a hit, and one point fewer fails', () => {
    const r = optimizeSpread(goal({survive: [earthquake]})) as OptimizeResult;
    expect(r.checks[0].maxPercent).toBeLessThan(100);
    expect(r.sp.atk).toBe(32);
    expect(r.spent).toBe(r.sp.hp + r.sp.def);
    // No split of one point fewer between HP and Defense survives every roll.
    const g = goal({});
    const attacker = toCombatant(g.attacker.set, garchomp);
    for (let hp = 0; hp <= Math.min(32, r.spent - 1); hp++) {
      const def = r.spent - 1 - hp;
      if (def > 32) continue;
      const d = toCombatant(set('incineroar', 'Careful', {atk: 32, hp, def}), incineroar);
      const e = estimateDamage(attacker, d, earthquake, NO_FIELD)!;
      expect(Math.max(...e.rolls)).toBeGreaterThanOrEqual(e.maxHp);
    }
  });
  it('handles a physical and a special hit together', () => {
    const r = optimizeSpread(goal({survive: [earthquake, dracoMeteor]})) as OptimizeResult;
    expect(r.checks.map(c => c.move)).toEqual(['Earthquake', 'Draco Meteor']);
    expect(r.checks.every(c => c.maxPercent < 100)).toBe(true);
    expect(r.spent).toBe(r.sp.hp + r.sp.def + r.sp.spd);
    expect(r.left).toBe(66 - 32 - r.spent);
  });
  it('finds the Speed points to outspeed a target, Choice Scarf included', () => {
    const r = optimizeSpread(goal({outspeed: 100})) as OptimizeResult;
    expect(r.speed).toBe(101);
    expect(r.sp.spe).toBe(21);
    const scarf = optimizeSpread(goal({set: set('incineroar', 'Careful', {atk: 32}, 'Choice Scarf'), outspeed: 100})) as OptimizeResult;
    expect(scarf.sp.spe).toBe(0);
    expect(effectiveSpeed(set('x', 'Jolly', {}, 'Choice Scarf'), incineroar, 0)).toBe(Math.floor(Math.trunc(80 * 1.1) * 1.5));
  });
  it('explains when nothing works', () => {
    const r = optimizeSpread(goal({outspeed: 200}));
    expect('reason' in r && r.reason).toMatch(/32 Spe points reach only/);
    expect('reason' in optimizeSpread(goal({}))).toBe(true);
  });
  it('can change the nature when allowed, keeping the attacking stat', () => {
    const natures = candidateNatures('Careful', ['atk', 'hp', 'def', 'spd']);
    expect(natures[0]).toBe('Careful');
    expect(natures).not.toContain('Modest');
    const r = optimizeSpread(goal({survive: [earthquake], natures})) as OptimizeResult;
    const kept = optimizeSpread(goal({survive: [earthquake]})) as OptimizeResult;
    expect(r.spent).toBeLessThanOrEqual(kept.spent);
  });
});
