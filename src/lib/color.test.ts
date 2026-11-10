import {describe, expect, it} from 'vitest';
import {contrast, INK, PAPER, readableOn} from './color';

describe('colour contrast', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
  it('picks dark text on light colours and white on dark ones', () => {
    expect(readableOn('#fac000')).toBe(INK); // Electric yellow
    expect(readableOn('#3dcef3')).toBe(INK); // Ice
    expect(readableOn('#704170')).toBe(PAPER); // Ghost
    expect(readableOn('#624d4e')).toBe(PAPER); // Dark
  });
});
