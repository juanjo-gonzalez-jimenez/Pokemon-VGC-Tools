/** The Calc tab's editable sets: filled from usage data, turned into calculator input. */
import type {MetaPokemon, MoveTable, SpeciesData} from '../data/types';
import {mainAbility} from './combatant';
import type {Combatant, DamageEstimate, DamageOptions, Field, SideConditions} from './damage';
import {estimateDamage} from './damage';
import {toID} from './ids';
import {MAX_STAT_SP, MAX_TOTAL_SP} from './legality';
import {calcStat, parseSpread, STATS, type StatsTable} from './stats';

export const MOVE_SLOTS = 4;
export const BOOST_STATS = ['atk', 'def', 'spa', 'spd', 'spe'] as const;
export type BoostStat = (typeof BOOST_STATS)[number];

export interface CalcSet {
  /** Showdown id of the Pokémon (an entry of the regulation's searcher list). */
  id: string;
  ability: string;
  item: string;
  nature: string;
  sp: StatsTable;
  /** Move names; '' for an empty slot. */
  moves: string[];
  boosts: Record<BoostStat, number>;
  burned: boolean;
  crit: boolean;
  /** Current HP, % of max. */
  hp: number;
}

export interface CalcState {
  a: CalcSet | null;
  b: CalcSet | null;
  field: Field;
  sides: {a: SideConditions; b: SideConditions};
  /** Spread moves hit only one target (no 0.75× penalty). */
  singleTarget: boolean;
}

const zeroSp = (): StatsTable => ({hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0});
const noBoosts = (): Record<BoostStat, number> => ({atk: 0, def: 0, spa: 0, spd: 0, spe: 0});
const top = (shares: Record<string, number>) =>
  Object.entries(shares).reduce<[string, number]>((a, b) => (b[1] > a[1] ? b : a), ['', 0])[0];

/** Spreads to offer, most used first: "Adamant:32/14/10/0/10/0" keys with their share. */
export function spreadOptions(p: MetaPokemon): Array<[key: string, share: number]> {
  return Object.entries(p.spreads).sort((a, b) => b[1] - a[1]);
}

/** Apply a spread key to a set (nature and stat points). */
export function withSpread(set: CalcSet, key: string): CalcSet {
  const spread = parseSpread(key);
  return spread ? {...set, nature: spread.nature, sp: spread.sp} : set;
}

/**
 * The Pokémon's most used set: most common ability and item, most common spread, and its four most
 * used damaging moves (topped up with its most used other moves).
 */
export function usageSet(p: MetaPokemon, species: SpeciesData | undefined, moves: MoveTable): CalcSet {
  const byUse = Object.entries(p.moves).sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const damaging = byUse.filter(name => {
    const m = moves[toID(name)];
    return m && m.category !== 'Status';
  });
  const picked = [...damaging, ...byUse.filter(n => !damaging.includes(n))].slice(0, MOVE_SLOTS);
  const set: CalcSet = {
    id: p.id,
    ability: mainAbility(p) || species?.abilities[0] || '',
    item: top(p.items),
    nature: 'Serious',
    sp: zeroSp(),
    moves: [...picked, ...Array(MOVE_SLOTS).fill('')].slice(0, MOVE_SLOTS),
    boosts: noBoosts(),
    burned: false,
    crit: false,
    hp: 100,
  };
  const spread = spreadOptions(p)[0];
  return spread ? withSpread(set, spread[0]) : set;
}

/** Final stats of a set at level 50 (Champions formula). */
export function setStats(set: CalcSet, species: SpeciesData): StatsTable {
  return Object.fromEntries(STATS.map(s => [s, calcStat(s, species.baseStats[s], set.sp[s], set.nature)])) as StatsTable;
}

/** Problems with a set's stat points (Champions limits). */
export function spProblems(sp: StatsTable): string[] {
  const issues: string[] = [];
  const total = STATS.reduce((sum, s) => sum + sp[s], 0);
  if (total > MAX_TOTAL_SP) issues.push(`${total} stat points (max ${MAX_TOTAL_SP})`);
  for (const s of STATS) if (sp[s] > MAX_STAT_SP) issues.push(`${sp[s]} in one stat (max ${MAX_STAT_SP})`);
  return issues;
}

export function toCombatant(set: CalcSet, species: SpeciesData): Combatant {
  return {
    name: species.name,
    species: species.name,
    types: species.types,
    ability: set.ability,
    item: set.item,
    stats: setStats(set, species),
    build: {nature: set.nature, sp: set.sp},
    boosts: set.boosts,
    status: set.burned ? 'brn' : '',
    hpPercent: set.hp,
  };
}

export interface MoveResult {
  name: string;
  /** null: not a known damaging move. */
  estimate: DamageEstimate | null;
}

/** Each of `attacker`'s moves against `defender`, with the field and both sides' conditions. */
export function calcMoves(
  attacker: {set: CalcSet; species: SpeciesData},
  defender: {set: CalcSet; species: SpeciesData},
  moves: MoveTable,
  field: Field,
  attackerSide: SideConditions,
  defenderSide: SideConditions,
  singleTarget: boolean,
): MoveResult[] {
  const a = toCombatant(attacker.set, attacker.species);
  const d = toCombatant(defender.set, defender.species);
  const options: DamageOptions = {attackerSide, defenderSide, crit: attacker.set.crit, singleTarget};
  return attacker.set.moves
    .filter(Boolean)
    .map(name => {
      const move = moves[toID(name)];
      return {name: move?.name ?? name, estimate: move ? estimateDamage(a, d, move, field, options) : null};
    });
}
