/**
 * One-on-one exchange between one of your Pokémon and a meta Pokémon, from estimated damage:
 * who knocks the other out in fewer hits, and who moves first (priority, then Speed).
 */
import type {MetaPokemon, MoveData, MoveTable} from '../data/types';
import {fromMember, fromMeta} from './combatant';
import {
  estimateDamage,
  grounded,
  hitsToKO,
  movePriority,
  NO_FIELD,
  type Combatant,
  type DamageEstimate,
  type Field,
  type Weather,
} from './damage';
import {facing, redirectedBy} from './doubles';
import {toID} from './ids';
import type {TeamMember} from './paste';
import {memberSpeed, speedMatchup, type SpeedMode} from './team';

const OUTCOME_WEIGHT = 0.75;

export interface TheirThreat {
  /** Expected best damage over the moves their sets carry (% of your HP). */
  percent: number;
  /** Every damaging option with the share of sets running it (for priority and display). */
  options: Array<{estimate: DamageEstimate; share: number}>;
  /** The move behind most of that threat. */
  move: MoveData;
  estimate: DamageEstimate;
  /** Share of their sets carrying a move that likely OHKOs / 2HKOs you. */
  ohkoChance: number;
  twoHkoChance: number;
  /** Their moves were assumed (no usage data). */
  assumed: boolean;
}

export interface Duel {
  /** Your best move against it (fewest hits to KO, then priority, then damage). */
  mine: DamageEstimate | null;
  theirs: TheirThreat | null;
  myHits: number;
  theirHits: number;
  /** Probability you act first in the exchange (priority, then Speed). */
  first: number;
  /** 1 = you win the exchange, 0 = you lose it. */
  win: number;
  /** 0..1 score: mostly the outcome, partly the damage margin. */
  total: number;
}

const SPEED_ABILITY: Record<string, Weather> = {swiftswim: 'rain', chlorophyll: 'sun', sandrush: 'sand', slushrush: 'snow'};
export const weatherSpeedFactor = (ability: string, field: Field) =>
  field.weather && SPEED_ABILITY[toID(ability)] === field.weather ? 2 : 1;

/** Their moves with the share of sets running each; assumed 80 BP STAB moves when there's no data. */
export function theirMoves(opp: MetaPokemon, attacker: Combatant, moves: MoveTable): {list: Array<[MoveData, number]>; assumed: boolean} {
  const list: Array<[MoveData, number]> = [];
  for (const [name, share] of Object.entries(opp.moves)) {
    const move = moves[toID(name)];
    if (move && move.category !== 'Status') list.push([move, share]);
  }
  if (list.length) return {list, assumed: false};
  const category = attacker.stats.atk >= attacker.stats.spa ? 'Physical' : 'Special';
  const assumed = attacker.types.map<[MoveData, number]>(type => [
    {name: `${type} attack (assumed)`, type, category, basePower: 80, target: 'normal', priority: 0},
    1,
  ]);
  return {list: assumed, assumed: true};
}

/**
 * The threat of a move pool where each move appears on a share of sets: the expected best
 * damage, treating moves as independent (`Σ dᵢ·sᵢ·Π(1−sⱼ)` over moves sorted by damage).
 */
export function expectedThreat(options: Array<{estimate: DamageEstimate; share: number}>): Omit<TheirThreat, 'assumed' | 'options'> | null {
  const sorted = options.filter(o => o.estimate.percent > 0).sort((a, b) => b.estimate.percent - a.estimate.percent);
  if (!sorted.length) return null;
  let percent = 0;
  let none = 1;
  let main = sorted[0];
  let mainWeight = 0;
  let noOhko = 1;
  let no2hko = 1;
  for (const o of sorted) {
    const share = Math.min(1, o.share);
    const weight = share * none;
    percent += o.estimate.percent * weight;
    if (weight > mainWeight) {
      main = o;
      mainWeight = weight;
    }
    none *= 1 - share;
    if (hitsToKO(o.estimate.percent) <= 1) noOhko *= 1 - share;
    if (hitsToKO(o.estimate.percent) <= 2) no2hko *= 1 - share;
  }
  return {percent, move: main.estimate.move, estimate: main.estimate, ohkoChance: 1 - noOhko, twoHkoChance: 1 - no2hko};
}

const PRIORITY_BLOCKERS = ['armortail', 'dazzling', 'queenlymajesty'];

/**
 * A priority move that fails against this target: grounded targets in Psychic Terrain, or a
 * target with Armor Tail / Dazzling / Queenly Majesty.
 */
export function priorityBlocked(e: DamageEstimate, target: Combatant, field: Field): boolean {
  if (e.priority <= 0) return false;
  return (field.terrain === 'psychic' && grounded(target)) || PRIORITY_BLOCKERS.includes(toID(target.ability));
}

