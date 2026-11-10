/**
 * Readers for Pokémon Showdown source files. The files are TypeScript/JS, but they are only ever
 * read as text here (never executed), so each parser is a small pattern over a known layout.
 * Keep them covered by parsers.test.ts: a layout change upstream should fail a test, not ship
 * broken data.
 */
import type {ItemTable} from '../src/data/types';
import {toID} from '../src/lib/ids';

/** "gen9championsvgc2026regmc" -> "VGC 2026 Reg M-C". */
export function formatName(id: string): string {
  const m = /vgc(\d{4})reg([a-z]+)/.exec(id);
  if (!m) return id;
  const reg = m[2].toUpperCase().split('').join('-');
  return `VGC ${m[1]} Reg ${reg}`;
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
  // Fields before `name` may include one level of nested braces (e.g. `fling:{basePower:80}`).
  const starts = [...source.matchAll(/(\w+):\{(?:[^{}]|\{[^{}]*\})*?name:"([^"]+)"/g)];
  const items: ItemTable = {};
  starts.forEach((m, i) => {
    const segment = source.slice(m.index, starts[i + 1]?.index ?? source.length);
    const sprite = /spritenum:(\d+)/.exec(segment);
    items[m[1]] = {name: m[2], sprite: sprite ? Number(sprite[1]) : 0};
  });
  return items;
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
    if (!m || m[1].endsWith('bo3')) continue;
    byFormat.set(m[1], [...(byFormat.get(m[1]) ?? []), Number(m[2])]);
  }
  return byFormat;
}
