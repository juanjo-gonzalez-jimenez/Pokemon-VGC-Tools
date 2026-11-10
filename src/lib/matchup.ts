/**
 * Team-preview helper: how each of your Pokémon fares against each of the opponent's, and which
 * four to bring (two leads, two in the back). A heuristic over types, abilities, Speed and
 * common VGC roles; it does not calculate damage.
 */
import type {MetaPokemon, MoveTable} from '../data/types';
import {bestHit, coverPokemon} from './coverage';
import {toID} from './ids';
import type {TeamMember} from './paste';
import {teamRoles} from './roles';
import {memberAttacks, memberSpeed, speedMatchup, type SpeedMode} from './team';
import {commonAttacks, RELIABLE_MOVE_SHARE} from './threats';
import type {TypeName} from './typechart';

const PAIR_WEIGHTS = {offence: 0.4, defence: 0.4, speed: 0.2};
const LINEUP_WEIGHTS = {answers: 0.6, leads: 0.4};
const ANSWER_WEIGHTS = {bestTwo: 0.6, everyone: 0.4};
const BONUS = {fakeOut: 0.03, intimidate: 0.02, speedControl: 0.03, spread: 0.02, redirection: 0.02};
const SHARED_WEAKNESS_PENALTY = 0.03;
const MAX_SHARED_WEAKNESSES = 3;
export const BRING = 4;

export interface PairScore {
  /** Best multiplier your moves get on it (its most likely ability) and the types that do it. */
  myMult: number;
  myTypes: TypeName[];
  /** Best multiplier its common moves get on you. */
  theirMult: number;
  theirTypes: TypeName[];
  /** Share of its sets you move before (null when it has no Speed data). */
  faster: number | null;
  /** 0..1 parts and the weighted total; above 0.5 favours you. */
  offence: number;
  defence: number;
  speed: number;
  total: number;
}

/** How safe you are against a hit of this multiplier (1 = takes nothing, 0 = takes 4×). */
function safety(mult: number): number {
  if (mult >= 4) return 0;
  if (mult >= 2) return 0.2;
  if (mult >= 1) return 0.6;
  if (mult > 0) return 0.9;
  return 1;
}

export function pairScore(member: TeamMember, opp: MetaPokemon, moves: MoveTable, mode: SpeedMode = 'normal'): PairScore {
  const mine = coverPokemon(memberAttacks(member), opp);
  const offence = mine.buckets.super + mine.buckets.neutral * 0.5 + mine.buckets.resisted * 0.15;

  const theirAttacks = commonAttacks(opp, moves, RELIABLE_MOVE_SHARE);
  const theirs = bestHit(theirAttacks, member.species.types, member.ability);
  // Without move data, assume it can at least hit neutrally.
  const defence = theirAttacks.length ? safety(theirs.mult) : safety(1);

  const hasSpeeds = Object.keys(opp.speeds).length > 0;
  const race = speedMatchup(memberSpeed(member), opp, mode);
  const speed = hasSpeeds ? race.faster + race.tie * 0.5 : 0.5;

  return {
    myMult: mine.main.mult,
    myTypes: mine.main.bestTypes,
    theirMult: theirAttacks.length ? theirs.mult : 1,
    theirTypes: theirs.bestTypes,
    faster: hasSpeeds ? race.faster : null,
    offence,
    defence,
    speed,
    total: PAIR_WEIGHTS.offence * offence + PAIR_WEIGHTS.defence * defence + PAIR_WEIGHTS.speed * speed,
  };
}

/** grid[i][j]: your member i against their Pokémon j. */
export function matchupGrid(
  team: readonly TeamMember[],
  opponents: readonly MetaPokemon[],
  moves: MoveTable,
  mode: SpeedMode = 'normal',
): PairScore[][] {
  return team.map(m => opponents.map(o => pairScore(m, o, moves, mode)));
}

export interface Lineup {
  leads: TeamMember[];
  back: TeamMember[];
  bench: TeamMember[];
  /** Roughly 0..1; higher is better. */
  score: number;
  reasons: string[];
  warnings: string[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, size - 1).map(c => [first, ...c]), ...combinations(rest, size)];
}

/** True when most of its common damaging moves are physical. */
function isPhysical(opp: MetaPokemon, moves: MoveTable): boolean {
  let physical = 0;
  let special = 0;
  for (const [name, share] of Object.entries(opp.moves)) {
    const move = moves[toID(name)];
    if (share < RELIABLE_MOVE_SHARE || !move) continue;
    if (move.category === 'Physical') physical++;
    if (move.category === 'Special') special++;
  }
  return physical > special;
}

const names = (list: string[], max = 3) => (list.length > max ? `${list.slice(0, max).join(', ')}…` : list.join(', '));

/**
 * The best ways to bring four of your Pokémon against the opponent's six: one entry per group of
 * four (with its best pair of leads), best first.
 */
