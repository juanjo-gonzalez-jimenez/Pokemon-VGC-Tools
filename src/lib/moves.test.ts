import {describe, expect, it} from 'vitest';
import {moveType} from './moves';
import {move} from './test-fixtures';

describe('moveType', () => {
  const weatherBall = move('Weather Ball', 'Normal', {category: 'Special'});
  it('makes Weather Ball match the weather its user sets', () => {
    expect(moveType(weatherBall, 'Drought')).toBe('Fire');
    expect(moveType(weatherBall, 'Drizzle')).toBe('Water');
    expect(moveType(weatherBall, 'Sand Stream')).toBe('Rock');
    expect(moveType(weatherBall, 'Snow Warning')).toBe('Ice');
  });
  it('leaves Weather Ball Normal without a weather ability, and other moves alone', () => {
    expect(moveType(weatherBall, 'Blaze')).toBe('Normal');
    expect(moveType(move('Heat Wave', 'Fire'), 'Drizzle')).toBe('Fire');
  });
});
