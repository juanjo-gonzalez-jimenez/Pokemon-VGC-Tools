/**
 * Team-preview helper: how each of your Pokémon fares against each of the opponent's, and which
 * four to bring (two leads, two in the back). Each pairing is scored from estimated damage
 * (src/lib/damage.ts): who knocks the other out in fewer hits, and who moves first. Line-ups add
 * common VGC roles on top. Estimates, not exact calculations.
 */
import type {MetaPokemon, MoveTable} from '../data/types';
import type {Field} from './damage';
import {mainAbility} from './combatant';
import {duel, type Duel} from './exchange';
import {fieldOf, resolveField, type FieldChoice, type FieldContext} from './field';
import {toID} from './ids';
import {withoutMega, type TeamMember} from './paste';
import {teamRoles} from './roles';
import type {SpeedMode} from './team';
import {RELIABLE_MOVE_SHARE} from './threats';

const LINEUP_WEIGHTS = {answers: 0.6, leads: 0.4};
const ANSWER_WEIGHTS = {bestTwo: 0.6, everyone: 0.4};
const BONUS = {fakeOut: 0.03, intimidate: 0.02, speedControl: 0.03, spread: 0.02, redirection: 0.02};
const SHARED_WEAKNESS_PENALTY = 0.03;
const MAX_SHARED_WEAKNESSES = 3;
export const BRING = 4;

/** Short description of what Auto picks for a whole matchup, e.g. "Rain (Pelipper's Drizzle)". */
export function describeAutoField(team: readonly TeamMember[], opponents: readonly MetaPokemon[]): string {
  const parts: string[] = [];
  const setterOf = (field: 'weather' | 'terrain') => {
    for (const o of opponents) {
      const f = fieldOf([mainAbility(o)]);
      if (f[field]) return `${f[field]} from ${o.name} (their ${mainAbility(o)})`;
    }
    for (const m of team) {
      const f = fieldOf([m.ability]);
      if (f[field]) return `${f[field]} from your ${m.label} (${m.ability})`;
    }
    return '';
  };
  for (const f of ['weather', 'terrain'] as const) {
    const s = setterOf(f);
    if (s) parts.push(s);
  }
  return parts.length ? parts.join('; ') : 'no weather or terrain';
}

// ---------------------------------------------------------------- pairs

/** One of your Pokémon against one of theirs. `total` above 0.5 favours you. */
export interface PairScore extends Duel {
  field: Field;
}

export function pairScore(
  member: TeamMember,
  opp: MetaPokemon,
  moves: MoveTable,
  mode: SpeedMode = 'normal',
  ctx?: FieldContext,
): PairScore {
  const field = resolveField(member.ability, mainAbility(opp), ctx);
  return {...duel(member, opp, moves, field, mode), field};
}

/** "~85%" style label for an estimated percentage. */
export const approx = (percent: number) => `~${Math.round(percent)}%`;

/** grid[i][j]: your member i against their Pokémon j. */
export function matchupGrid(
  team: readonly TeamMember[],
  opponents: readonly MetaPokemon[],
  moves: MoveTable,
  mode: SpeedMode = 'normal',
  choice: FieldChoice = 'auto',
): PairScore[][] {
  const ctx: FieldContext = {choice, theirs: opponents.map(mainAbility), yours: team.map(m => m.ability)};
  return team.map(m => opponents.map(o => pairScore(m, o, moves, mode, ctx)));
}

