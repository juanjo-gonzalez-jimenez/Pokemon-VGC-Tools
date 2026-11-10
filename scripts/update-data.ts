/**
 * Downloads Pokémon Showdown's species data and Smogon's monthly VGC usage stats, and writes a
 * compact per-regulation roster to src/data/. Run with `npm run update-data`.
 *
 * The roster of a regulation is every Pokémon that shows up in its usage stats (above
 * MIN_USAGE), so new regulations are picked up automatically when Smogon publishes stats.
 * Also writes species.json and moves.json, used to read imported teams, and per regulation a
 * `<id>-dex.json` with every legal Pokémon for the searcher. Legality comes from Showdown's
 * Champions formats-data files, read as text (never executed).
 */
import {mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {toID} from '../src/lib/ids';
import {spriteId} from '../src/lib/sprites';
import {calcStat, parseSpread, STATS, type StatsTable} from '../src/lib/stats';
import type {
  ItemTable,
  MetaPokemon,
  MoveTable,
  RegulationData,
  RegulationIndex,
  SpeciesTable,
} from '../src/data/types';

const POKEDEX_URL = 'https://play.pokemonshowdown.com/data/pokedex.json';
const MOVES_URL = 'https://play.pokemonshowdown.com/data/moves.json';
/** Plain JS object literal; item names are read from it as text, never executed. */
const ITEMS_URL = 'https://play.pokemonshowdown.com/data/items.js';
const SHOWDOWN_RAW = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/';
/** Format rules (which data mod each format uses) and per-mod legality, both read as text. */
const FORMATS_TS_URL = `${SHOWDOWN_RAW}config/formats.ts`;
const formatsDataUrl = (mod: string) => `${SHOWDOWN_RAW}data/mods/${mod}/formats-data.ts`;
/** Showdown client data with the icon-sheet index of every form (read as text, never executed). */
const ICON_INDEX_URL =
  'https://raw.githubusercontent.com/smogon/pokemon-showdown-client/master/play.pokemonshowdown.com/src/battle-dex-data.ts';
/** Flat Rules ban these species tags. */
const BANNED_TAGS = ['Mythical', 'Restricted Legendary'];
const STATS_URL = 'https://www.smogon.com/stats/';
/** How many recent months to search for Pokémon Champions VGC formats. */
const MONTHS_TO_SCAN = 3;
/** Preferred rating cutoffs, best first. 1760 reflects high-level play. */
const CUTOFFS = [1760, 1630, 1500, 0];
/** Ignore Pokémon on fewer than this fraction of teams. */
const MIN_USAGE = 0.001;
/** Drop speed tiers, items and moves seen on fewer than this share of sets. */
const MIN_SHARE = 0.005;
const TOP_ITEMS = 10;
const TOP_MOVES = 20;
const TOP_SPREADS = 10;
/** Keep this many most-frequent teammates (each on at least MIN_TEAMMATE_RATE of its teams). */
const TOP_TEAMMATES = 40;
const MIN_TEAMMATE_RATE = 0.01;

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'data');

interface DexEntry {
  num: number;
  name: string;
  types: string[];
  baseStats: StatsTable;
  abilities: Record<string, string>;
  requiredItem?: string;
  baseSpecies?: string;
  tags?: string[];
  battleOnly?: string | string[];
}

interface DexMove {
  num: number;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  target: string;
  priority: number;
}

interface ChaosPokemon {
  usage: number;
  Abilities: Record<string, number>;
  Items: Record<string, number>;
  Moves: Record<string, number>;
  Spreads: Record<string, number>;
  /** Teammate name -> weighted number of teams with both. */
  Teammates: Record<string, number>;
}

interface ChaosFile {
  info: {metagame: string; cutoff: number; 'number of battles': number};
  data: Record<string, ChaosPokemon>;
}

interface Names {
  abilities: Map<string, string>;
  items: Map<string, string>;
  moves: Map<string, string>;
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}

