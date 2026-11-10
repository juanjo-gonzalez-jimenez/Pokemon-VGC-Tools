/**
 * Estimated damage of one move, at level 50, following the Gen 9 damage formula that Pokémon
 * Champions uses (Showdown data/mods/champions/scripts.ts `modifyDamage`). It is an estimate:
 * only the effects listed in MODELLED below are applied, and multipliers are applied as plain
 * floats rather than Showdown's 4096-based rounding.
 */
import type {MoveData} from '../data/types';
import {attackOf, type Attack} from './attack';
import {bestHit} from './coverage';
import {toID} from './ids';
import type {StatsTable} from './stats';
import type {TypeName} from './typechart';

export const LEVEL = 50;
/** Middle of the 85–100% random roll, used for the headline number. */
export const AVERAGE_ROLL = 0.925;

/** A Pokémon as the damage formula sees it. */
export interface Combatant {
  name: string;
  types: string[];
  ability: string;
  item: string;
  /** Final stats at level 50 (HP included). */
  stats: StatsTable;
}

export type Weather = '' | 'rain' | 'sun' | 'sand' | 'snow';
export type Terrain = '' | 'grassy';
export interface Field {
  weather: Weather;
  terrain: Terrain;
}
export const NO_FIELD: Field = {weather: '', terrain: ''};

export interface DamageEstimate {
  move: MoveData;
  /** Type the move actually has (after Pixilate, Weather Ball…). */
  type: TypeName;
  /** % of the defender's HP: average roll, and the min/max rolls. */
  percent: number;
  min: number;
  max: number;
  /** Type effectiveness including the defender's ability. */
  mult: number;
  priority: number;
  /** Hits per use (multi-hit moves). */
  hits: number;
}

/** What this module applies; everything else is ignored (see README "Not modelled"). */
export const MODELLED = [
  'STAB (Adaptability)',
  'Huge Power / Pure Power',
  'Technician',
  '-ate abilities (1.2×)',
  'multi-hit moves',
  'Foul Play / Body Press / Psyshock',
  'Life Orb, Choice Band / Specs, type-boosting items, Expert Belt',
  'Assault Vest, type-resist berries',
  'Multiscale / Shadow Shield',
  'spread moves (0.75×)',
  'rain, sun, sand, snow',
  'Grassy Terrain (incl. Grassy Glide priority)',
] as const;

const TYPE_BOOST_ITEMS: Record<string, TypeName> = {
  silkscarf: 'Normal', charcoal: 'Fire', mysticwater: 'Water', magnet: 'Electric', miracleseed: 'Grass',
  nevermeltice: 'Ice', blackbelt: 'Fighting', poisonbarb: 'Poison', softsand: 'Ground', sharpbeak: 'Flying',
  twistedspoon: 'Psychic', silverpowder: 'Bug', hardstone: 'Rock', spelltag: 'Ghost', dragonfang: 'Dragon',
  blackglasses: 'Dark', metalcoat: 'Steel', fairyfeather: 'Fairy',
};

/** Berries that halve a super-effective hit of their type (Chilan: any Normal hit). */
const RESIST_BERRIES: Record<string, TypeName> = {
  chilanberry: 'Normal', occaberry: 'Fire', passhoberry: 'Water', wacanberry: 'Electric', rindoberry: 'Grass',
  yacheberry: 'Ice', chopleberry: 'Fighting', kebiaberry: 'Poison', shucaberry: 'Ground', cobaberry: 'Flying',
  payapaberry: 'Psychic', tangaberry: 'Bug', chartiberry: 'Rock', kasibberry: 'Ghost', habanberry: 'Dragon',
  colburberry: 'Dark', babiriberry: 'Steel', roseliberry: 'Fairy',
};

const ATE_ABILITIES = ['pixilate', 'aerilate', 'refrigerate', 'galvanize'];
const WEATHER_BALL_TYPES: Record<Exclude<Weather, ''>, TypeName> = {rain: 'Water', sun: 'Fire', sand: 'Rock', snow: 'Ice'};

/** On the ground for terrain purposes: not Flying-type, no Levitate, no Air Balloon. */
export function grounded(p: Combatant): boolean {
  return !p.types.includes('Flying') && toID(p.ability) !== 'levitate' && toID(p.item) !== 'airballoon';
}

