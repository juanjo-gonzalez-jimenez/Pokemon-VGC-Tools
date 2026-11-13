/**
 * Downloads recent top tournament teams from Limitless (play.limitlesstcg.com, public API, no key)
 * for each regulation format in src/data/index.json, and writes src/data/teams/<format>.json.
 * Run with `npm run update-teams` after `npm run update-data` (it reads species.json).
 *
 * The API allows 50 requests per 5 minutes, so only the biggest recent events are read and the
 * script waits whenever the rate limit header says it is about to run out.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {RegulationIndex, SpeciesTable} from '../src/data/types';
import {limitlessFormat, type TournamentTeam} from '../src/lib/tournaments';
import {parseStandings, type LimitlessStanding} from './parsers';

const API = 'https://play.limitlesstcg.com/api';
/** Events read per format: the biggest from the last `DAYS` days. */
const MAX_EVENTS = 25;
const DAYS = 30;
const MIN_PLAYERS = 32;
/** Placings kept per event. */
const TOP = 4;
/** List pages of 50 events scanned per format (newest first). */
const LIST_PAGES = 3;

const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data');
const OUT_DIR = join(DATA_DIR, 'teams');

interface LimitlessEvent {
  id: string;
  name: string;
  date: string;
  format: string;
  players: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {headers: {'User-Agent': 'pokemon-vgc-tools-data-updater'}});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  // "ratelimit: "50-in-5min"; r=46; t=17": r requests left, t seconds until the window resets.
  const limit = res.headers.get('ratelimit') ?? '';
  const left = Number(/r=(\d+)/.exec(limit)?.[1] ?? 50);
  const reset = Number(/t=(\d+)/.exec(limit)?.[1] ?? 0);
  if (left <= 2) {
    console.log(`  rate limit nearly used, waiting ${reset + 2}s`);
    await sleep((reset + 2) * 1000);
  } else await sleep(300);
  return res.json() as Promise<T>;
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Sanity check failed: ${message}`);
}

async function teamsFor(format: string, species: SpeciesTable): Promise<TournamentTeam[]> {
  const since = Date.now() - DAYS * 24 * 3600 * 1000;
  const events: LimitlessEvent[] = [];
  for (let page = 1; page <= LIST_PAGES; page++) {
    const list = await getJson<LimitlessEvent[]>(`${API}/tournaments?game=VGC&format=${format}&limit=50&page=${page}`);
    check(Array.isArray(list), `tournament list for ${format} is not an array`);
    events.push(...list.filter(e => e.format === format && Date.parse(e.date) >= since));
    if (list.length < 50 || list.some(e => Date.parse(e.date) < since)) break;
  }
  const chosen = events
    .filter(e => e.players >= MIN_PLAYERS)
    .sort((a, b) => b.players - a.players)
    .slice(0, MAX_EVENTS);
  console.log(`${format}: ${events.length} recent events (up to ${DAYS} days), reading the ${chosen.length} biggest`);

  const teams: TournamentTeam[] = [];
  const unknown = new Set<string>();
  for (const e of chosen) {
    const standings = await getJson<LimitlessStanding[]>(`${API}/tournaments/${e.id}/standings`);
    check(Array.isArray(standings), `standings of ${e.id} are not an array`);
    const event = {id: e.id, name: e.name.trim(), date: e.date, players: e.players};
    teams.push(...parseStandings(event, standings, species, TOP, unknown));
  }
  if (unknown.size) console.warn(`  species not in species.json: ${[...unknown].join(', ')}`);
  // Newest event first, best placing first within an event.
  return teams.sort((a, b) => b.event.date.localeCompare(a.event.date) || a.placing - b.placing);
}

async function main() {
  const index = JSON.parse(readFileSync(join(DATA_DIR, 'index.json'), 'utf8')) as RegulationIndex;
  const species = JSON.parse(readFileSync(join(DATA_DIR, 'species.json'), 'utf8')) as SpeciesTable;
  const formats = [...new Set(index.regulations.map(r => limitlessFormat(r.id)).filter(f => f !== null))];
  check(formats.length > 0, 'no regulation maps to a Limitless format');

  mkdirSync(OUT_DIR, {recursive: true});
  for (const format of formats) {
    const teams = await teamsFor(format, species);
    const path = join(OUT_DIR, `${format}.json`);
    // An older regulation with no recent events keeps the teams it already has.
    if (!teams.length && existsSync(path)) {
      console.log(`  no recent teams, keeping ${path}`);
      continue;
    }
    check(
      teams.every(t => t.members.length === 6 && t.members.every(m => m.species && m.moves.length)),
      `a ${format} team is incomplete`,
    );
    writeFileSync(path, JSON.stringify(teams));
    console.log(`  wrote ${teams.length} teams to ${path}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