/** Links of an Apache-style directory listing. */
async function listDir(url: string): Promise<string[]> {
  const html = await (await get(url)).text();
  return [...html.matchAll(/href="([^"?/][^"]*)"/g)].map(m => m[1]);
}

/** "gen9championsvgc2026regmc" -> "VGC 2026 Reg M-C". */
export function formatName(id: string): string {
  const m = /vgc(\d{4})reg([a-z]+)/.exec(id);
  if (!m) return id;
  const reg = m[2].toUpperCase().split('').join('-');
  return `VGC ${m[1]} Reg ${reg}`;
}

/** Latest month and best cutoff available for each VGC format in the last few months. */
async function findFormats(): Promise<Map<string, {month: string; cutoff: number}>> {
  const months = (await listDir(STATS_URL))
    .filter(h => /^\d{4}-\d{2}\/$/.test(h))
    .map(h => h.slice(0, -1))
    .sort()
    .reverse()
    .slice(0, MONTHS_TO_SCAN);

  const found = new Map<string, {month: string; cutoff: number}>();
  for (const month of months) {
    const files = await listDir(`${STATS_URL}${month}/chaos/`);
    const byFormat = new Map<string, number[]>();
    for (const f of files) {
      const m = /^(gen9championsvgc\w*?)-(\d+)\.json$/.exec(f);
      if (!m || m[1].endsWith('bo3')) continue;
      byFormat.set(m[1], [...(byFormat.get(m[1]) ?? []), Number(m[2])]);
    }
    for (const [format, cutoffs] of byFormat) {
      const cutoff = CUTOFFS.find(c => cutoffs.includes(c));
      if (!found.has(format) && cutoff !== undefined) found.set(format, {month, cutoff});
    }
  }
  return found;
}

const round = (x: number) => Number(x.toFixed(4));

/** Weights -> shares of `total`, keeping the `limit` largest at or above MIN_SHARE. */
function topShares(weights: Record<string, number>, total: number, names: Map<string, string>, limit: number) {
  const out: Record<string, number> = {};
  if (!total) return out;
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  for (const [id, w] of sorted) {
    if (Object.keys(out).length >= limit || w / total < MIN_SHARE) break;
    if (id === 'nothing' || id === '') continue;
    out[names.get(id) ?? id] = round(w / total);
  }
  return out;
}

/** The most common stat-point spreads and the overall nature split. */
function spreadSummary(spreads: Record<string, number>) {
  const total = Object.values(spreads).reduce((a, b) => a + b, 0);
  const top: Record<string, number> = {};
  const natures = new Map<string, number>();
  if (!total) return {spreads: top, natures: {}};
  const sorted = Object.entries(spreads).sort((a, b) => b[1] - a[1]);
  for (const [key, w] of sorted) {
    const spread = parseSpread(key);
    if (!spread) continue;
    if (Object.keys(top).length < TOP_SPREADS && w / total >= MIN_SHARE) top[key] = round(w / total);
    natures.set(spread.nature, (natures.get(spread.nature) ?? 0) + w);
  }
  const natureShares = Object.fromEntries(
    [...natures]
      .filter(([, w]) => w / total >= MIN_SHARE)
      .sort((a, b) => b[1] - a[1])
      .map(([n, w]) => [n, round(w / total)]),
  );
  return {spreads: top, natures: natureShares};
}

/** Usage-weighted distribution of final Speed stats over the Pokémon's spreads. */
function speedDistribution(spreads: Record<string, number>, baseSpe: number) {
  const bySpeed = new Map<number, number>();
  for (const [key, w] of Object.entries(spreads)) {
    const spread = parseSpread(key);
    if (!spread) continue;
    const speed = calcStat('spe', baseSpe, spread.sp.spe, spread.nature);
    bySpeed.set(speed, (bySpeed.get(speed) ?? 0) + w);
  }
  const total = [...bySpeed.values()].reduce((a, b) => a + b, 0);
  const kept = [...bySpeed].filter(([, w]) => total && w / total >= MIN_SHARE);
  const keptTotal = kept.reduce((a, [, w]) => a + w, 0);
  return Object.fromEntries(kept.sort((a, b) => b[0] - a[0]).map(([s, w]) => [s, round(w / keptTotal)]));
}

