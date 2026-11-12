import {describe, expect, it} from 'vitest';
import {defensiveChart, memberSpeed, metaSpeedSummary, speedMatchup, teamSpeeds} from './team';
import {member, meta, species} from './test-fixtures';

describe('defensiveChart', () => {
  it('applies abilities and counts weaknesses', () => {
    const team = [member(species('A', ['Electric'])), member(species('B', ['Electric']), 'Levitate')];
    const ground = defensiveChart(team).find(r => r.type === 'Ground')!;
    expect(ground.mults).toEqual([2, 0]);
    expect(ground.weak).toBe(1);
    expect(ground.immune).toBe(1);
  });
  it('flags shared weaknesses', () => {
    const team = ['A', 'B', 'C'].map(n => member(species(n, ['Grass'])));
    const fire = defensiveChart(team).find(r => r.type === 'Fire')!;
    expect(fire.shared).toBe(true);
  });
});

describe('speed', () => {
  it('applies Choice Scarf to your member', () => {
    const m = member(species('A', ['Fire'], 100), '', {item: 'Choice Scarf'});
    expect(memberSpeed(m)).toBe(180); // (100 + 0 + 20) * 1.5
  });
  it('splits matchups across spreads and opposing Scarf sets', () => {
    const opp = meta('Opp', 0.5, {'100': 0.5, '120': 0.5}, {items: {'Choice Scarf': 0.5}});
    // Speeds: 100 (25%), 120 (25%), 150 (25%), 180 (25%).
    expect(speedMatchup(120, opp)).toEqual({faster: 0.25, tie: 0.25, slower: 0.5});
  });
  it('reports the range without Scarf and the Scarfed range separately', () => {
    const opp = meta('Opp', 0.5, {'109': 0.3, '169': 0.7}, {items: {'Choice Scarf': 0.5}});
    const s = metaSpeedSummary(opp);
    expect([s.min, s.max]).toEqual([109, 169]);
    expect([s.scarfMin, s.scarfMax]).toEqual([163, 253]);
    expect(s.scarf).toBe(0.5);
    expect(s.common).toBe(253); // 0.7 * 0.5 = 35%, the single biggest bucket
  });
  it('doubles your Speed under your Tailwind and theirs under their Tailwind', () => {
    const opp = meta('Opp', 0.5, {'150': 1});
    expect(speedMatchup(100, opp).faster).toBe(0);
    expect(speedMatchup(100, opp, 'myTailwind').faster).toBe(1);
    expect(speedMatchup(200, opp, 'theirTailwind').slower).toBe(1);
  });
  it('lets the slower Pokémon move first under Trick Room', () => {
    const opp = meta('Opp', 0.5, {'150': 0.5, '80': 0.5});
    expect(speedMatchup(100, opp, 'trickRoom')).toEqual({faster: 0.5, tie: 0, slower: 0.5});
  });
  it('weights the outspeed share by usage', () => {
    const roster = [meta('Slow', 0.75, {'50': 1}), meta('Fast', 0.25, {'200': 1})];
    const [r] = teamSpeeds([member(species('A', ['Fire'], 80))], roster, true);
    expect(r.speed).toBe(100);
    expect(r.outspeeds).toBeCloseTo(0.75);
  });
});
