import {describe, expect, it} from 'vitest';
import {calcStat, parseSpread} from './stats';

describe('calcStat (Champions)', () => {
  it('applies a boosting nature with truncation', () => {
    expect(calcStat('spe', 102, 32, 'Jolly')).toBe(169); // Garchomp: 154 * 1.1 = 169.4
  });
  it('is base + SP + 20 for neutral natures', () => {
    expect(calcStat('spe', 60, 0, 'Adamant')).toBe(80); // Incineroar
  });
  it('applies a hindering nature', () => {
    expect(calcStat('spe', 60, 0, 'Brave')).toBe(72);
  });
  it('computes HP', () => {
    expect(calcStat('hp', 95, 32)).toBe(202);
  });
});

describe('parseSpread', () => {
  it('reads nature and stat points in HP/Atk/Def/SpA/SpD/Spe order', () => {
    expect(parseSpread('Adamant:32/14/10/0/10/0')).toEqual({
      nature: 'Adamant',
      sp: {hp: 32, atk: 14, def: 10, spa: 0, spd: 10, spe: 0},
    });
  });
  it('rejects malformed spreads', () => {
    expect(parseSpread('Adamant:1/2')).toBeNull();
  });
});
