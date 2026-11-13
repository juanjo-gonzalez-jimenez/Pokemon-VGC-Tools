/**
 * Doubles effects on top of the one-on-one damage model: Intimidate, Lightning Rod / Storm Drain
 * redirection, and spread moves hitting both foes (and the partner).
 */
import type {MoveData} from '../data/types';
import type {Combatant, DamageEstimate} from './damage';
import {toID} from './ids';

type Boosts = NonNullable<Combatant['boosts']>;

const INTIMIDATE_IMMUNE = ['clearbody', 'whitesmoke', 'fullmetalbody', 'hypercutter', 'innerfocus', 'oblivious', 'owntempo', 'scrappy'];

const clamp = (n: number) => Math.max(-6, Math.min(6, n));
const boosted = (c: Combatant, change: Boosts): Combatant => {
  const boosts: Boosts = {...c.boosts};
  for (const [stat, n] of Object.entries(change) as Array<[keyof Boosts, number]>) boosts[stat] = clamp((boosts[stat] ?? 0) + n);
  return {...c, boosts};
};

export const hasIntimidate = (c: Pick<Combatant, 'ability'>) => toID(c.ability) === 'intimidate';

/**
 * `target` hit by `user`'s Intimidate, as [user, target] afterwards. Clear Body and similar
 * abilities (and Clear Amulet) block it, Guard Dog raises Attack instead, Defiant and Competitive
 * answer with +2, and Mirror Armor sends the drop back to the user.
 */
export function intimidate(user: Combatant, target: Combatant): [Combatant, Combatant] {
  const ability = toID(target.ability);
  if (ability === 'mirrorarmor') return [dropAttack(user), target];
  return [user, dropAttack(target, ability === 'guarddog')];
}

function dropAttack(c: Combatant, guardDog = false): Combatant {
  const ability = toID(c.ability);
  if (guardDog) return boosted(c, {atk: 1});
  if (INTIMIDATE_IMMUNE.includes(ability) || toID(c.item) === 'clearamulet') return c;
  if (ability === 'defiant') return boosted(c, {atk: 1});
  if (ability === 'competitive') return boosted(c, {atk: -1, spa: 2});
  return boosted(c, {atk: -1});
}

/** One of your Pokémon and one of theirs as they face each other, Intimidate applied both ways. */
export function facing(me: Combatant, them: Combatant): [Combatant, Combatant] {
  let [a, b] = [me, them];
  if (hasIntimidate(a)) [a, b] = intimidate(a, b);
  if (hasIntimidate(b)) [b, a] = intimidate(b, a);
  return [a, b];
}

// ---------------------------------------------------------------- redirection

const REDIRECTORS: Record<string, string> = {lightningrod: 'Electric', stormdrain: 'Water'};
/** Move targets that pick one Pokémon, and so can be redirected. */
const SINGLE_TARGETS = ['normal', 'any', 'adjacentFoe'];

/** The type a Pokémon's ability draws in ('' when none). */
export const redirectType = (ability: string) => REDIRECTORS[toID(ability)] ?? '';

export const singleTarget = (move: MoveData) => SINGLE_TARGETS.includes(move.target);
export const isSpread = (move: MoveData) => move.target === 'allAdjacentFoes' || move.target === 'allAdjacent';
export const hitsPartner = (move: MoveData) => move.target === 'allAdjacent';

/** An attack that a redirector of type `type` pulls away from its intended target. */
export const redirectedBy = (e: DamageEstimate, type: string) => Boolean(type) && singleTarget(e.move) && e.type === type;
