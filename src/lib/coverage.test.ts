import {describe, expect, it} from 'vitest';
import {bestHit, coverPokemon, coverRoster, type Pokemon} from './coverage';

const mon = (name: string, types: string[], abilities: Record<string, number>, usage = 0.5): Pokemon => ({
  id: name.toLowerCase(),
  name,
  usage,
  forms: [{name, types, weight: 1, abilities}],
});

describe('bestHit', () => {
  it('applies Levitate', () => {
    expect(bestHit(['Ground'], ['Ghost', 'Poison'], 'Levitate').mult).toBe(0);
  });
  it('applies Thick Fat to Fire and Ice', () => {
    expect(bestHit(['Ice'], ['Grass'], 'Thick Fat').mult).toBe(1);
    expect(bestHit(['Fire'], ['Steel'], 'Thick Fat').mult).toBe(1);
  });
  it('applies Filter only to super-effective hits', () => {
    expect(bestHit(['Fire'], ['Grass'], 'Filter').mult).toBe(1.5);
    expect(bestHit(['Fire'], ['Water'], 'Filter').mult).toBe(0.5);
  });
  it('picks the best of several attacking types', () => {
    const hit = bestHit(['Ground', 'Ice'], ['Dragon', 'Flying'], 'Multiscale');
    expect(hit.mult).toBe(4);
    expect(hit.bestTypes).toEqual(['Ice']);
  });
  it('lists every type that ties for the best hit', () => {
    // Kingambit (Dark/Steel): Fighting 4x, Ground 2x, Fire 2x.
    expect(bestHit(['Ground', 'Fire'], ['Dark', 'Steel'], 'Defiant').bestTypes).toEqual(['Ground', 'Fire']);
    expect(bestHit(['Ground', 'Fire', 'Fighting'], ['Dark', 'Steel'], 'Defiant').bestTypes).toEqual(['Fighting']);
  });
  it('lists no type when nothing gets through', () => {
    const hit = bestHit(['Ground'], ['Flying'], 'Keen Eye');
    expect(hit.mult).toBe(0);
    expect(hit.bestTypes).toEqual([]);
  });
});

describe('coverPokemon', () => {
  it('weights ability-dependent outcomes by ability share', () => {
    // Water hits a Ground type 2x unless Water Absorb.
    const c = coverPokemon(['Water'], mon('Test', ['Ground'], {'Water Absorb': 0.25, 'Sand Veil': 0.75}));
    expect(c.buckets.super).toBeCloseTo(0.75);
    expect(c.buckets.immune).toBeCloseTo(0.25);
    expect(c.varies).toBe(true);
    expect(c.main.ability).toBe('Sand Veil');
  });
  it('weights Mega forms by their share', () => {
    const zard: Pokemon = {
      id: 'charizard',
      name: 'Charizard',
      usage: 0.3,
      forms: [
        {name: 'Charizard', types: ['Fire', 'Flying'], weight: 0.4, abilities: {Blaze: 1}},
        {name: 'Charizard-Mega-X', types: ['Fire', 'Dragon'], weight: 0.6, abilities: {'Tough Claws': 1}},
      ],
    };
    const c = coverPokemon(['Electric'], zard);
    expect(c.buckets.super).toBeCloseTo(0.4);
    expect(c.buckets.resisted).toBeCloseTo(0.6);
  });
});

describe('coverRoster', () => {
  const roster = [mon('A', ['Grass'], {}, 0.9), mon('B', ['Water'], {}, 0.1)];
  it('weights by usage', () => {
    expect(coverRoster(['Fire'], roster, true).buckets.super).toBeCloseTo(0.9);
  });
  it('counts equally when unweighted', () => {
    expect(coverRoster(['Fire'], roster, false).buckets.super).toBeCloseTo(0.5);
  });
});