/** Teammate weights -> share of this Pokémon's teams that also have the teammate. */
function teammateRates(teammates: Record<string, number>, total: number, dex: Record<string, DexEntry>) {
  if (!total) return {};
  return Object.fromEntries(
    Object.entries(teammates)
      .map(([name, w]) => [dex[toID(name)]?.name ?? name, w / total] as const)
      .filter(([, rate]) => rate >= MIN_TEAMMATE_RATE)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_TEAMMATES)
      .map(([name, rate]) => [name, round(rate)]),
  );
}

/** Icon index on Showdown's icon sheet: forms have their own index, others use the dex number. */
let iconIndexes = new Map<string, number>();
const iconIndex = (id: string, entry: DexEntry) =>
  iconIndexes.get(id) ?? (entry.num > 0 && entry.num <= 1025 ? entry.num : 0);

/** Parse `BattlePokemonIconIndexes` ("charizardmegay: 1320 + 2,") from the client's data file, as text. */
function parseIconIndexes(source: string): Map<string, number> {
  const start = source.indexOf('BattlePokemonIconIndexes:');
  const end = source.indexOf('};', start);
  const map = new Map<string, number>();
  for (const [, id, a, b] of source.slice(start, end).matchAll(/^\t(\w+): (\d+)(?: \+ (\d+))?,/gm)) {
    map.set(id, Number(a) + Number(b ?? 0));
  }
  return map;
}

/** One Pokémon's usage data from a chaos file. */
function buildEntry(id: string, entry: DexEntry, stats: ChaosPokemon, dex: Record<string, DexEntry>, names: Names): MetaPokemon {
  const total = Object.values(stats.Abilities).reduce((a, b) => a + b, 0);
  const abilities = topShares(stats.Abilities, total, names.abilities, Infinity);
  const itemTotal = Object.values(stats.Items).reduce((a, b) => a + b, 0);
  return {
    id,
    name: entry.name,
    usage: Number(stats.usage.toFixed(5)),
    sprite: spriteId(entry.name, entry.baseSpecies),
    ...(entry.baseSpecies ? {baseSprite: toID(entry.baseSpecies)} : {}),
    icon: iconIndex(id, entry),
    forms: [{name: entry.name, types: entry.types, weight: 1, abilities}],
    baseStats: entry.baseStats,
    speeds: speedDistribution(stats.Spreads, entry.baseStats.spe),
    items: topShares(stats.Items, itemTotal, names.items, TOP_ITEMS),
    // Move weights are per set, so divide by the number of sets (the ability total).
    moves: topShares(stats.Moves, total, names.moves, TOP_MOVES),
    teammates: teammateRates(stats.Teammates, total, dex),
    ...spreadSummary(stats.Spreads),
  };
}

/** A legal Pokémon nobody used: base data only. */
function emptyEntry(id: string, entry: DexEntry): MetaPokemon {
  return {
    id,
    name: entry.name,
    usage: 0,
    sprite: spriteId(entry.name, entry.baseSpecies),
    ...(entry.baseSpecies ? {baseSprite: toID(entry.baseSpecies)} : {}),
    icon: iconIndex(id, entry),
    forms: [{name: entry.name, types: entry.types, weight: 1, abilities: {}}],
    baseStats: entry.baseStats,
    speeds: {},
    items: {},
    moves: {},
    teammates: {},
    spreads: {},
    natures: {},
    source: 'none',
  };
}

/** chaos data keyed by Showdown id. */
const byId = (chaos: ChaosFile) => new Map(Object.entries(chaos.data).map(([name, s]) => [toID(name), s]));

