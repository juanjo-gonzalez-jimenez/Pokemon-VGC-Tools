import {describe, expect, it} from 'vitest';
import {checkLegality} from './legality';
import {member, move, noSp, species} from './test-fixtures';

const chomp = species('Garchomp', ['Dragon', 'Ground'], 102, ['Rough Skin', 'Sand Veil']);

describe('checkLegality', () => {
  it('accepts a legal team', () => {
    const sp = {...noSp(32), atk: 32, hp: 2};
    expect(checkLegality([member(chomp, 'Rough Skin', {sp})])).toEqual([]);
  });
  it('flags stat point limits', () => {
    const issues = checkLegality([member(chomp, '', {sp: {...noSp(33), atk: 32, hp: 2}})]);
    expect(issues.some(i => i.includes('67 stat points'))).toBe(true);
    expect(issues.some(i => i.includes('33 stat points in Spe'))).toBe(true);
  });
  it('flags too many moves and impossible abilities', () => {
    const moves = ['A', 'B', 'C', 'D', 'E'].map(n => move(n, 'Normal'));
    const issues = checkLegality([member(chomp, 'Levitate', {moves})]);
    expect(issues.some(i => i.includes('5 moves'))).toBe(true);
    expect(issues.some(i => i.includes("can't have Levitate"))).toBe(true);
  });
  it('flags duplicate items and species, counting Megas as their base species', () => {
    const zard = species('Charizard', ['Fire', 'Flying']);
    const megaY = {...species('Charizard-Mega-Y', ['Fire', 'Flying']), baseSpecies: 'Charizard'};
    const issues = checkLegality([
      member(zard, '', {item: 'Sitrus Berry'}),
      member(zard, '', {label: 'Zard2', species: megaY, item: 'Charizardite Y'}),
      member(chomp, '', {item: 'Sitrus Berry'}),
    ]);
    expect(issues.some(i => i.includes('Sitrus Berry is held by more than one'))).toBe(true);
    expect(issues.some(i => i.includes('More than one Charizard'))).toBe(true);
  });
  it('flags moves and items that are not in the regulation', () => {
    const gone = move('Absorb', 'Grass', {unavailable: true});
    const items = {zcrystal: {name: 'Z Crystal', sprite: 1, unavailable: true as const}, sitrusberry: {name: 'Sitrus Berry', sprite: 2}};
    const issues = checkLegality([member(chomp, '', {moves: [gone], item: 'Z Crystal'})], items);
    expect(issues.some(i => i.includes("Absorb isn't available"))).toBe(true);
    expect(issues.some(i => i.includes("Z Crystal isn't available"))).toBe(true);
    expect(checkLegality([member(chomp, '', {item: 'Sitrus Berry'})], items)).toEqual([]);
  });
  it('does not limit the number of Mega Stones', () => {
    const a = {...species('Gengar', ['Ghost', 'Poison'])};
    const b = {...species('Absol', ['Dark'])};
    expect(checkLegality([member(a, '', {item: 'Gengarite'}), member(b, '', {item: 'Absolite'})])).toEqual([]);
  });
});
