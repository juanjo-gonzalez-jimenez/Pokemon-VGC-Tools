import type {MetaPokemon, MoveTable} from '../data/types';
import {attackOf, typesOf, uniqueAttacks, type Attack} from './attack';
import {mainAbility} from './combatant';
import {duel} from './exchange';
import {resolveField, type FieldContext} from './field';
import {toID} from './ids';
import type {TeamMember} from './paste';
import type {SpeedMode} from './team';
import type {TypeName} from './typechart';

/** A move counts as part of a Pokémon's kit when at least this share of its sets run it. */
export const COMMON_MOVE_SHARE = 0.15;
/**
 * Share of sets a move needs to count as part of the usual kit for type-level summaries
 * (`attackTypes`) and the "mostly physical" check; damage threats weight every move by share instead.
 */
export const RELIABLE_MOVE_SHARE = 0.5;
const WEIGHTS = {hits: 0.4, unanswered: 0.4, faster: 0.2};

/** It threatens a member when its expected best hit KOs that member in this many hits or fewer. */
export const THREAT_HITS = 2;

export interface Threat {
  pokemon: MetaPokemon;
  /** Damaging types carried by most of its sets (RELIABLE_MOVE_SHARE). */
  attackTypes: TypeName[];
  /** Your members it likely OHKOs or 2HKOs, with the move behind it and the estimate. */
  hits: Array<{label: string; move: string; percent: number; hitsToKO: number}>;
  /** Your members that win the one-on-one against it. */
  answers: string[];
  /** Your members it acts before (priority, then Speed). */
  fasterThan: string[];
  /** 0..1: how badly it matches up against your team. */
  severity: number;
  /** severity weighted by how common it is; used for ranking. */
  score: number;
}

export {mainAbility} from './combatant';

/**
 * Attacking types from damaging moves run on at least `minShare` of its sets. A type's share is
 * that of its most common move of the type (a conservative estimate when it has several).
 */
export function commonAttacks(p: MetaPokemon, moves: MoveTable, minShare = COMMON_MOVE_SHARE): Attack[] {
  const ability = mainAbility(p);
  return uniqueAttacks(
    Object.entries(p.moves).map(([name, share]) => {
      const move = moves[toID(name)];
      return share >= minShare && move ? attackOf(move, ability) : null;
    }),
  );
}

/** Types of commonAttacks(). */
export function commonAttackTypes(p: MetaPokemon, moves: MoveTable, minShare = COMMON_MOVE_SHARE): TypeName[] {
  return typesOf(commonAttacks(p, moves, minShare));
}

/**
 * How dangerous a meta Pokémon is to your team, from estimated damage: whom it likely 2HKOs (or
 * better), who wins the one-on-one against it, and whom it acts before. `ctx` sets the field
 * (Matchup tab); without it, weather and terrain come only from the two Pokémon involved.
 */
export function assessThreat(
  p: MetaPokemon,
  team: readonly TeamMember[],
  moves: MoveTable,
  mode: SpeedMode = 'normal',
  ctx?: FieldContext,
): Threat {
  const hits: Threat['hits'] = [];
  const answers: string[] = [];
  const fasterThan: string[] = [];

  for (const m of team) {
    const d = duel(m, p, moves, resolveField(m.ability, mainAbility(p), ctx), mode);
    if (d.theirs && d.theirHits <= THREAT_HITS) {
      hits.push({label: m.label, move: d.theirs.move.name, percent: d.theirs.percent, hitsToKO: d.theirHits});
    }
    if (d.win > 0.5) answers.push(m.label);
    if (d.first < 0.5) fasterThan.push(m.label);
  }
  hits.sort((a, b) => a.hitsToKO - b.hitsToKO || b.percent - a.percent);
  const attacks = commonAttacks(p, moves, RELIABLE_MOVE_SHARE);

  const n = team.length || 1;
  const severity =
    WEIGHTS.hits * (hits.length / n) +
    WEIGHTS.unanswered * (1 - answers.length / n) +
    WEIGHTS.faster * (fasterThan.length / n);
  return {pokemon: p, attackTypes: typesOf(attacks), hits, answers, fasterThan, severity, score: severity * Math.sqrt(p.usage)};
}

/** The meta Pokémon the team struggles with most, worst first. */
export function threatList(
  team: readonly TeamMember[],
  roster: readonly MetaPokemon[],
  moves: MoveTable,
  mode: SpeedMode = 'normal',
  limit = 10,
): Threat[] {
  if (!team.length) return [];
  return roster
    .map(p => assessThreat(p, team, moves, mode))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
