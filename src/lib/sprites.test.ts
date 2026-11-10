import {describe, expect, it} from 'vitest';
import {iconPosition, itemIconPosition, spriteId, spriteUrls} from './sprites';

describe('sprites', () => {
  it('builds Showdown sprite names for forms', () => {
    expect(spriteId('Garchomp')).toBe('garchomp');
    expect(spriteId('Charizard-Mega-Y', 'Charizard')).toBe('charizard-megay');
    expect(spriteId('Urshifu-Rapid-Strike', 'Urshifu')).toBe('urshifu-rapidstrike');
  });
  it('falls back from the static to the animated to the base sprite', () => {
    expect(spriteUrls('raichu-megay', 'raichu').map(u => u.split('/sprites/')[1])).toEqual([
      'gen5/raichu-megay.png',
      'ani/raichu-megay.gif',
      'gen5/raichu.png',
    ]);
  });
  it('locates item icons on the 16-wide sheet', () => {
    expect(itemIconPosition(69)).toEqual({x: 5 * 24, y: 4 * 24}); // Choice Scarf
  });
  it('locates icons on the 12-wide sheet', () => {
    expect(iconPosition(0)).toEqual({x: 0, y: 0});
    expect(iconPosition(13)).toEqual({x: 40, y: 30});
  });
});
