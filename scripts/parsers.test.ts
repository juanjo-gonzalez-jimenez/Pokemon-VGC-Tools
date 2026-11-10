import {describe, expect, it} from 'vitest';
import {championsVgcCutoffs, formatMods, formatName, legalSpecies, parseIconIndexes, parseItems} from './parsers';

describe('formatName', () => {
  it('reads year and regulation letters', () => {
    expect(formatName('gen9championsvgc2026regmc')).toBe('VGC 2026 Reg M-C');
    expect(formatName('gen9vgc2025regi')).toBe('VGC 2025 Reg I');
    expect(formatName('somethingelse')).toBe('somethingelse');
  });
});

describe('formatMods', () => {
  it('maps each format to its data mod, skipping fields in between', () => {
    const src = `
	{
		name: "[Gen 9 Champions] VGC 2026 Reg M-C",
		mod: 'champions',
		gameType: 'doubles',
	},
	{
		name: "[Gen 9 Champions] VGC 2026 Reg M-B",
		desc: \`old one\`,
		mod: 'championsregmb',
		searchShow: false,
	},
`;
    const mods = formatMods(src);
    expect(mods.get('gen9championsvgc2026regmc')).toBe('champions');
    expect(mods.get('gen9championsvgc2026regmb')).toBe('championsregmb');
  });
});

describe('legalSpecies', () => {
  const src = `export const FormatsData = {
	bulbasaur: {
		isNonstandard: "Past",
		tier: "Illegal",
	},
	venusaur: {
		tier: "RU",
		doublesTier: "DOU",
	},
	venusaurmega: {
		tier: "UU",
	},
	mew: {
		tier: "OU",
	},
	aegislashblade: {
		tier: "OU",
	},
	notindex: {
		tier: "OU",
	},
};`;
  const dex = {
    bulbasaur: {},
    venusaur: {},
    venusaurmega: {battleOnly: 'Venusaur', requiredItem: 'Venusaurite'},
    mew: {tags: ['Mythical']},
    aegislashblade: {battleOnly: 'Aegislash'},
  };
  it('keeps standard species and Megas; drops Past, banned tags, battle-only forms and unknown ids', () => {
    expect([...legalSpecies(src, dex)]).toEqual(['venusaur', 'venusaurmega']);
  });
});

describe('parseItems', () => {
  const src =
    'exports.BattleItems = {abilityshield:{name:"Ability Shield",spritenum:746,fling:{basePower:30},num:1881,gen:9},' +
    'quickclaw:{onFractionalPriorityPriority:-2,name:"Quick Claw",spritenum:373,fling:{basePower:80},num:217,gen:2},' +
    'weirdberry:{fling:{basePower:10},name:"Weird Berry",num:1,gen:9},' +
    'choicescarf:{name:"Choice Scarf",spritenum:69,num:287,gen:4}};';
  const items = parseItems(src);
  it('reads names and sprite numbers', () => {
    expect(items.abilityshield).toEqual({name: 'Ability Shield', sprite: 746});
    expect(items.choicescarf).toEqual({name: 'Choice Scarf', sprite: 69});
  });
  it('handles entries whose name is not the first field', () => {
    expect(items.quickclaw).toEqual({name: 'Quick Claw', sprite: 373});
    expect(items.weirdberry).toEqual({name: 'Weird Berry', sprite: 0});
  });
  it('does not treat nested objects as items', () => {
    expect(Object.keys(items).sort()).toEqual(['abilityshield', 'choicescarf', 'quickclaw', 'weirdberry']);
  });
});

describe('parseIconIndexes', () => {
  const src = `export const BattlePokemonIconIndexes: { [id: string]: number } = {
	egg: 1032 + 1,
	charizardmegay: 1320 + 2,
	plain: 77,
};

export const BattlePokemonIconIndexesLeft: { [id: string]: number } = {
	pikachubelle: 1404 + 0,
};`;
  it('adds the base and offset, and stops at the end of the table', () => {
    const map = parseIconIndexes(src);
    expect(map.get('charizardmegay')).toBe(1322);
    expect(map.get('plain')).toBe(77);
    expect(map.has('pikachubelle')).toBe(false);
  });
  it('returns nothing when the table is missing', () => {
    expect(parseIconIndexes('nothing here').size).toBe(0);
  });
});

describe('championsVgcCutoffs', () => {
  it('groups cutoffs per Champions VGC format and skips Bo3 and other formats', () => {
    const map = championsVgcCutoffs([
      'gen9championsvgc2026regmc-0.json',
      'gen9championsvgc2026regmc-1760.json',
      'gen9championsvgc2026regmcbo3-1760.json',
      'gen9championsou-1760.json',
      'gen9vgc2024regg-1760.json',
    ]);
    expect([...map]).toEqual([['gen9championsvgc2026regmc', [0, 1760]]]);
  });
});
