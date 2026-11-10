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
  it('applies type-changing abilities to Normal moves only', () => {
    const hyperVoice = move('Hyper Voice', 'Normal', {category: 'Special', sound: true});
    expect(moveType(hyperVoice, 'Pixilate')).toBe('Fairy');
    expect(moveType(hyperVoice, 'Aerilate')).toBe('Flying');
    expect(moveType(hyperVoice, 'Refrigerate')).toBe('Ice');
    expect(moveType(hyperVoice, 'Galvanize')).toBe('Electric');
    expect(moveType(move('Earthquake', 'Ground'), 'Pixilate')).toBe('Ground');
    expect(moveType(move('Protect', 'Normal', {category: 'Status'}), 'Pixilate')).toBe('Normal');
  });
  it('applies Liquid Voice to sound moves and Normalize to everything', () => {
    expect(moveType(move('Hyper Voice', 'Normal', {sound: true}), 'Liquid Voice')).toBe('Water');
    expect(moveType(move('Tackle', 'Normal'), 'Liquid Voice')).toBe('Normal');
    expect(moveType(move('Earthquake', 'Ground'), 'Normalize')).toBe('Normal');
  });
  it('leaves Weather Ball Normal without a weather ability, and other moves alone', () => {
    expect(moveType(weatherBall, 'Blaze')).toBe('Normal');
    expect(moveType(move('Heat Wave', 'Fire'), 'Drizzle')).toBe('Fire');
  });
});
