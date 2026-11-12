import type {MetaPokemon} from '../data/types';
import {toID} from './ids';
import type {TypeName} from './typechart';
import {calcStat, parseSpread, STAT_LABELS, STATS, type StatName, type StatsTable} from './stats';

/** A base stat or the base stat total. */
export type StatKey = StatName | 'bst';
/** 'bstNoMega' sorts by base stat total and leaves Mega forms out of the list. */
export const SORT_KEYS = ['usage', 'rising', 'falling', 'name', 'bst', 'bstNoMega', ...STATS] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** Mega forms: "Charizard-Mega-Y", "Floette-Mega". */
export const isMega = (p: MetaPokemon) => /-Mega(-|$)/.test(p.name);

export const bst = (s: StatsTable) => STATS.reduce((sum, k) => sum + s[k], 0);

const valueOf = (p: MetaPokemon, key: StatKey) => (key === 'bst' ? bst(p.baseStats) : p.baseStats[key]);

/**
 * Pokémon whose name contains `query` (ignoring case and punctuation) and, when `type` is set,
 * that have that type in either slot.
 */
export function searchRoster(roster: readonly MetaPokemon[], query: string, type: TypeName | '' = ''): MetaPokemon[] {
  const q = toID(query);
  return roster.filter(
    p => (!q || toID(p.name).includes(q)) && (!type || (p.forms[0]?.types ?? []).includes(type)),
  );
}

/** 0 = usage at the rating cutoff, 1 = all-ratings usage only, 2 = no usage data. */
export const sourceRank = (p: MetaPokemon) => (p.source === 'none' ? 2 : p.source === 'all' ? 1 : 0);

/**
 * Usage and stats sort highest first; name sorts A–Z. Usage keeps Pokémon with rating-cutoff data
 * ahead of all-ratings-only ones, since their percentages aren't comparable.
 */
export function sortRoster(list: readonly MetaPokemon[], key: SortKey): MetaPokemon[] {
  const sorted = [...list];
  if (key === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name));
  if (key === 'usage') {
    return sorted.sort((a, b) => sourceRank(a) - sourceRank(b) || b.usage - a.usage || a.name.localeCompare(b.name));
  }
  if (key === 'bstNoMega') return sortRoster(sorted.filter(p => !isMega(p)), 'bst');
  if (key === 'rising' || key === 'falling') {
    // Only Pokémon with a trend; biggest change in usage first.
    const sign = key === 'rising' ? 1 : -1;
    return sorted
      .filter(p => usageTrend(p))
      .sort((a, b) => sign * (usageTrend(b)!.change - usageTrend(a)!.change) || b.usage - a.usage);
  }
  return sorted.sort((a, b) => valueOf(b, key) - valueOf(a, key) || b.usage - a.usage);
}

export interface UsageTrend {
  /** Usage last month (0..1). */
  previous: number;
  /** Change in usage, in share points (0.05 = 5 percentage points). */
  change: number;
  /** Unused last month, used now. */
  isNew: boolean;
}

/** Changes smaller than this (in share points) count as steady. */
export const STEADY = 0.005;

export type TrendInput = Pick<MetaPokemon, 'usage' | 'previousUsage'> & Partial<Pick<MetaPokemon, 'source'>>;

/** How a Pokémon's usage moved since last month; null without last month's data. */
export function usageTrend(p: TrendInput): UsageTrend | null {
  if (p.previousUsage === undefined || p.source) return null;
  return {previous: p.previousUsage, change: p.usage - p.previousUsage, isNew: p.previousUsage === 0 && p.usage > 0};
}

export interface FormattedSpread {
  nature: string;
  /** "32 HP / 14 Atk / 10 Def / 10 SpD" (stats with no points omitted). */
  text: string;
  /** Final stats at level 50 with this spread. */
  stats: StatsTable;
}

export function formatSpread(key: string, baseStats: StatsTable): FormattedSpread | null {
  const spread = parseSpread(key);
  if (!spread) return null;
  const text =
    STATS.filter(s => spread.sp[s] > 0)
      .map(s => `${spread.sp[s]} ${STAT_LABELS[s]}`)
      .join(' / ') || 'No stat points';
  const stats = Object.fromEntries(
    STATS.map(s => [s, calcStat(s, baseStats[s], spread.sp[s], spread.nature)]),
  ) as StatsTable;
  return {nature: spread.nature, text, stats};
}
