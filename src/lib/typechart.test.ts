import {describe, expect, it} from 'vitest';
import {effectiveness} from './typechart';

describe('effectiveness', () => {
  it('multiplies across dual types', () => {
    expect(effectiveness('Ice', ['Dragon', 'Flying'])).toBe(4);
    expect(effectiveness('Fire', ['Water', 'Rock'])).toBe(0.25);
  });
  it('handles immunities', () => {
    expect(effectiveness('Ground', ['Fire', 'Flying'])).toBe(0);
    expect(effectiveness('Dragon', ['Fairy'])).toBe(0);
  });
  it('is neutral by default', () => {
    expect(effectiveness('Normal', ['Fire'])).toBe(1);
  });
});
