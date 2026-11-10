import type {MoveData} from '../data/types';
import {toID} from './ids';
import {moveType} from './moves';
import {effectiveness, isType, TYPES, type TypeName} from './typechart';

/**
 * One way of attacking: a type plus whatever makes this hit break the plain type chart, coming
 * from the move (Freeze-Dry, Flying Press) or the attacker's ability (Mold Breaker, Scrappy,
 * Tinted Lens). A bare type name is the simplest attack.
 */
export interface Attack {
  type: TypeName;
  /** Mold Breaker, Teravolt, Turboblaze: the defender's ability doesn't apply. */
  ignoresAbility?: true;
  /** Scrappy, Mind's Eye: Normal and Fighting moves hit Ghost types. */
  hitsGhost?: true;
  /** Tinted Lens: resisted hits deal double. */
  tintedLens?: true;
  /** Freeze-Dry: super effective on Water. */
  freezeDry?: true;
  /** Flying Press: this type's matchup is multiplied in as well. */
  secondType?: TypeName;
}

export type AttackLike = TypeName | Attack;
export const asAttack = (a: AttackLike): Attack => (typeof a === 'string' ? {type: a} : a);

const IGNORE_ABILITY = ['moldbreaker', 'teravolt', 'turboblaze'];
const HIT_GHOST = ['scrappy', 'mindseye'];

/** The attack a damaging move makes when used by a Pokémon with `ability`; null for status moves. */
export function attackOf(move: MoveData, ability: string): Attack | null {
  if (move.category === 'Status') return null;
  const type = moveType(move, ability);
  if (!isType(type)) return null;
  const id = toID(move.name);
  const ab = toID(ability);
  const attack: Attack = {type};
  if (IGNORE_ABILITY.includes(ab)) attack.ignoresAbility = true;
  if (HIT_GHOST.includes(ab) && (type === 'Normal' || type === 'Fighting')) attack.hitsGhost = true;
  if (ab === 'tintedlens') attack.tintedLens = true;
  if (id === 'freezedry') attack.freezeDry = true;
  if (id === 'flyingpress') attack.secondType = 'Flying';
  return attack;
}

const key = (a: Attack) =>
  [a.type, a.ignoresAbility, a.hitsGhost, a.tintedLens, a.freezeDry, a.secondType].map(v => v ?? '').join('|');

/** Distinct attacks, in type-chart order. */
export function uniqueAttacks(attacks: ReadonlyArray<Attack | null>): Attack[] {
  const seen = new Map<string, Attack>();
  for (const a of attacks) if (a && !seen.has(key(a))) seen.set(key(a), a);
  return [...seen.values()].sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type));
}

/** Distinct types of a list of attacks, in type-chart order. */
export function typesOf(attacks: readonly AttackLike[]): TypeName[] {
  const types = new Set(attacks.map(a => asAttack(a).type));
  return TYPES.filter(t => types.has(t));
}

/** Type-chart multiplier of an attack against a typing, before the defender's ability. */
export function attackMultiplier(attack: Attack, defense: readonly string[]): number {
  let mult = 1;
  for (const def of defense) {
    if (!isType(def)) continue;
    let m = effectiveness(attack.type, [def]);
    if (attack.freezeDry && def === 'Water') m = 2;
    if (attack.hitsGhost && def === 'Ghost') m = 1;
    if (attack.secondType) m *= effectiveness(attack.secondType, [def]);
    mult *= m;
  }
  return mult;
}
