/**
 * Downloads Pokémon Showdown's species data and Smogon's monthly VGC usage stats, and writes a
 * compact per-regulation roster to src/data/. Run with `npm run update-data`.
 *
 * The roster of a regulation is every Pokémon that shows up in its usage stats (above
 * MIN_USAGE), so new regulations are picked up automatically when Smogon publishes stats.
 */
import {mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {toID} from '../src/lib/ids';
import type {Pokemon} from '../src/lib/coverage';
import type {RegulationData, RegulationIndex} from '../src/data/types';

const POKEDEX_URL = 'https://play.pokemonshowdown.com/data/pokedex.json';
const STATS_URL = 'https://www.smogon.com/stats/';
/** How many recent months to search for Pokémon Champions VGC formats. */
const MONTHS_TO_SCAN = 3;
/** Preferred rating cutoffs, best first. 1760 reflects high-level play. */
const CUTOFFS = [1760, 1630, 1500, 0];
/** Ignore Pokémon on fewer than this fraction of teams. */
const MIN_USAGE = 0.001;

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'data');

interface DexEntry {
  name: string;
  types: string[];
  abilities: Record<string, string>;
}

interface ChaosFile {
  info: {metagame: string; cutoff: number; 'number of battles': number};
  data: Record<string, {usage: number; Abilities: Record<string, number>}>;
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

function buildRoster(chaos: ChaosFile, dex: Record<string, DexEntry>, abilityNames: Map<string, string>) {
  const roster: Pokemon[] = [];
  const missing: string[] = [];
  for (const [name, stats] of Object.entries(chaos.data)) {
    if (stats.usage < MIN_USAGE) continue;
    const entry = dex[toID(name)];
    if (!entry) {
      missing.push(name);
      continue;
    }
    const total = Object.values(stats.Abilities).reduce((a, b) => a + b, 0);
    const abilities: Record<string, number> = {};
    for (const [id, count] of Object.entries(stats.Abilities)) {
      const share = total ? count / total : 0;
      // Drop noise such as abilities on <0.5% of sets.
      if (share >= 0.005) abilities[abilityNames.get(id) ?? id] = Number(share.toFixed(4));
    }
    roster.push({
      id: toID(name),
      name: entry.name,
      usage: Number(stats.usage.toFixed(5)),
      forms: [{name: entry.name, types: entry.types, weight: 1, abilities}],
    });
  }
  roster.sort((a, b) => b.usage - a.usage);
  return {roster, missing};
}

async function main() {
  const dex = (await (await get(POKEDEX_URL)).json()) as Record<string, DexEntry>;
  const abilityNames = new Map<string, string>();
  for (const entry of Object.values(dex)) {
    for (const ability of Object.values(entry.abilities ?? {})) abilityNames.set(toID(ability), ability);
  }

  const formats = await findFormats();
  if (!formats.size) throw new Error('No Champions VGC formats found in recent Smogon stats.');

  const regDir = join(OUT_DIR, 'regulations');
  mkdirSync(regDir, {recursive: true});
  for (const f of readdirSync(regDir)) rmSync(join(regDir, f));

  const index: RegulationIndex = {updated: new Date().toISOString().slice(0, 10), regulations: []};
  for (const [id, {month, cutoff}] of formats) {
    const chaos = (await (await get(`${STATS_URL}${month}/chaos/${id}-${cutoff}.json`)).json()) as ChaosFile;
    const {roster, missing} = buildRoster(chaos, dex, abilityNames);
    const data: RegulationData = {
      id,
      name: formatName(id),
      month,
      cutoff,
      battles: chaos.info['number of battles'],
      pokemon: roster,
    };
    writeFileSync(join(regDir, `${id}.json`), JSON.stringify(data));
    index.regulations.push({id, name: data.name, month, cutoff, battles: data.battles});
    console.log(
      `${data.name}: ${month} @${cutoff}, ${data.battles} battles, ${roster.length} Pokémon` +
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
