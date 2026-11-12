/**
 * Readers for Pokémon Showdown source files. The files are TypeScript/JS, but they are only ever
 * read as text here (never executed), so each parser is a small pattern over a known layout.
 * Keep them covered by parsers.test.ts: a layout change upstream should fail a test, not ship
 * broken data.
 */
import type {ItemTable} from '../src/data/types';
import {toID} from '../src/lib/ids';

/** Best-of-three formats end in "bo3"; the rest are the best-of-one ladder. */
export const isBo3 = (id: string) => id.endsWith('bo3');

/** "gen9championsvgc2026regmc" -> "VGC 2026 Reg M-C (Bo1)", "…regmcbo3" -> "VGC 2026 Reg M-C (Bo3)". */
export function formatName(id: string): string {
  const m = /vgc(\d{4})reg([a-z]+?)(bo3)?$/.exec(id);
  if (!m) return id;
  const reg = m[2].toUpperCase().split('').join('-');
  return `VGC ${m[1]} Reg ${reg} (${m[3] ? 'Bo3' : 'Bo1'})`;
}

/** Format id -> Showdown data mod, from config/formats.ts. */
export function formatMods(formatsTs: string): Map<string, string> {
  const mods = new Map<string, string>();
  const re = /name: "([^"]+)",\s*\n(?:\s*\w+:[^\n]*\n)*?\s*mod: '([^']+)'/g;
  for (const [, name, mod] of formatsTs.matchAll(re)) mods.set(toID(name), mod);
  return mods;
}

/** The species facts legality depends on (a subset of a pokedex.json entry). */
export interface LegalityDexEntry {
  tags?: string[];
  battleOnly?: string | string[];
  requiredItem?: string;
}

/** Flat Rules ban these species tags. */
export const BANNED_TAGS = ['Mythical', 'Restricted Legendary'];

/**
 * Legal species ids in a data mod's formats-data.ts: entries without `isNonstandard`, minus
 * Flat Rules bans and battle-only forms (Megas, which need an item, are kept).
 */
export function legalSpecies(formatsDataTs: string, dex: Record<string, LegalityDexEntry>): Set<string> {
  const legal = new Set<string>();
  for (const [, id, body] of formatsDataTs.matchAll(/^\t(\w+): \{([^}]*)\}/gm)) {
    if (body.includes('isNonstandard')) continue;
    const entry = dex[id];
    if (!entry) continue;
    if (entry.tags?.some(t => BANNED_TAGS.includes(t))) continue;
    if (entry.battleOnly && !entry.requiredItem) continue;
    legal.add(id);
  }
  return legal;
}

/**
 * Item names and icon-sheet numbers from items.js: each entry is `id:{...}` with a `name` (not
 * always the first field) and its `spritenum` appears before the next entry starts.
 */
export function parseItems(source: string): ItemTable {
  const items: ItemTable = {};
  for (const {id, name, segment} of itemSegments(source)) {
    const sprite = /spritenum:(\d+)/.exec(segment);
    items[id] = {name, sprite: sprite ? Number(sprite[1]) : 0};
  }
  return items;
}

/** Item id -> `isNonstandard` value in items.js ("Past", "Future", ...), for items that have one. */
export function parseItemNonstandard(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const {id, segment} of itemSegments(source)) {
    const value = /isNonstandard:"(\w+)"/.exec(segment);
    if (value) map.set(id, value[1]);
  }
  return map;
}

/** Splits items.js into one text segment per item entry. */
function itemSegments(source: string): Array<{id: string; name: string; segment: string}> {
  // Fields before `name` may include one level of nested braces (e.g. `fling:{basePower:80}`).
  const starts = [...source.matchAll(/(\w+):\{(?:[^{}]|\{[^{}]*\})*?name:"([^"]+)"/g)];
  return starts.map((m, i) => ({
    id: m[1],
    name: m[2],
    segment: source.slice(m.index, starts[i + 1]?.index ?? source.length),
  }));
}

/** What a data mod changes about one move or item (only the fields this app uses). */
export interface ModOverride {
  /** "Past" etc. removes it from the game; null makes a base-game "Past"/"Future" entry available. */
  isNonstandard?: string | null;
  type?: string;
  basePower?: number;
}

/**
 * Entries of a mod's moves.ts / items.ts: top-level `\tid: {` blocks, reading the fields written
 * at two tabs of indentation (deeper lines belong to nested objects or functions).
 */
export function parseModOverrides(source: string): Map<string, ModOverride> {
  const out = new Map<string, ModOverride>();
  for (const [, id, body] of source.matchAll(/^\t(\w+): \{\n([\s\S]*?)^\t\},/gm)) {
    const override: ModOverride = {};
    const nonstandard = /^\t\tisNonstandard: (?:"(\w+)"|(null)),/m.exec(body);
    if (nonstandard) override.isNonstandard = nonstandard[2] ? null : nonstandard[1];
    const type = /^\t\ttype: "(\w+)",/m.exec(body);
    if (type) override.type = type[1];
    const power = /^\t\tbasePower: (\d+),/m.exec(body);
    if (power) override.basePower = Number(power[1]);
    out.set(id, override);
  }
  return out;
}

/** The mod a data mod inherits from (`inherit: 'champions'` in its scripts.ts), if any. */
export function parseModInherit(scriptsTs: string): string | null {
  return /^\tinherit: '(\w+)',/m.exec(scriptsTs)?.[1] ?? null;
}

/** `BattlePokemonIconIndexes` ("charizardmegay: 1320 + 2,") from the client's battle-dex-data.ts. */
export function parseIconIndexes(source: string): Map<string, number> {
  const start = source.indexOf('BattlePokemonIconIndexes:');
  const map = new Map<string, number>();
  if (start < 0) return map;
  const end = source.indexOf('};', start);
  for (const [, id, a, b] of source.slice(start, end).matchAll(/^\t(\w+): (\d+)(?: \+ (\d+))?,/gm)) {
    map.set(id, Number(a) + Number(b ?? 0));
  }
  return map;
}

/** Stat-file names in a Smogon chaos directory -> the rating cutoffs available per VGC format. */
export function championsVgcCutoffs(files: readonly string[]): Map<string, number[]> {
  const byFormat = new Map<string, number[]>();
  for (const f of files) {
    const m = /^(gen9championsvgc\w*?)-(\d+)\.json$/.exec(f);
    if (!m) continue;
    byFormat.set(m[1], [...(byFormat.get(m[1]) ?? []), Number(m[2])]);
  }
  return byFormat;
}

/**
 * Learnsets from a data mod's learnsets.ts: species id -> move ids it can learn. `inherit`
 * entries add to the parent mod's list instead of replacing it.
 */
export function parseLearnsets(source: string): Map<string, {inherit: boolean; moves: string[]}> {
  const out = new Map<string, {inherit: boolean; moves: string[]}>();
  // Each species block starts with one tab of indentation and ends at the next one.
  const blocks = source.split(/^\t(?=\w+: \{)/m).slice(1);
  for (const block of blocks) {
    const id = /^(\w+): \{/.exec(block)?.[1];
    const learnset = /learnset: \{([\s\S]*?)\n\t\t\}/.exec(block)?.[1];
    if (!id || learnset === undefined) continue;
    const moves = [...learnset.matchAll(/^\t{3}(\w+): \[/gm)].map(m => m[1]);
    out.set(id, {inherit: /^\t\tinherit: true,/m.test(block), moves});
  }
  return out;
}