/** The meta roster used by the Coverage and Team tabs: Pokémon above MIN_USAGE at the cutoff. */
function buildRoster(chaos: ChaosFile, dex: Record<string, DexEntry>, names: Names) {
  const roster: MetaPokemon[] = [];
  const missing: string[] = [];
  for (const [name, stats] of Object.entries(chaos.data)) {
    if (stats.usage < MIN_USAGE) continue;
    const entry = dex[toID(name)];
    if (!entry) {
      missing.push(name);
      continue;
    }
    roster.push(buildEntry(toID(name), entry, stats, dex, names));
  }
  roster.sort((a, b) => b.usage - a.usage);
  return {roster, missing};
}

/**
 * Every legal Pokémon for the searcher. Usage data comes from the rating cutoff when the Pokémon
 * appears there, otherwise from all ratings (marked `source: 'all'`), otherwise none.
 */
function buildDex(
  legal: Set<string>,
  cutoffChaos: ChaosFile,
  allChaos: ChaosFile | null,
  dex: Record<string, DexEntry>,
  names: Names,
): MetaPokemon[] {
  const atCutoff = byId(cutoffChaos);
  const atAll = allChaos ? byId(allChaos) : new Map<string, ChaosPokemon>();
  const out: MetaPokemon[] = [];
  for (const id of legal) {
    const entry = dex[id];
    if (!entry) continue;
    const cutoffStats = atCutoff.get(id);
    const allStats = atAll.get(id);
    if (cutoffStats && cutoffStats.usage > 0) out.push(buildEntry(id, entry, cutoffStats, dex, names));
    else if (allStats && allStats.usage > 0) out.push({...buildEntry(id, entry, allStats, dex, names), source: 'all'});
    else out.push(emptyEntry(id, entry));
  }
  return out.sort((a, b) => sourceRank(a) - sourceRank(b) || b.usage - a.usage || a.name.localeCompare(b.name));
}

const sourceRank = (p: MetaPokemon) => (p.source === 'none' ? 2 : p.source === 'all' ? 1 : 0);

/** Format id -> Showdown data mod, from config/formats.ts. */
function formatMods(formatsTs: string): Map<string, string> {
  const mods = new Map<string, string>();
  const re = /name: "([^"]+)",\s*\n(?:\s*\w+:[^\n]*\n)*?\s*mod: '([^']+)'/g;
  for (const [, name, mod] of formatsTs.matchAll(re)) mods.set(toID(name), mod);
  return mods;
}

