/**
 * Downloads Pokémon Showdown's species data and Smogon's monthly VGC usage stats, and writes a
 * compact per-regulation roster to src/data/. Run with `npm run update-data`.
 *
 * The roster of a regulation is every Pokémon that shows up in its usage stats (above
 * MIN_USAGE), so new regulations are picked up automatically when Smogon publishes stats.
 * Also writes species.json and moves.json, used to read imported teams, and per regulation a
 * `<id>-dex.json` with every legal Pokémon for the searcher. Legality comes from Showdown's
 * Champions formats-data files, read as text (never executed; see parsers.ts).
 *
 * Everything is computed and sanity-checked first; files are only written if the checks pass, so
 * an upstream change that breaks a parser fails the run instead of publishing broken data.
 */
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
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
} from './parsers';
import {toID} from '../src/lib/ids';
import {spriteId} from '../src/lib/sprites';
import {calcStat, parseSpread, STATS, type StatsTable} from '../src/lib/stats';
import type {
  ItemTable,
  MetaPokemon,
  ModData,
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
const modFileUrl = (mod: string, file: string) => `${SHOWDOWN_RAW}data/mods/${mod}/${file}.ts`;
const formatsDataUrl = (mod: string) => modFileUrl(mod, 'formats-data');
/** Showdown client data with the icon-sheet index of every form (read as text, never executed). */
const ICON_INDEX_URL =
  'https://raw.githubusercontent.com/smogon/pokemon-showdown-client/master/play.pokemonshowdown.com/src/battle-dex-data.ts';
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

/** Sanity floors: fewer than this means a download or parser is broken. */
const FLOORS = {species: 1000, moves: 700, items: 400, icons: 100, legal: 50, roster: 30};
/** A regulation's lists may not shrink below this share of what is already on disk. */
const MAX_SHRINK = 0.7;

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
  /** The form whose learnset this one uses. */
  changesFrom?: string;
}

interface DexMove {
  num: number;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  target: string;
  priority: number;
  flags?: Record<string, number>;
  isNonstandard?: string | null;
  multihit?: number | [number, number];
  overrideOffensivePokemon?: 'target';
  overrideOffensiveStat?: 'def';
  overrideDefensiveStat?: 'def';
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
  // Some hosts refuse requests without a recognisable client name.
  const res = await fetch(url, {headers: {'User-Agent': 'pokemon-vgc-tools-data-updater'}});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}