export interface Lineup {
  /** The four brought, as they fight: only `mega` is in Mega form, other stone holders aren't. */
  leads: TeamMember[];
  back: TeamMember[];
  bench: TeamMember[];
  /** The one Pokémon that Mega Evolves, if any of the four can. */
  mega: TeamMember | null;
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

/** "Rillaboom: Grassy Glide (priority) likely OHKOs Swampert-Mega; wins 5 of 6 one-on-ones". */
function leadReason(m: TeamMember, opponents: readonly MetaPokemon[], score: (j: number) => PairScore): string {
  const kos = new Map<string, string[]>();
  opponents.forEach((o, j) => {
    const s = score(j);
    if (!s.mine || s.myHits > 1) return;
    const move = s.mine.priority > 0 ? `${s.mine.move.name} (priority)` : s.mine.move.name;
    kos.set(move, [...(kos.get(move) ?? []), o.name]);
  });
  const wins = opponents.filter((_, j) => score(j).win > 0.5).length;
  const parts = [...kos].map(([move, targets]) => `${move} likely OHKOs ${names(targets)}`);
  parts.push(`wins ${wins} of ${opponents.length} one-on-ones`);
  return `${m.label}: ${parts.join('; ')}`;
}

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
  choice: FieldChoice = 'auto',
): Lineup[] {
  if (!team.length || !opponents.length) return [];
  const grid = matchupGrid(team, opponents, moves, mode, choice);
  const rows = new Map(team.map((m, i) => [m, grid[i]]));
  // Only one Pokémon can Mega Evolve per battle. When a four holds more than one stone, each
  // choice of Mega is scored with the others in base form, and the best choice is kept.
  const unMega = new Map(team.filter(m => m.isMega).map(m => [m, withoutMega(m)]));
  if (unMega.size > 1) {
    const ctx: FieldContext = {choice, theirs: opponents.map(mainAbility), yours: team.map(m => m.ability)};
    for (const base of unMega.values()) rows.set(base, opponents.map(o => pairScore(base, o, moves, mode, ctx)));
  }
  const score = (m: TeamMember, j: number) => rows.get(m)![j];
  const physicalHeavy = opponents.filter(o => isPhysical(o, moves)).length >= opponents.length / 2;

  const lineups: Lineup[] = [];
  for (const picked of combinations(team, Math.min(BRING, team.length))) {
    const holders = picked.filter(m => m.isMega);
    // [Mega, four as they fight] for each possible Mega (or none needed).
    const variants: Array<[TeamMember | null, TeamMember[]]> =
      holders.length > 1
        ? holders.map(mega => [mega, picked.map(m => (m.isMega && m !== mega ? unMega.get(m)! : m))])
        : [[holders[0] ?? null, picked]];
    let bestForFour: Lineup | null = null;
    for (const [mega, four] of variants) {
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
      // Same numbers as the score: an opponent that likely OHKOs three or more of the four.
      const shared = opponents
        .map((o, j) => ({name: o.name, ko: four.filter(m => score(m, j).theirHits <= 1).length}))
        .filter(x => x.ko >= 3)
        .slice(0, MAX_SHARED_WEAKNESSES);
      for (const s of shared) warnings.push(`${s.name} can likely OHKO ${s.ko} of these four`);
      const penalty = shared.length * SHARED_WEAKNESS_PENALTY;

      const bench = team.filter(m => !picked.includes(m));
      if (holders.length > 1 && mega) {
        const stay = holders.filter(m => m !== mega).map(m => `${m.label} stays as ${unMega.get(m)!.species.name}`);
        fourReasons.unshift(`Mega Evolve ${mega.label}; ${stay.join(', ')} (one Mega per battle)`);
      }
      for (const m of bench) {
        // Matchups it loses, worst first, with the move and estimate that decide them.
        const losses = opponents
          .map((o, j) => ({o, s: score(m, j)}))
          .filter(x => x.s.win < 0.5 && x.s.theirs)
          .sort((a, b) => a.s.total - b.s.total)
          .map(({o, s}) => `${o.name} (${s.theirs!.move.name} ${approx(s.theirs!.percent)})`);
        fourReasons.push(
          losses.length
            ? `${m.label} stays out: loses to ${names(losses, 2)}`
            : `${m.label} stays out: fewest winning matchups`,
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
        for (const m of [...leads].reverse()) reasons.unshift(leadReason(m, opponents, j => score(m, j)));
        const total = LINEUP_WEIGHTS.answers * answers + LINEUP_WEIGHTS.leads * leadQuality + bonus - penalty;
        if (!best || total > best.score) {
          best = {
            leads,
            back: four.filter(m => !leads.includes(m)),
            bench,
            mega,
            score: total,
            reasons: [...reasons, ...fourReasons],
            warnings,
          };
        }
      }
      if (best && (!bestForFour || best.score > bestForFour.score)) bestForFour = best;
    }
    if (bestForFour) lineups.push(bestForFour);
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
