import {describe, expect, it} from 'vitest';
import type {Pokemon} from './coverage';
import {suggestNext} from './suggest';

const mon = (name: string, types: string[], usage: number): Pokemon => ({
  id: name, name, usage, forms: [{name, types, weight: 1, abilities: {}}],
});

describe('suggestNext', () => {
  it('ranks the type that hits the most-used walls first', () => {
    // Fire is walled by Water (very common); Electric/Grass hit Water super-effectively.
    const roster = [mon('W', ['Water'], 0.8), mon('G', ['Grass'], 0.2)];
    const ranked = suggestNext(['Fire'], roster, true);
    expect(['Electric', 'Grass']).toContain(ranked[0].type);
    expect(ranked[0].superGain).toBeCloseTo(0.8);
    expect(ranked.find(s => s.type === 'Fire')).toBeUndefined();
  });
});