/** Text of a file that may not exist (a mod only has the files it changes). */
async function getOptionalText(url: string): Promise<string | null> {
  const res = await fetch(url, {headers: {'User-Agent': 'pokemon-vgc-tools-data-updater'}});
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

/** Links of an Apache-style directory listing. */
async function listDir(url: string): Promise<string[]> {
  const html = await (await get(url)).text();
  return [...html.matchAll(/href="([^"?/][^"]*)"/g)].map(m => m[1]);
}

interface FoundFormat {
  month: string;
  cutoff: number;
  /** The newest earlier month with stats at the same cutoff (for usage trends). */
  previousMonth?: string;
}

/** Latest month and best cutoff available for each VGC format in the last few months. */
async function findFormats(): Promise<Map<string, FoundFormat>> {
  const months = (await listDir(STATS_URL))
    .filter(h => /^\d{4}-\d{2}\/$/.test(h))
    .map(h => h.slice(0, -1))
    .sort()
    .reverse()
    .slice(0, MONTHS_TO_SCAN);

  const found = new Map<string, FoundFormat>();
  for (const month of months) {
    const byFormat = championsVgcCutoffs(await listDir(`${STATS_URL}${month}/chaos/`));
    for (const [format, cutoffs] of byFormat) {
      const known = found.get(format);
      if (known) {
        if (!known.previousMonth && cutoffs.includes(known.cutoff)) known.previousMonth = month;
        continue;
      }
      const cutoff = CUTOFFS.find(c => cutoffs.includes(c));
      if (cutoff !== undefined) found.set(format, {month, cutoff});
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

/** Usage-weighted mean final stats over every spread (the stored top spreads cover too few sets). */
function meanStats(spreads: Record<string, number>, base: StatsTable): StatsTable | null {
  const sums: StatsTable = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
  let total = 0;
  for (const [key, w] of Object.entries(spreads)) {
    const spread = parseSpread(key);
    if (!spread) continue;
    for (const s of STATS) sums[s] += calcStat(s, base[s], spread.sp[s], spread.nature) * w;
    total += w;
  }
  if (!total) return null;
  return Object.fromEntries(STATS.map(s => [s, Math.round(sums[s] / total)])) as StatsTable;
}

/** Stats for a Pokémon without usage data: neutral nature, 32 points in its better attacking stat and Speed. */
function assumedStats(base: StatsTable): StatsTable {
  const physical = base.atk >= base.spa;
  return Object.fromEntries(
    STATS.map(s => [s, calcStat(s, base[s], s === 'spe' || s === (physical ? 'atk' : 'spa') ? 32 : 0)]),
  ) as StatsTable;
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
    stats: meanStats(stats.Spreads, entry.baseStats) ?? assumedStats(entry.baseStats),
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
    stats: assumedStats(entry.baseStats),
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

/** Compact species and move tables for reading pasted teams. */
function buildLookupTables(dex: Record<string, DexEntry>, moves: Record<string, DexMove>) {
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
      icon: iconIndex(id, e),
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
      ...(m.flags?.sound ? {sound: true as const} : {}),
      ...(m.multihit ? {multihit: m.multihit} : {}),
      ...(m.overrideOffensivePokemon === 'target' ? {offensive: 'target' as const} : {}),
      ...(m.overrideOffensiveStat === 'def' ? {offensive: 'def' as const} : {}),
      ...(m.overrideDefensiveStat === 'def' ? {defensive: 'def' as const} : {}),
    };
  }
  return {species, moveTable};
}

/** A mod and the mods it inherits from, base-most first: ["champions", "championsregmb"]. */
async function modChain(mod: string): Promise<string[]> {
  const chain = [mod];
  for (let current = mod; chain.length < 10; ) {
    const scripts = await getOptionalText(modFileUrl(current, 'scripts'));
    const parent = scripts ? parseModInherit(scripts) : null;
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

/**
 * How a mod's game differs from the base data: availability (base `isNonstandard`, then each
 * mod in the chain may set or clear it) and move type / base power changes.
 */
async function buildModData(
  mod: string,
  moves: Record<string, DexMove>,
  moveTable: MoveTable,
  items: ItemTable,
  baseItemNonstandard: Map<string, string>,
): Promise<ModData> {
  const moveState = new Map(
    Object.keys(moveTable).map(id => [id, {nonstandard: moves[id].isNonstandard ?? null, type: moves[id].type, basePower: moves[id].basePower}]),
  );
  const itemState = new Map(Object.keys(items).map(id => [id, baseItemNonstandard.get(id) ?? null]));

  for (const link of await modChain(mod)) {
    const moveOverrides = parseModOverrides((await getOptionalText(modFileUrl(link, 'moves'))) ?? '');
    for (const [id, o] of moveOverrides) {
      const state = moveState.get(id);
      if (!state) continue;
      if (o.isNonstandard !== undefined) state.nonstandard = o.isNonstandard;
      if (o.type) state.type = o.type;
      if (o.basePower !== undefined) state.basePower = o.basePower;
    }
    const itemOverrides = parseModOverrides((await getOptionalText(modFileUrl(link, 'items'))) ?? '');
    for (const [id, o] of itemOverrides) {
      if (itemState.has(id) && o.isNonstandard !== undefined) itemState.set(id, o.isNonstandard);
    }
  }

  // Learnsets: each mod in the chain replaces a species' list, or adds to it with `inherit`.
  const learnsets = new Map<string, Set<string>>();
  for (const link of await modChain(mod)) {
    for (const [id, entry] of parseLearnsets((await getOptionalText(modFileUrl(link, 'learnsets'))) ?? '')) {
      const learned = entry.inherit ? (learnsets.get(id) ?? new Set<string>()) : new Set<string>();
      for (const m of entry.moves) learned.add(m);
      learnsets.set(id, learned);
    }
  }

  const data: ModData = {moves: {}, unavailableMoves: [], unavailableItems: []};
  if (learnsets.size) {
    data.learnsets = Object.fromEntries([...learnsets].sort(([a], [b]) => a.localeCompare(b)).map(([id, s]) => [id, [...s].sort()]));
  }
  for (const [id, state] of moveState) {
    if (state.nonstandard) data.unavailableMoves.push(id);
    const change: {type?: string; basePower?: number} = {};
    if (state.type !== moves[id].type) change.type = state.type;
    if (state.basePower !== moves[id].basePower) change.basePower = state.basePower;
    if (Object.keys(change).length) data.moves[id] = change;
  }
  for (const [id, nonstandard] of itemState) if (nonstandard) data.unavailableItems.push(id);
  return data;
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Sanity check failed: ${message}`);
}

/** Number of entries in a JSON array (or in `key` of a JSON object) already on disk, if any. */
function previousCount(path: string, key?: string): number | null {
  if (!existsSync(path)) return null;
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    const list = key ? value[key] : value;
    return Array.isArray(list) ? list.length : null;
  } catch {
    return null;
  }
}

/** Fails when a list shrank a lot compared to the copy on disk (a sign of a broken parser). */
function checkNotShrunk(what: string, count: number, previous: number | null) {
  if (previous === null) return;
  check(count >= previous * MAX_SHRINK, `${what} dropped from ${previous} to ${count}`);
}

async function main() {
  const dex = (await (await get(POKEDEX_URL)).json()) as Record<string, DexEntry>;
  const moves = (await (await get(MOVES_URL)).json()) as Record<string, DexMove>;
  const itemsText = await (await get(ITEMS_URL)).text();
  const items = parseItems(itemsText);
  const baseItemNonstandard = parseItemNonstandard(itemsText);
  iconIndexes = parseIconIndexes(await (await get(ICON_INDEX_URL)).text());
  const {species, moveTable} = buildLookupTables(dex, moves);

  check(Object.keys(species).length >= FLOORS.species, `only ${Object.keys(species).length} species`);
  check(Object.keys(moveTable).length >= FLOORS.moves, `only ${Object.keys(moveTable).length} moves`);
  check(Object.keys(items).length >= FLOORS.items, `only ${Object.keys(items).length} items parsed`);
  check(iconIndexes.size >= FLOORS.icons, `only ${iconIndexes.size} icon indexes parsed`);

  const names: Names = {abilities: new Map(), items: new Map(), moves: new Map()};
  for (const entry of Object.values(dex)) {
    for (const ability of Object.values(entry.abilities ?? {})) names.abilities.set(toID(ability), ability);
  }
  for (const [id, m] of Object.entries(moves)) names.moves.set(id, m.name);
  for (const [id, item] of Object.entries(items)) names.items.set(id, item.name);

  const modOf = formatMods(await (await get(FORMATS_TS_URL)).text());
  const legalByMod = new Map<string, Set<string>>();
  const legalFor = async (mod: string) => {
    if (!legalByMod.has(mod)) {
      const legal = legalSpecies(await (await get(formatsDataUrl(mod))).text(), dex);
      check(legal.size >= FLOORS.legal, `only ${legal.size} legal Pokémon parsed for mod ${mod}`);
      legalByMod.set(mod, legal);
    }
    return legalByMod.get(mod)!;
  };

  const modDir = join(OUT_DIR, 'mods');
  const modData = new Map<string, ModData>();
  const modFor = async (mod: string) => {
    if (!modData.has(mod)) modData.set(mod, await buildModData(mod, moves, moveTable, items, baseItemNonstandard));
    return modData.get(mod)!;
  };

  const formats = await findFormats();
  check(formats.size > 0, 'no Champions VGC formats found in recent Smogon stats');

  const regDir = join(OUT_DIR, 'regulations');
  /** Output path -> content, written only after every check has passed. */
  const outputs = new Map<string, string>([
    [join(OUT_DIR, 'species.json'), JSON.stringify(species)],
    [join(OUT_DIR, 'moves.json'), JSON.stringify(moveTable)],
    [join(OUT_DIR, 'items.json'), JSON.stringify(items)],
  ]);
  const summary = [
    `Lookup tables: ${Object.keys(species).length} species, ${Object.keys(moveTable).length} moves, ` +
      `${Object.keys(items).length} items`,
  ];

  const regulations: RegulationIndex['regulations'] = [];
  for (const [id, {month, cutoff, previousMonth}] of formats) {
    const chaos = (await (await get(`${STATS_URL}${month}/chaos/${id}-${cutoff}.json`)).json()) as ChaosFile;
    const {roster, missing} = buildRoster(chaos, dex, names);
    // Last month's usage at the same cutoff, for rising / falling trends.
    const previous = previousMonth
      ? byId((await (await get(`${STATS_URL}${previousMonth}/chaos/${id}-${cutoff}.json`)).json()) as ChaosFile)
      : null;
    const withTrend = (p: MetaPokemon): MetaPokemon =>
      previous && !p.source ? {...p, previousUsage: Number((previous.get(p.id)?.usage ?? 0).toFixed(5))} : p;
    check(modOf.has(id), `format ${id} not found in Showdown's config/formats.ts`);
    const mod = modOf.get(id)!;
    const data: RegulationData = {
      id,
      name: formatName(id),
      month,
      cutoff,
      battles: chaos.info['number of battles'],
      mod,
      ...(previousMonth ? {previousMonth} : {}),
      pokemon: roster.map(withTrend),
    };
    // Searcher list: every legal Pokémon, with all-ratings stats for ones too rare at the cutoff.
    const allChaos =
      cutoff === 0 ? null : ((await (await get(`${STATS_URL}${month}/chaos/${id}-0.json`)).json()) as ChaosFile);
    const dexList = buildDex(await legalFor(mod), chaos, allChaos, dex, names).map(withTrend);

    const rosterPath = join(regDir, `${id}.json`);
    const dexPath = join(regDir, `${id}-dex.json`);
    check(roster.length >= FLOORS.roster, `${data.name} roster has only ${roster.length} Pokémon`);
    check(missing.length <= roster.length * 0.05, `${data.name}: ${missing.length} Pokémon not in the pokedex`);
    checkNotShrunk(`${data.name} roster`, roster.length, previousCount(rosterPath, 'pokemon'));
    checkNotShrunk(`${data.name} searcher list`, dexList.length, previousCount(dexPath));

    // Game differences. Anything players actually use must exist in the game, so a used move or
    // item flagged unavailable means the override parsing is wrong.
    const game = await modFor(mod);
    const goneMoves = new Set(game.unavailableMoves);
    const goneItems = new Set(game.unavailableItems);
    const usedButGone = [
      ...new Set(
        roster.flatMap(p => [
          ...Object.keys(p.moves).filter(m => p.moves[m] >= 0.05 && goneMoves.has(toID(m))),
          ...Object.keys(p.items).filter(i => p.items[i] >= 0.05 && goneItems.has(toID(i))),
        ]),
      ),
    ];
    check(usedButGone.length === 0, `${data.name}: used but flagged unavailable: ${usedButGone.slice(0, 8).join(', ')}`);
    check(game.unavailableMoves.length < Object.keys(moveTable).length * 0.8, `${mod}: almost every move unavailable`);
    // Learnsets: forms without their own (Megas, battle forms) use the form they change from
    // (Floette-Mega -> Floette-Eternal).
    if (game.learnsets) {
      for (const p of dexList) {
        const entry = dex[p.id];
        const battleOnly = typeof entry?.battleOnly === 'string' ? entry.battleOnly : undefined;
        const from = entry?.changesFrom ?? battleOnly ?? entry?.baseSpecies;
        if (!game.learnsets[p.id] && from && game.learnsets[toID(from)] && toID(from) !== p.baseSprite) {
          game.learnsets[p.id] = game.learnsets[toID(from)];
        }
      }
    }
    // Learnsets: what players actually run must be learnable, or the parsing is wrong.
    if (game.learnsets) {
      const learnable = (p: MetaPokemon, move: string) => {
        const list = game.learnsets![p.id] ?? (p.baseSprite ? game.learnsets![p.baseSprite] : undefined);
        return !list || list.includes(toID(move));
      };
      const unlearnable = roster.flatMap(p =>
        Object.keys(p.moves).filter(m => p.moves[m] >= 0.05 && !learnable(p, m)).map(m => `${p.name}: ${m}`),
      );
      check(unlearnable.length <= 3, `${data.name}: common moves not in learnsets: ${unlearnable.slice(0, 8).join(', ')}`);
      check(Object.keys(game.learnsets).length >= roster.length * 0.5, `${mod}: only ${Object.keys(game.learnsets).length} learnsets`);
    }

    outputs.set(rosterPath, JSON.stringify(data));
    outputs.set(dexPath, JSON.stringify(dexList));
    outputs.set(join(modDir, `${mod}.json`), JSON.stringify(game));
    regulations.push({id, name: data.name, month, cutoff, battles: data.battles, mod, ...(previousMonth ? {previousMonth} : {})});
    const count = (s: MetaPokemon['source']) => dexList.filter(p => p.source === s).length;
    summary.push(
      `${data.name}: ${month} @${cutoff}${previousMonth ? ` (trend vs ${previousMonth})` : ''}, ${data.battles} battles, ${roster.length} Pokémon` +
        `; searcher: ${dexList.length} legal (${count('all')} from all ratings, ${count('none')} unused)` +
        `; ${mod}: ${Object.keys(game.moves).length} changed / ${game.unavailableMoves.length} removed moves, ` +
        `${game.unavailableItems.length} removed items` +
        (missing.length ? `, ${missing.length} unmatched (${missing.slice(0, 5).join(', ')})` : ''),
    );
  }
  // Most-played first, which puts the current regulation on top.
  regulations.sort((a, b) => b.battles - a.battles);
  // `updated` is the newest stats month, so re-running with unchanged stats rewrites nothing.
  const index: RegulationIndex = {updated: regulations.map(r => r.month).sort().at(-1)!, regulations};
  outputs.set(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));

  // All checks passed: write, and drop regulation files that are no longer produced.
  for (const dir of [regDir, modDir]) {
    mkdirSync(dir, {recursive: true});
    for (const f of readdirSync(dir)) {
      if (!outputs.has(join(dir, f))) rmSync(join(dir, f));
    }
  }
  let changed = 0;
  for (const [path, content] of outputs) {
    if (existsSync(path) && readFileSync(path, 'utf8') === content) continue;
    writeFileSync(path, content);
    changed++;
  }
  for (const line of summary) console.log(line);
  console.log(changed ? `Wrote ${changed} changed file(s).` : 'Data already up to date.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
