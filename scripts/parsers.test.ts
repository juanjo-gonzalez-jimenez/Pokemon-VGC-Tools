import {describe, expect, it} from 'vitest';
import {
  championsVgcCutoffs,
  formatMods,
  formatName,
  legalSpecies,
  parseIconIndexes,
  parseItemNonstandard,
  parseItems,
  parseModInherit,
  parseLearnsets,
  parseModOverrides,
  parseStandings,
} from './parsers';
import type {SpeciesTable} from '../src/data/types';

describe('formatName', () => {
  it('reads year and regulation letters', () => {
    expect(formatName('gen9championsvgc2026regmc')).toBe('VGC 2026 Reg M-C (Bo1)');
    expect(formatName('gen9championsvgc2026regmcbo3')).toBe('VGC 2026 Reg M-C (Bo3)');
    expect(formatName('gen9vgc2025regi')).toBe('VGC 2025 Reg I (Bo1)');
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

describe('parseItemNonstandard', () => {
  it('reads the flag per item without leaking into the next entry', () => {
    const src =
      'exports.BattleItems = {abomasite:{name:"Abomasite",spritenum:575,num:674,gen:6,isNonstandard:"Past"},' +
      'choicescarf:{name:"Choice Scarf",spritenum:69,num:287,gen:4},' +
      'staraptite:{name:"Staraptite",spritenum:500,isNonstandard:"Future"}};';
    expect([...parseItemNonstandard(src)]).toEqual([['abomasite', 'Past'], ['staraptite', 'Future']]);
  });
});

describe('parseModOverrides', () => {
  const src = `export const Moves: import('../../../sim/dex-moves').ModdedMoveDataTable = {
	aircutter: {
		inherit: true,
		basePower: 90,
	},
	barrage: {
		inherit: true,
		basePower: 110,
		isNonstandard: "Past",
	},
	growth: {
		inherit: true,
		type: "Grass",
		onModifyMove(move) {
			if (true) { move.basePower = 999; }
		},
		secondary: {
			chance: 10,
			basePower: 5,
		},
	},
	abomasite: {
		inherit: true,
		isNonstandard: null,
	},
};`;
  const map = parseModOverrides(src);
  it('reads base power, type and availability', () => {
    expect(map.get('aircutter')).toEqual({basePower: 90});
    expect(map.get('barrage')).toEqual({basePower: 110, isNonstandard: 'Past'});
    expect(map.get('abomasite')).toEqual({isNonstandard: null});
  });
  it('ignores fields nested deeper than the entry itself', () => {
    expect(map.get('growth')).toEqual({type: 'Grass'});
  });
});

describe('parseModInherit', () => {
  it('finds the parent mod', () => {
    expect(parseModInherit("export const Scripts = {\n\tinherit: 'champions',\n\tgen: 9,\n};")).toBe('champions');
    expect(parseModInherit('export const Scripts = {\n\tgen: 9,\n\tinit() {},\n};')).toBeNull();
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
  it('groups cutoffs per Champions VGC format (Bo1 and Bo3) and skips other formats', () => {
    const map = championsVgcCutoffs([
      'gen9championsvgc2026regmc-0.json',
      'gen9championsvgc2026regmc-1760.json',
      'gen9championsvgc2026regmcbo3-1760.json',
      'gen9championsou-1760.json',
      'gen9vgc2024regg-1760.json',
    ]);
    expect([...map]).toEqual([
      ['gen9championsvgc2026regmc', [0, 1760]],
      ['gen9championsvgc2026regmcbo3', [1760]],
    ]);
  });
});

describe('parseLearnsets', () => {
  it('reads each species and its moves, noting inherit entries', () => {
    const src = `export const Learnsets: import('../../../sim/dex-species').ModdedLearnsetDataTable = {
\tvenusaur: {
\t\tlearnset: {
\t\t\tacidspray: ["9M"],
\t\t\tgigadrain: ["9M"],
\t\t},
\t},
\tfloetteeternal: {
\t\tinherit: true,
\t\tlearnset: {
\t\t\tmoonblast: ["9M"],
\t\t},
\t},
};
`;
    const l = parseLearnsets(src);
    expect(l.get('venusaur')).toEqual({inherit: false, moves: ['acidspray', 'gigadrain']});
    expect(l.get('floetteeternal')).toEqual({inherit: true, moves: ['moonblast']});
  });
});

describe('parseStandings', () => {
  const base = {types: ['Fire'], baseStats: {hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1}, abilities: []};
  const species = {
    charizard: {...base, name: 'Charizard', icon: 6},
    charizardmegay: {...base, name: 'Charizard-Mega-Y', baseSpecies: 'Charizard', requiredItem: 'Charizardite Y', icon: 99},
    ninetalesalola: {...base, name: 'Ninetales-Alola', baseSpecies: 'Ninetales'},
  } as SpeciesTable;
  const six = (first: {id: string; name: string; item?: string}) => [
    {...first, ability: 'Drought', nature: 'Timid', attacks: ['Heat Wave', 'Protect'], tera: null},
    ...Array.from({length: 5}, () => ({id: 'ninetales-alola', name: 'Alolan Ninetales', item: '', ability: 'Snow Warning', nature: 'Timid', attacks: ['Blizzard']})),
  ];
  const event = {id: 'e1', name: 'Weekly', date: '2026-11-10T00:00:00.000Z', players: 40};
  const standings = [
    {player: 'b', name: 'B', placing: 2, record: {wins: 6, losses: 2, ties: 0}, decklist: six({id: 'charizard', name: 'Charizard'})},
    {player: 'a', name: 'A', placing: 1, record: {wins: 7, losses: 1, ties: 0}, decklist: six({id: 'charizard', name: 'Charizard', item: 'Charizardite Y'})},
    {player: 'c', name: 'C', placing: 3, record: {wins: 5, losses: 3, ties: 0}, decklist: null},
    {player: 'd', name: 'D', placing: 9, record: {wins: 4, losses: 4, ties: 0}, decklist: six({id: 'charizard', name: 'Charizard'})},
    {player: 'e', name: 'E', placing: 4, record: {wins: 5, losses: 3, ties: 0}, decklist: six({id: 'mystery', name: 'Mystery'})},
  ];

  it('keeps the top placings with a full team, best first', () => {
    const unknown = new Set<string>();
    const teams = parseStandings(event, standings, species, 4, unknown);
    expect(teams.map(t => t.player)).toEqual(['a', 'b', 'e']);
    expect(unknown).toEqual(new Set(['mystery']));
  });

  it('maps species to our ids and Mega forms by their stone', () => {
    const [a, b] = parseStandings(event, standings, species, 4);
    expect(a.members[0]).toEqual({
      species: 'charizard', name: 'Charizard', form: 'charizardmegay', formName: 'Charizard-Mega-Y', icon: 99,
      item: 'Charizardite Y', ability: 'Drought', nature: 'Timid', moves: ['Heat Wave', 'Protect'],
    });
    expect(b.members[0].form).toBe('charizard');
    expect(a.members[1]).toMatchObject({species: 'ninetalesalola', name: 'Ninetales-Alola', form: 'ninetalesalola'});
    expect(a.record).toEqual({wins: 7, losses: 1, ties: 0});
  });
});
