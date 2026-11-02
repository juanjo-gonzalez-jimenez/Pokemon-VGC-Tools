import type {MetaPokemon, MoveTable} from '../data/types';
import {bestHit, coverPokemon} from './coverage';
import {toID} from './ids';
import {moveType} from './moves';
import type {TeamMember} from './paste';
import {attackTypes, memberSpeed, speedMatchup, type SpeedMode} from './team';
import {TYPES, type TypeName} from './typechart';

/** A move counts as part of a Pokémon's kit when at least this share of its sets run it. */
export const COMMON_MOVE_SHARE = 0.15;
/**
 * A Pokémon only counts as hitting something super effectively when at least this share of its
 * sets carry a move of that type, so a move on a third of sets doesn't count as "always there".
 */
export const RELIABLE_MOVE_SHARE = 0.5;
const WEIGHTS = {hits: 0.4, unanswered: 0.4, faster: 0.2};

export interface Threat {
  pokemon: MetaPokemon;
  /** Damaging types carried by most of its sets (RELIABLE_MOVE_SHARE). */
  attackTypes: TypeName[];
  /** Your members it hits super effectively, with the types that do it. */
  hits: Array<{label: string; types: TypeName[]}>;
  /** Your members that hit it super effectively in most of its ability scenarios. */
  answers: string[];
  /** Your members it moves before in most of its spreads. */
  fasterThan: string[];
  /** 0..1: how badly it matches up against your team. */
  severity: number;
  /** severity weighted by how common it is; used for ranking. */
  score: number;
}

/** The meta Pokémon's most common ability (decides e.g. Weather Ball's type). */
export function mainAbility(p: MetaPokemon): string {
  const abilities = Object.entries(p.forms[0]?.abilities ?? {});
  return abilities.length ? abilities.reduce((a, b) => (b[1] > a[1] ? b : a))[0] : '';
}

/**
 * Attacking types from damaging moves run on at least `minShare` of its sets. A type's share is
 * that of its most common move of the type (a conservative estimate when it has several).
 */
export function commonAttackTypes(p: MetaPokemon, moves: MoveTable, minShare = COMMON_MOVE_SHARE): TypeName[] {
  const ability = mainAbility(p);
  const types = new Set<TypeName>();
  for (const [name, share] of Object.entries(p.moves)) {
    const move = moves[toID(name)];
    if (share < minShare || !move || move.category === 'Status') continue;
    const type = moveType(move, ability) as TypeName;
    if (TYPES.includes(type)) types.add(type);
  }
  return TYPES.filter(t => types.has(t));
}

export function assessThreat(
  p: MetaPokemon,
  team: readonly TeamMember[],
  moves: MoveTable,
  mode: SpeedMode = 'normal',
): Threat {
  const types = commonAttackTypes(p, moves, RELIABLE_MOVE_SHARE);
  const hits: Threat['hits'] = [];
  const answers: string[] = [];
  const fasterThan: string[] = [];

  for (const m of team) {
    const hit = bestHit(types, m.species.types, m.ability);
    if (hit.mult > 1) hits.push({label: m.label, types: hit.bestTypes});
    if (coverPokemon(attackTypes(m), p).buckets.super >= 0.5) answers.push(m.label);
    if (speedMatchup(memberSpeed(m), p, mode).slower > 0.5) fasterThan.push(m.label);
  }

  const n = team.length || 1;
  const severity =
    WEIGHTS.hits * (hits.length / n) +
    WEIGHTS.unanswered * (1 - answers.length / n) +
    WEIGHTS.faster * (fasterThan.length / n);
  return {pokemon: p, attackTypes: types, hits, answers, fasterThan, severity, score: severity * Math.sqrt(p.usage)};
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
