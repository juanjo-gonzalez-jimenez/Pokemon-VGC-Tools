import type {MoveData, MoveTable, SpeciesData, SpeciesTable} from '../data/types';
import {toID} from './ids';
import {isNature, STAT_LABELS, STATS, type StatName, type StatsTable} from './stats';

export interface TeamMember {
  /** Nickname if given, otherwise the species name as pasted. */
  label: string;
  /** Species used for analysis: the Mega form when holding its Mega Stone. */
  species: SpeciesData;
  isMega: boolean;
  item: string;
  /** Ability used for analysis (a Mega's own ability replaces the pasted one). */
  ability: string;
  /** Ability exactly as pasted ('' if none was given). */
  pastedAbility: string;
  /** The pasted (non-Mega) species, used for Species Clause and ability checks. */
  baseSpecies: SpeciesData;
  /** Number of move lines pasted, including unknown moves. */
  moveLines: number;
  /** Known final stats that replace the ones from `sp` and `nature` (a meta Pokémon's averages). */
  stats?: StatsTable;
  nature: string;
  /** Stat points (Champions' replacement for EVs). */
  sp: StatsTable;
  moves: MoveData[];
}

export interface ParsedTeam {
  members: TeamMember[];
  warnings: string[];
}

export const MAX_TEAM_SIZE = 6;
const IGNORED_PREFIXES = ['Level:', 'IVs:', 'Tera Type:', 'Shiny:', 'Happiness:', 'Gigantamax:', 'Hidden Power:'];
const STAT_BY_LABEL = new Map(STATS.map(s => [STAT_LABELS[s].toLowerCase(), s] as [string, StatName]));

const emptyStats = (): StatsTable => ({hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0});

/** "Nickname (Species) (M) @ Item" -> parts. */
export function parseHeader(line: string): {label: string; species: string; item: string} {
  const [namePart, ...itemParts] = line.split(' @ ');
  const item = itemParts.join(' @ ').trim();
  const name = namePart.trim().replace(/\s*\((M|F)\)$/, '');
  const nicknamed = /^(.*\S)\s*\(([^()]+)\)$/.exec(name);
  if (nicknamed) return {label: nicknamed[1], species: nicknamed[2], item};
  return {label: name, species: name, item};
}

/** "32 HP / 2 Atk / 32 Spe" -> stat points table. */
function parseStatLine(text: string): StatsTable {
  const sp = emptyStats();
  for (const part of text.split('/')) {
    const m = /^\s*(\d+)\s+(\w+)\s*$/.exec(part);
    const stat = m && STAT_BY_LABEL.get(m[2].toLowerCase());
    if (m && stat) sp[stat] = Number(m[1]);
  }
  return sp;
}

/** Index of Mega forms by "<base species id>:<stone id>". */
function megaIndex(species: SpeciesTable): Map<string, SpeciesData> {
  const index = new Map<string, SpeciesData>();
  for (const s of Object.values(species)) {
    if (s.requiredItem && s.baseSpecies) index.set(`${toID(s.baseSpecies)}:${toID(s.requiredItem)}`, s);
  }
  return index;
}

/** Parse a Showdown / Pokepaste export into team members, collecting human-readable warnings. */
export function parseTeam(text: string, species: SpeciesTable, moves: MoveTable): ParsedTeam {
  const warnings: string[] = [];
  const members: TeamMember[] = [];
  const megas = megaIndex(species);
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map(b => b.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('===')))
    .filter(b => b.length);

  for (const [header, ...lines] of blocks) {
    const {label, species: speciesName, item} = parseHeader(header);
    const base = species[toID(speciesName)];
    if (!base) {
      warnings.push(`Unknown Pokémon "${speciesName}" — skipped.`);
      continue;
    }
    const mega = item ? megas.get(`${toID(base.name)}:${toID(item)}`) : undefined;
    let ability = '';
    let moveLines = 0;
    let nature = 'Serious';
    let sp = emptyStats();
    const memberMoves: MoveData[] = [];

    for (const line of lines) {
      if (line.startsWith('- ')) {
        moveLines++;
        const move = moves[toID(line.slice(2))];
        if (move) memberMoves.push(move);
        else warnings.push(`${label}: unknown move "${line.slice(2)}" ignored.`);
      } else if (line.startsWith('Ability:')) {
        ability = line.slice('Ability:'.length).trim();
      } else if (/^(EVs|SPs|Stat Points):/.test(line)) {
        sp = parseStatLine(line.slice(line.indexOf(':') + 1));
      } else if (line.endsWith(' Nature')) {
        const n = line.replace(/ Nature$/, '');
        if (isNature(n)) nature = n;
        else warnings.push(`${label}: unknown nature "${n}", treated as neutral.`);
      } else if (!IGNORED_PREFIXES.some(p => line.startsWith(p))) {
        warnings.push(`${label}: didn't understand "${line}".`);
      }
    }

    const pastedAbility = ability;
    if (!ability) {
      ability = base.abilities[0] ?? '';
      if (!mega) warnings.push(`${label}: no ability given, assuming ${ability}.`);
    }
    if (!memberMoves.length) warnings.push(`${label}: no moves found.`);

    members.push({
      label,
      species: mega ?? base,
      isMega: Boolean(mega),
      item,
      ability: mega ? (mega.abilities[0] ?? ability) : ability,
      pastedAbility,
      baseSpecies: base,
      moveLines,
      nature,
      sp,
      moves: memberMoves,
    });
  }

  if (members.length > MAX_TEAM_SIZE) {
    warnings.push(`Only the first ${MAX_TEAM_SIZE} Pokémon are used.`);
    members.length = MAX_TEAM_SIZE;
  }
  return {members, warnings};
}
