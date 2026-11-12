/**
 * Damage of one move, computed by Smogon's damage calculator (`@smogon/calc`) in its Pokémon
 * Champions mode (`Generations.get(0)`): Champions stat formula, Champions move data and
 * abilities, Showdown's 4096-based rounding and all 16 random rolls. This module only maps our
 * data onto it.
 */
import {calculate, Field as CalcField, Generations, Move as CalcMove, Pokemon as CalcPokemon} from '@smogon/calc';
import type {MoveData} from '../data/types';
import {attackOf} from './attack';
import {bestHit} from './coverage';
import {toID} from './ids';
import {STATS, type StatsTable} from './stats';
import type {TypeName} from './typechart';

export const LEVEL = 50;
/** The calculator's Pokémon Champions generation. */
const GEN = Generations.get(0 as Parameters<typeof Generations.get>[0]);

type BoostTable = Partial<Record<Exclude<keyof StatsTable, 'hp'>, number>>;

/** A Pokémon as the damage calculation sees it. */
export interface Combatant {
  name: string;
  /** Showdown species name, e.g. "Charizard-Mega-Y". */
  species: string;
  types: string[];
  ability: string;
  item: string;
  /** Final stats at level 50 (HP included). */
  stats: StatsTable;
  /**
   * The real build. Without it the calculator is given `stats` directly (a meta Pokémon's
   * average over all spreads).
   */
  build?: {nature: string; sp: StatsTable};
  boosts?: BoostTable;
  status?: '' | 'brn';
  /** Current HP as a % of max (100 when omitted). */
  hpPercent?: number;
}

export type Weather = '' | 'rain' | 'sun' | 'sand' | 'snow';
export type Terrain = '' | 'grassy' | 'electric' | 'psychic' | 'misty';
export interface Field {
  weather: Weather;
  terrain: Terrain;
}
export const NO_FIELD: Field = {weather: '', terrain: ''};

/** Effects on one side of the field. */
export interface SideConditions {
  reflect?: boolean;
  lightScreen?: boolean;
  auroraVeil?: boolean;
  helpingHand?: boolean;
  friendGuard?: boolean;
}

export interface DamageOptions {
  /** Conditions on the attacker's side (Helping Hand) and the defender's side (screens, Friend Guard). */
  attackerSide?: SideConditions;
  defenderSide?: SideConditions;
  crit?: boolean;
  /** Spread moves hit only this target (no 0.75× spread penalty). */
  singleTarget?: boolean;
}

export interface DamageEstimate {
  move: MoveData;
  /** Type the move actually has (after Pixilate, Weather Ball…). */
  type: TypeName;
  /** % of the defender's max HP: mean of the 16 rolls, and the lowest / highest roll. */
  percent: number;
  min: number;
  max: number;
  /** HP lost for each of the 16 rolls (multi-hit moves: total over all hits). */
  rolls: number[];
  /** Defender's max HP. */
  maxHp: number;
  /** Type effectiveness including the defender's ability. */
  mult: number;
  priority: number;
  /** Hits per use (multi-hit moves). */
  hits: number;
  /** "guaranteed OHKO", "62.5% chance to 2HKO" from the defender's current HP. */
  koText: string;
  /** Showdown-style one-line description. */
  desc: string;
}

const WEATHER: Record<Exclude<Weather, ''>, 'Rain' | 'Sun' | 'Sand' | 'Snow'> = {rain: 'Rain', sun: 'Sun', sand: 'Sand', snow: 'Snow'};
const TERRAIN: Record<Exclude<Terrain, ''>, 'Grassy' | 'Electric' | 'Psychic' | 'Misty'> = {
  grassy: 'Grassy',
  electric: 'Electric',
  psychic: 'Psychic',
  misty: 'Misty',
};

/** On the ground for terrain purposes: not Flying-type, no Levitate, no Air Balloon. */
export function grounded(p: Pick<Combatant, 'types' | 'ability' | 'item'>): boolean {
  return !p.types.includes('Flying') && toID(p.ability) !== 'levitate' && toID(p.item) !== 'airballoon';
}

/** Move priority, including Grassy Glide's +1 in Grassy Terrain. */
export function movePriority(move: MoveData, attacker: Pick<Combatant, 'types' | 'ability' | 'item'>, field: Field): number {
  if (toID(move.name) === 'grassyglide' && field.terrain === 'grassy' && grounded(attacker)) return move.priority + 1;
  return move.priority;
}

/** Species used as a stand-in (with overridden types and stats) for species the calculator lacks. */
const STAND_IN = 'Smeargle';