export function suggestBrings(
  team: readonly TeamMember[],
  opponents: readonly MetaPokemon[],
  moves: MoveTable,
  mode: SpeedMode = 'normal',
  limit = 3,
): Lineup[] {
  if (!team.length || !opponents.length) return [];
  const index = new Map(team.map((m, i) => [m, i]));
  const grid = matchupGrid(team, opponents, moves, mode);
  const score = (m: TeamMember, j: number) => grid[index.get(m)!][j];
  const physicalHeavy = opponents.filter(o => isPhysical(o, moves)).length >= opponents.length / 2;

  const lineups: Lineup[] = [];
  for (const four of combinations(team, Math.min(BRING, team.length))) {
    // Against each of their Pokémon: mostly "do we have two good answers", but the other two
    // count as well, so nobody in the back is a liability.
    const answers = mean(
      opponents.map((_, j) => {
        const totals = four.map(m => score(m, j).total).sort((a, b) => b - a);
        return ANSWER_WEIGHTS.bestTwo * mean(totals.slice(0, 2)) + ANSWER_WEIGHTS.everyone * mean(totals);
      }),
    );
    const roles = Object.fromEntries(teamRoles(four).map(r => [r.role, r.members]));
    const fourReasons: string[] = [];
    const warnings: string[] = [];
    let fourBonus = 0;
    if (roles['Speed control']?.length) {
      fourBonus += BONUS.speedControl;
      fourReasons.push(`Speed control from ${names(roles['Speed control'])}`);
    }
    if (physicalHeavy && roles['Intimidate']?.length) {
      fourBonus += BONUS.intimidate;
      fourReasons.push(`Intimidate from ${names(roles['Intimidate'])} against their mostly physical team`);
    }
    if (roles['Redirection']?.length) {
      fourBonus += BONUS.redirection;
      fourReasons.push(`Redirection from ${names(roles['Redirection'])}`);
    }
    const shared = opponents
      .map((o, j) => ({name: o.name, weak: four.filter(m => score(m, j).theirMult > 1).length}))
      .filter(x => x.weak >= 3)
      .slice(0, MAX_SHARED_WEAKNESSES);
    for (const s of shared) warnings.push(`${s.weak} of these four are weak to ${s.name}'s common moves`);
    const penalty = shared.length * SHARED_WEAKNESS_PENALTY;

    const bench = team.filter(m => !four.includes(m));
    for (const m of bench) {
      const threats = opponents.filter((_, j) => score(m, j).theirMult > 1).map(o => o.name);
      fourReasons.push(
        threats.length ? `${m.label} stays out: weak to ${names(threats)}` : `${m.label} stays out: fewest good matchups`,
      );
    }

    let best: Lineup | null = null;
    for (const leads of combinations(four, Math.min(2, four.length))) {
      const leadQuality = mean(leads.map(m => mean(opponents.map((_, j) => score(m, j).total))));
      const reasons: string[] = [];
      let bonus = fourBonus;
      const fakeOut = leads.filter(m => roles['Fake Out']?.includes(m.label));
      if (fakeOut.length) {
        bonus += BONUS.fakeOut;
        reasons.push(`Fake Out pressure from ${names(fakeOut.map(m => m.label))}`);
      }
      const spread = leads.filter(m => roles['Spread damage']?.includes(m.label));
      if (spread.length) {
        bonus += BONUS.spread;
        reasons.push(`Spread damage from ${names(spread.map(m => m.label))}`);
      }
      for (const m of leads) {
        const hits = opponents.filter((_, j) => score(m, j).myMult > 1).map(o => o.name);
        const faster = opponents.filter((_, j) => (score(m, j).faster ?? 0) > 0.5).length;
        const parts = [
          hits.length ? `hits ${names(hits)} super effectively` : '',
          `moves before ${faster} of their ${opponents.length}`,
        ].filter(Boolean);
        reasons.unshift(`${m.label} ${parts.join(' and ')}`);
      }
      const total = LINEUP_WEIGHTS.answers * answers + LINEUP_WEIGHTS.leads * leadQuality + bonus - penalty;
      if (!best || total > best.score) {
        best = {
          leads,
          back: four.filter(m => !leads.includes(m)),
          bench,
          score: total,
          reasons: [...reasons, ...fourReasons],
          warnings,
        };
      }
    }
    if (best) lineups.push(best);
  }
  return lineups.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Mega forms are the same species at team preview: the base entry plus its Megas, most used first. */
export function previewForms(pokemon: MetaPokemon, dex: readonly MetaPokemon[]): MetaPokemon[] {
  const isMega = (p: MetaPokemon) => /-Mega(-|$)/.test(p.name);
  const baseId = isMega(pokemon) ? pokemon.baseSprite : pokemon.id;
  const forms = dex.filter(p => p.id === baseId || (isMega(p) && p.baseSprite === baseId));
  // Usage is only comparable within the same data source, so cutoff data ranks first.
  const rank = (p: MetaPokemon) => (p.source ? 0 : 1);
  return forms.sort((a, b) => rank(b) - rank(a) || b.usage - a.usage);
}
