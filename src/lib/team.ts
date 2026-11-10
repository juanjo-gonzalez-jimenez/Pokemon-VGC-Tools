import type {MetaPokemon} from '../data/types';
import {bestHit} from './coverage';
import type {TeamMember} from './paste';
import {attackOf, typesOf, uniqueAttacks, type Attack} from './attack';
import {calcStat} from './stats';
import {TYPES, type TypeName} from './typechart';

const SCARF = 'Choice Scarf';

// ---------------------------------------------------------------- defence

export interface DefensiveRow {
  type: TypeName;
  /** Multiplier the attacking type deals to each member, in team order. */
  mults: number[];
  weak: number;
  resist: number;
  immune: number;
  /** Several members weak and almost nothing to switch into it. */
  shared: boolean;
}

export function defensiveChart(team: readonly TeamMember[]): DefensiveRow[] {
  return TYPES.map(type => {
    const mults = team.map(m => bestHit([type], m.species.types, m.ability).mult);
    const weak = mults.filter(x => x > 1).length;
    const resist = mults.filter(x => x > 0 && x < 1).length;
    const immune = mults.filter(x => x === 0).length;
    return {type, mults, weak, resist, immune, shared: weak >= 3 && resist + immune <= 1};
  });
}

// ---------------------------------------------------------------- offence

/** The member's distinct attacks: damaging moves with its ability's effects (Pixilate, Mold Breaker…). */
export function memberAttacks(member: TeamMember): Attack[] {
  return uniqueAttacks(member.moves.map(m => attackOf(m, member.ability)));
}

/** Distinct types of the member's damaging moves. */
export function attackTypes(member: TeamMember): TypeName[] {
  return typesOf(memberAttacks(member));
}

/** Distinct attacking types across the whole team, in type-chart order. */
export function teamAttackTypes(team: readonly TeamMember[]): TypeName[] {
  const all = new Set(team.flatMap(attackTypes));
  return TYPES.filter(t => all.has(t));
}

// ---------------------------------------------------------------- speed

export function memberSpeed(member: TeamMember): number {
  const speed = calcStat('spe', member.species.baseStats.spe, member.sp.spe, member.nature);
  return member.item === SCARF ? Math.floor(speed * 1.5) : speed;
}

/**
 * The meta Pokémon's Speed distribution, with Choice Scarf applied to the share of sets
 * that hold it (items and spreads are assumed independent).
 */
export function metaSpeeds(p: MetaPokemon): Array<[speed: number, share: number]> {
  const scarf = p.items[SCARF] ?? 0;
  const out = new Map<number, number>();
  const add = (speed: number, share: number) => share > 0 && out.set(speed, (out.get(speed) ?? 0) + share);
  for (const [s, share] of Object.entries(p.speeds)) {
    add(Number(s), share * (1 - scarf));
    add(Math.floor(Number(s) * 1.5), share * scarf);
  }
  return [...out].sort((a, b) => b[0] - a[0]);
}

/** Speed-control situation: Tailwind doubles one side's Speed; Trick Room makes slower move first. */
export type SpeedMode = 'normal' | 'myTailwind' | 'theirTailwind' | 'trickRoom';

/** Your effective Speed under the mode. */
export const mySpeedIn = (speed: number, mode: SpeedMode) => (mode === 'myTailwind' ? speed * 2 : speed);
/** An opponent's effective Speed under the mode. */
export const theirSpeedIn = (speed: number, mode: SpeedMode) => (mode === 'theirTailwind' ? speed * 2 : speed);

export interface SpeedMatchup {
  /** Share of the opponent's sets you move before / tie with / move after. */
  faster: number;
  tie: number;
  slower: number;
}

export function speedMatchup(speed: number, p: MetaPokemon, mode: SpeedMode = 'normal'): SpeedMatchup {
  const r: SpeedMatchup = {faster: 0, tie: 0, slower: 0};
  const mine = mySpeedIn(speed, mode);
  for (const [s, share] of metaSpeeds(p)) {
    const theirs = theirSpeedIn(s, mode);
    if (mine === theirs) r.tie += share;
    else if (mode === 'trickRoom' ? mine < theirs : mine > theirs) r.faster += share;
    else r.slower += share;
  }
  return r;
}

export interface MemberSpeed {
  member: TeamMember;
  /** Speed stat (Choice Scarf included). */
  speed: number;
  /** Speed under the current mode (doubled under your Tailwind). */
  effective: number;
  /** Share of the meta (weighted or not) this member moves before. */
  outspeeds: number;
}

export function teamSpeeds(
  team: readonly TeamMember[],
  roster: readonly MetaPokemon[],
  weighted: boolean,
  mode: SpeedMode = 'normal',
): MemberSpeed[] {
  return team.map(member => {
    const speed = memberSpeed(member);
    let total = 0;
    let faster = 0;
    for (const p of roster) {
      const w = weighted ? p.usage : 1;
      total += w;
      faster += speedMatchup(speed, p, mode).faster * w;
    }
    return {member, speed, effective: mySpeedIn(speed, mode), outspeeds: total ? faster / total : 0};
  });
}

export interface MetaSpeedSummary {
  pokemon: MetaPokemon;
  /** Most common Speed (including Scarf sets). */
  common: number;
  /** Slowest and fastest common Speeds, without Choice Scarf. */
  min: number;
  max: number;
  /** Share of sets holding Choice Scarf. */
  scarf: number;
  /** The same range with Choice Scarf applied. */
  scarfMin: number;
  scarfMax: number;
}

const scarfed = (speed: number) => Math.floor(speed * 1.5);

export function metaSpeedSummary(p: MetaPokemon): MetaSpeedSummary {
  const scarf = p.items[SCARF] ?? 0;
  const raw = Object.keys(p.speeds).map(Number);
  if (!raw.length) raw.push(calcStat('spe', p.baseStats.spe, 0));
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const speeds = metaSpeeds(p);
  const common = speeds.length ? speeds.reduce((a, b) => (b[1] > a[1] ? b : a))[0] : min;
  return {pokemon: p, common, min, max, scarf, scarfMin: scarfed(min), scarfMax: scarfed(max)};
}
