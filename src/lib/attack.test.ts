import {describe, expect, it} from 'vitest';
import {attackOf, typesOf, uniqueAttacks} from './attack';
import {bestHit} from './coverage';
import {move} from './test-fixtures';

const eq = move('Earthquake', 'Ground');
const hit = (m: ReturnType<typeof move>, ability: string, defTypes: string[], defAbility = '') =>
  bestHit([attackOf(m, ability)!], defTypes, defAbility).mult;

describe('attackOf + bestHit', () => {
  it('returns no attack for status moves', () => {
    expect(attackOf(move('Protect', 'Normal', {category: 'Status'}), '')).toBeNull();
  });
  it('lets Mold Breaker ignore defensive abilities', () => {
    expect(hit(eq, 'Rough Skin', ['Electric'], 'Levitate')).toBe(0);
    expect(hit(eq, 'Mold Breaker', ['Electric'], 'Levitate')).toBe(2);
    expect(hit(move('Flamethrower', 'Fire'), 'Turboblaze', ['Grass'], 'Thick Fat')).toBe(2);
  });
  it('lets Scrappy hit Ghost types with Normal and Fighting moves only', () => {
    expect(hit(move('Close Combat', 'Fighting'), 'Scrappy', ['Ghost', 'Dark'])).toBe(2);
    expect(hit(move('Fake Out', 'Normal'), 'Scrappy', ['Ghost'])).toBe(1);
    expect(hit(move('Fake Out', 'Normal'), 'Inner Focus', ['Ghost'])).toBe(0);
  });
  it('doubles resisted hits with Tinted Lens', () => {
    expect(hit(move('Bug Buzz', 'Bug'), 'Tinted Lens', ['Fire'])).toBe(1);
    expect(hit(move('Bug Buzz', 'Bug'), 'Tinted Lens', ['Fire', 'Flying'])).toBe(0.5);
    expect(hit(move('Bug Buzz', 'Bug'), 'Tinted Lens', ['Grass'])).toBe(2);
  });
  it('makes Freeze-Dry super effective on Water', () => {
    const freezeDry = move('Freeze-Dry', 'Ice', {category: 'Special'});
    expect(hit(freezeDry, '', ['Water'])).toBe(2);
    expect(hit(freezeDry, '', ['Water', 'Ground'])).toBe(4);
    expect(hit(move('Ice Beam', 'Ice'), '', ['Water'])).toBe(0.5);
  });
  it('combines Fighting and Flying for Flying Press', () => {
    const press = move('Flying Press', 'Fighting');
    expect(hit(press, '', ['Grass'])).toBe(2);
    expect(hit(press, '', ['Dark', 'Fighting'])).toBe(4);
    expect(hit(press, '', ['Rock'])).toBe(1);
  });
  it('uses the changed move type for Pixilate', () => {
    const hyperVoice = move('Hyper Voice', 'Normal', {category: 'Special', sound: true});
    expect(attackOf(hyperVoice, 'Pixilate')!.type).toBe('Fairy');
    expect(hit(hyperVoice, 'Pixilate', ['Dragon', 'Ground'])).toBe(2);
  });
});

describe('uniqueAttacks', () => {
  it('drops duplicates and status moves, in type-chart order', () => {
    const attacks = uniqueAttacks([
      attackOf(eq, ''),
      attackOf(move('Stomping Tantrum', 'Ground'), ''),
      attackOf(move('Protect', 'Normal', {category: 'Status'}), ''),
      attackOf(move('Flare Blitz', 'Fire'), ''),
    ]);
    expect(typesOf(attacks)).toEqual(['Fire', 'Ground']);
    expect(attacks).toHaveLength(2);
  });
});