/** The calculator's Pokémon for a combatant (cached: the same combatant is reused across moves). */
const pokemonCache = new WeakMap<Combatant, CalcPokemon>();
function toCalcPokemon(c: Combatant): CalcPokemon {
  const cached = pokemonCache.get(c);
  if (cached) return cached;
  // A species the calculator doesn't know: a stand-in with the same types and stats.
  const known = Boolean(GEN.species.get(toID(c.species) as Parameters<typeof GEN.species.get>[0]));
  const base = c.build && known
    ? {nature: c.build.nature, evs: c.build.sp}
    : {
        // Champions: HP = base + SP + 75, others = base + SP + 20 (neutral nature). Shifting the
        // base stats reproduces the given final stats exactly.
        nature: 'Serious',
        evs: {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0},
        overrides: {
          baseStats: Object.fromEntries(STATS.map(s => [s, c.stats[s] - (s === 'hp' ? 75 : 20)])) as StatsTable,
          ...(known ? {} : {types: c.types}),
        },
      };
  const pokemon = new CalcPokemon(GEN, known ? c.species : STAND_IN, {
    level: LEVEL,
    ability: c.ability || undefined,
    item: c.item || undefined,
    boosts: c.boosts,
    status: c.status || '',
    ...base,
  } as ConstructorParameters<typeof CalcPokemon>[2]);
  if (c.hpPercent !== undefined && c.hpPercent < 100) {
    pokemon.originalCurHP = Math.max(1, Math.round((pokemon.maxHP() * c.hpPercent) / 100));
  }
  pokemonCache.set(c, pokemon);
  return pokemon;
}

function toCalcMove(move: MoveData, options: DamageOptions): CalcMove | null {
  const overrides: Record<string, unknown> = {};
  if (options.singleTarget && (move.target === 'allAdjacent' || move.target === 'allAdjacentFoes')) overrides.target = 'normal';
  const opts = {isCrit: options.crit || undefined, overrides} as ConstructorParameters<typeof CalcMove>[2];
  const known = GEN.moves.get(toID(move.name) as Parameters<typeof GEN.moves.get>[0]);
  if (known) return new CalcMove(GEN, move.name, opts);
  // Moves outside the calculator's data (e.g. assumed STAB attacks for unused Pokémon): a stand-in
  // with the same type, category and power.
  if (move.category === 'Status' || move.basePower <= 0) return null;
  return new CalcMove(GEN, 'Tackle', {
    ...opts,
    overrides: {...overrides, type: move.type, category: move.category, basePower: move.basePower, flags: {}},
  } as ConstructorParameters<typeof CalcMove>[2]);
}

function sideOf(s: SideConditions | undefined) {
  return {
    isReflect: s?.reflect,
    isLightScreen: s?.lightScreen,
    isAuroraVeil: s?.auroraVeil,
    isHelpingHand: s?.helpingHand,
    isFriendGuard: s?.friendGuard,
  };
}

/** Totals of the 16 rolls; multi-hit moves come back as one roll list per hit. */
function totalRolls(damage: number | number[] | number[][]): number[] {
  if (typeof damage === 'number') return Array(16).fill(damage);
  if (!damage.length) return Array(16).fill(0);
  if (Array.isArray(damage[0])) {
    const perHit = damage as number[][];
    return perHit[0].map((_, i) => perHit.reduce((sum, hit) => sum + hit[i], 0));
  }
  return damage as number[];
}

/** Damage of `move` from `attacker` to `defender`; null for status moves and moves it can't use. */
export function estimateDamage(
  attacker: Combatant,
  defender: Combatant,
  move: MoveData,
  field: Field = NO_FIELD,
  options: DamageOptions = {},
): DamageEstimate | null {
  const attack = attackOf(move, attacker.ability);
  // Power 0 in our data means a variable-power move (Low Kick, Heavy Slam…): the calculator
  // computes those from weight, Speed or HP, so only stand-in moves need a fixed power.
  if (!attack) return null;
  const calcMove = toCalcMove(move, options);
  if (!calcMove) return null;
  const a = toCalcPokemon(attacker);
  const d = toCalcPokemon(defender);
  const result = calculate(
    GEN,
    a,
    d,
    calcMove,
    new CalcField({
      gameType: 'Doubles',
      weather: field.weather ? WEATHER[field.weather] : undefined,
      terrain: field.terrain ? TERRAIN[field.terrain] : undefined,
      attackerSide: sideOf(options.attackerSide),
      defenderSide: sideOf(options.defenderSide),
    }),
  );
  const rolls = totalRolls(result.damage);
  const maxHp = d.maxHP();
  const pct = (hp: number) => (hp / maxHp) * 100;
  const mean = rolls.reduce((s, r) => s + r, 0) / rolls.length;
  let koText = '';
  let desc = '';
  if (mean > 0) {
    try {
      koText = result.kochance().text;
      desc = result.desc();
    } catch {
      // The calculator's text helpers can throw on unusual inputs; the numbers are still valid.
    }
  }
  return {
    move,
    type: (result.move.type as TypeName) || attack.type,
    percent: pct(mean),
    min: pct(Math.min(...rolls)),
    max: pct(Math.max(...rolls)),
    rolls,
    maxHp,
    mult: bestHit([attack], defender.types, defender.ability).mult,
    priority: movePriority(move, attacker, field),
    hits: calcMove.hits || 1,
    koText,
    desc,
  };
}

/** Hits needed to KO with this much damage per hit (Infinity when it does nothing). */
export function hitsToKO(percent: number): number {
  return percent > 0 ? Math.ceil(100 / percent - 1e-9) : Infinity;
}

/** "OHKO", "2HKO", … or "chip" for 5+ hits, "no damage" when it can't hurt. */
export function koLabel(percent: number): string {
  const n = hitsToKO(percent);
  if (n === Infinity) return 'no damage';
  if (n === 1) return 'OHKO';
  return n <= 4 ? `${n}HKO` : 'chip';
}