/** Your best option: fewest hits to KO, then higher priority, then more damage. */
export function bestOption(estimates: ReadonlyArray<DamageEstimate | null>): DamageEstimate | null {
  let best: DamageEstimate | null = null;
  for (const e of estimates) {
    if (!e || e.percent <= 0) continue;
    if (
      !best ||
      hitsToKO(e.percent) < hitsToKO(best.percent) ||
      (hitsToKO(e.percent) === hitsToKO(best.percent) &&
        (e.priority > best.priority || (e.priority === best.priority && e.percent > best.percent)))
    ) {
      best = e;
    }
  }
  return best;
}

/**
 * Probability of each priority bracket their side acts in: the highest-priority move their set
 * carries among those that still KO in `theirHits` hits (moves independent, by share). Falls back
 * to the main threat's priority when no carried move qualifies.
 */
export function theirPriorityBrackets(
  theirs: Pick<TheirThreat, 'options' | 'move'>,
  theirHits: number,
  attacker: Combatant,
  field: Field,
): Array<[priority: number, probability: number]> {
  const fallback = movePriority(theirs.move, attacker, field);
  const qualifying = theirs.options
    .filter(o => hitsToKO(o.estimate.percent) <= theirHits)
    .map(o => ({priority: movePriority(o.estimate.move, attacker, field), share: Math.min(1, o.share)}))
    .sort((a, b) => b.priority - a.priority);
  const out = new Map<number, number>();
  let none = 1;
  for (const q of qualifying) {
    out.set(q.priority, (out.get(q.priority) ?? 0) + q.share * none);
    none *= 1 - q.share;
  }
  if (none > 0) out.set(fallback, (out.get(fallback) ?? 0) + none);
  return [...out];
}

export interface DuelOptions {
  /**
   * Types their single-target attacks can't bring to bear on you: a partner of yours with
   * Lightning Rod (Electric) or Storm Drain (Water) draws them in.
   */
  redirected?: readonly string[];
}

export function duel(
  member: TeamMember,
  opp: MetaPokemon,
  moves: MoveTable,
  field: Field = NO_FIELD,
  mode: SpeedMode = 'normal',
  duelOptions: DuelOptions = {},
): Duel {
  // Intimidate on either side lowers the other's Attack before anything is computed.
  const [me, them] = facing(fromMember(member), fromMeta(opp));
  const mine = bestOption(
    member.moves.map(m => {
      const e = estimateDamage(me, them, m, field);
      return e && !priorityBlocked(e, them, field) ? e : null;
    }),
  );
  const pool = theirMoves(opp, them, moves);
  const options = pool.list.flatMap(([move, share]) => {
    const estimate = estimateDamage(them, me, move, field);
    if (!estimate || estimate.percent <= 0 || priorityBlocked(estimate, me, field)) return [];
    if (duelOptions.redirected?.some(type => redirectedBy(estimate, type))) return [];
    return [{estimate, share}];
  });
  const threat = expectedThreat(options);
  const theirs = threat && {...threat, options, assumed: pool.assumed};

  const myHits = hitsToKO(mine?.percent ?? 0);
  const theirHits = hitsToKO(theirs?.percent ?? 0);

  // Order: the higher priority bracket goes first; within a bracket, Speed (Trick Room aware).
  // Both sides may use a priority move that still KOs in as few hits; theirs count by the share
  // of sets that run them.
  const myPriority = mine?.priority ?? 0;
  const speedFirst = () => {
    if (!Object.keys(opp.speeds).length) return 0.5;
    const race = speedMatchup(memberSpeed(member) * weatherSpeedFactor(me.ability, field), opp, mode, weatherSpeedFactor(them.ability, field));
    return race.faster + race.tie * 0.5;
  };
  const versus = (theirPriority: number) =>
    myPriority > theirPriority ? 1 : myPriority < theirPriority ? 0 : speedFirst();
  let first: number;
  if (!theirs) first = versus(0);
  else {
    const brackets = theirPriorityBrackets(theirs, theirHits, them, field);
    first = brackets.reduce((sum, [priority, p]) => sum + p * versus(priority), 0);
  }
  const win = myHits === Infinity && theirHits === Infinity ? 0.5 : myHits < theirHits ? 1 : myHits > theirHits ? 0 : first;
  const margin = Math.max(-1, Math.min(1, ((mine?.percent ?? 0) - (theirs?.percent ?? 0)) / 100));
  return {mine, theirs, myHits, theirHits, first, win, total: OUTCOME_WEIGHT * win + (1 - OUTCOME_WEIGHT) * ((margin + 1) / 2)};
}