/** Legal species ids in a data mod: entries without `isNonstandard`, minus Flat Rules bans and battle-only forms (Megas kept). */
function legalSpecies(formatsDataTs: string, dex: Record<string, DexEntry>): Set<string> {
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
 * Item names and icon-sheet numbers from items.js, read as text: each entry is `id:{...}` with a
 * `name` (not always the first field) and its `spritenum` appears before the next entry starts.
 */
function parseItems(source: string): ItemTable {
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

/** Compact species and move tables for reading pasted teams. */
function writeLookupTables(dex: Record<string, DexEntry>, moves: Record<string, DexMove>) {
  const species: SpeciesTable = {};
  for (const [id, e] of Object.entries(dex)) {
    if (e.num <= 0 || !e.baseStats || !STATS.every(s => s in e.baseStats)) continue;
    species[id] = {
      name: e.name,
      types: e.types,
      baseStats: e.baseStats,
      abilities: Object.values(e.abilities ?? {}),
      ...(e.baseSpecies ? {baseSpecies: e.baseSpecies} : {}),
      ...(e.requiredItem ? {requiredItem: e.requiredItem} : {}),
    };
  }
  const moveTable: MoveTable = {};
  for (const [id, m] of Object.entries(moves)) {
    if (m.num <= 0) continue;
    moveTable[id] = {
      name: m.name,
      type: m.type,
      category: m.category,
      basePower: m.basePower,
      target: m.target,
      priority: m.priority,
    };
  }
  writeFileSync(join(OUT_DIR, 'species.json'), JSON.stringify(species));
  writeFileSync(join(OUT_DIR, 'moves.json'), JSON.stringify(moveTable));
  console.log(`Lookup tables: ${Object.keys(species).length} species, ${Object.keys(moveTable).length} moves`);
}

async function main() {
  const dex = (await (await get(POKEDEX_URL)).json()) as Record<string, DexEntry>;
  const moves = (await (await get(MOVES_URL)).json()) as Record<string, DexMove>;
  const itemsText = await (await get(ITEMS_URL)).text();

  const names: Names = {abilities: new Map(), items: new Map(), moves: new Map()};
  for (const entry of Object.values(dex)) {
    for (const ability of Object.values(entry.abilities ?? {})) names.abilities.set(toID(ability), ability);
  }
  for (const [id, m] of Object.entries(moves)) names.moves.set(id, m.name);
  const items = parseItems(itemsText);
  for (const [id, item] of Object.entries(items)) names.items.set(id, item.name);
  if (names.items.size < 100) throw new Error('Could not read item names from items.js');

  mkdirSync(OUT_DIR, {recursive: true});
  writeLookupTables(dex, moves);
  writeFileSync(join(OUT_DIR, 'items.json'), JSON.stringify(items));

  iconIndexes = parseIconIndexes(await (await get(ICON_INDEX_URL)).text());
  if (iconIndexes.size < 100) throw new Error('Could not read icon indexes from battle-dex-data.ts');

  const formatsTs = await (await get(FORMATS_TS_URL)).text();
  const modOf = formatMods(formatsTs);
  const legalByMod = new Map<string, Set<string>>();
  const legalFor = async (mod: string) => {
    if (!legalByMod.has(mod)) {
      const legal = legalSpecies(await (await get(formatsDataUrl(mod))).text(), dex);
      if (legal.size < 50) throw new Error(`Only ${legal.size} legal Pokémon parsed for mod ${mod}`);
      legalByMod.set(mod, legal);
    }
    return legalByMod.get(mod)!;
  };

  const formats = await findFormats();
  if (!formats.size) throw new Error('No Champions VGC formats found in recent Smogon stats.');

  const regDir = join(OUT_DIR, 'regulations');
  mkdirSync(regDir, {recursive: true});
  for (const f of readdirSync(regDir)) rmSync(join(regDir, f));

  const index: RegulationIndex = {updated: new Date().toISOString().slice(0, 10), regulations: []};
  for (const [id, {month, cutoff}] of formats) {
    const chaos = (await (await get(`${STATS_URL}${month}/chaos/${id}-${cutoff}.json`)).json()) as ChaosFile;
    const {roster, missing} = buildRoster(chaos, dex, names);
    const data: RegulationData = {
      id,
      name: formatName(id),
      month,
      cutoff,
      battles: chaos.info['number of battles'],
      pokemon: roster,
    };
    writeFileSync(join(regDir, `${id}.json`), JSON.stringify(data));

    // Searcher list: every legal Pokémon, with all-ratings stats for ones too rare at the cutoff.
    const mod = modOf.get(id) ?? 'champions';
    const allChaos =
      cutoff === 0 ? null : ((await (await get(`${STATS_URL}${month}/chaos/${id}-0.json`)).json()) as ChaosFile);
    const dexList = buildDex(await legalFor(mod), chaos, allChaos, dex, names);
    writeFileSync(join(regDir, `${id}-dex.json`), JSON.stringify(dexList));
    const count = (s: MetaPokemon['source']) => dexList.filter(p => p.source === s).length;
    index.regulations.push({id, name: data.name, month, cutoff, battles: data.battles});
    console.log(
      `${data.name}: ${month} @${cutoff}, ${data.battles} battles, ${roster.length} Pokémon` +
        `; searcher: ${dexList.length} legal (${count('all')} from all ratings, ${count('none')} unused) [${mod}]` +
        (missing.length ? `, ${missing.length} unmatched (${missing.slice(0, 5).join(', ')})` : ''),
    );
  }
  // Most-played first, which puts the current regulation on top.
  index.regulations.sort((a, b) => b.battles - a.battles);
  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