/** Hits per use: fixed, or the average of 2–5 (3; Skill Link 5, Loaded Dice 4). */
function hitCount(move: MoveData, attacker: Combatant): number {
  if (!move.multihit) return 1;
  if (typeof move.multihit === 'number') return move.multihit;
  if (toID(attacker.ability) === 'skilllink') return move.multihit[move.multihit.length - 1];
  if (toID(attacker.item) === 'loadeddice') return 4;
  return 3;
}

/** Move priority, including Grassy Glide's +1 in Grassy Terrain. */
export function movePriority(move: MoveData, attacker: Combatant, field: Field): number {
  if (toID(move.name) === 'grassyglide' && field.terrain === 'grassy' && grounded(attacker)) return move.priority + 1;
  return move.priority;
}

/** Estimated damage of `move` from `attacker` to `defender`; null for status and unestimated moves. */
export function estimateDamage(
  attacker: Combatant,
  defender: Combatant,
  move: MoveData,
  field: Field = NO_FIELD,
): DamageEstimate | null {
  const base = attackOf(move, attacker.ability);
  if (!base || move.basePower <= 0) return null;
  const id = toID(move.name);
  const ability = toID(attacker.ability);
  const item = toID(attacker.item);
  const defItem = toID(defender.item);

  // Weather Ball takes the type of the weather on the field.
  const attack: Attack =
    id === 'weatherball' && field.weather ? {...base, type: WEATHER_BALL_TYPES[field.weather]} : base;
  const type = attack.type;
  const mult = bestHit([attack], defender.types, defender.ability).mult;
  const priority = movePriority(move, attacker, field);
  const hits = hitCount(move, attacker);
  const none = {move, type, percent: 0, min: 0, max: 0, mult, priority, hits};
  if (mult === 0) return none;

  // Base power modifiers.
  let power = id === 'weatherball' && field.weather ? 100 : move.basePower;
  if (ability === 'technician' && power <= 60) power *= 1.5;
  if (ATE_ABILITIES.includes(ability) && move.type === 'Normal') power *= 1.2;
  if (TYPE_BOOST_ITEMS[item] === type) power *= 1.2;
  if (field.terrain === 'grassy') {
    if (type === 'Grass' && grounded(attacker)) power *= 1.3;
    if ((id === 'earthquake' || id === 'bulldoze') && grounded(defender)) power *= 0.5;
  }

  // Attacking and defending stats.
  const physical = move.category === 'Physical';
  let atk =
    move.offensive === 'target'
      ? defender.stats.atk
      : move.offensive === 'def'
        ? attacker.stats.def
        : physical
          ? attacker.stats.atk
          : attacker.stats.spa;
  if (physical && move.offensive !== 'def' && (ability === 'hugepower' || ability === 'purepower')) atk *= 2;
  if (physical && item === 'choiceband') atk *= 1.5;
  if (!physical && item === 'choicespecs') atk *= 1.5;
  const usesDef = physical || move.defensive === 'def';
  let def = usesDef ? defender.stats.def : defender.stats.spd;
  if (!usesDef && defItem === 'assaultvest') def *= 1.5;
  if (!usesDef && field.weather === 'sand' && defender.types.includes('Rock')) def *= 1.5;
  if (usesDef && field.weather === 'snow' && defender.types.includes('Ice')) def *= 1.5;

  let damage = Math.floor(Math.floor((Math.floor((2 * LEVEL) / 5 + 2) * power * atk) / def) / 50) + 2;
  if (move.target === 'allAdjacent' || move.target === 'allAdjacentFoes') damage *= 0.75;
  if (field.weather === 'rain') damage *= type === 'Water' ? 1.5 : type === 'Fire' ? 0.5 : 1;
  if (field.weather === 'sun') damage *= type === 'Fire' ? 1.5 : type === 'Water' ? 0.5 : 1;
  if (attacker.types.includes(type)) damage *= ability === 'adaptability' ? 2 : 1.5;
  damage *= mult;
  if (item === 'lifeorb') damage *= 1.3;
  if (item === 'expertbelt' && mult > 1) damage *= 1.2;
  const berry = RESIST_BERRIES[defItem];
  if (berry === type && (mult > 1 || berry === 'Normal')) damage *= 0.5;
  if (['multiscale', 'shadowshield'].includes(toID(defender.ability)) && !attack.ignoresAbility) damage *= 0.5;

  const toPercent = (roll: number) => ((damage * roll * hits) / defender.stats.hp) * 100;
  return {...none, percent: toPercent(AVERAGE_ROLL), min: toPercent(0.85), max: toPercent(1)};
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
