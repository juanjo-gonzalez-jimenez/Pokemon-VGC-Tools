import type {ItemTable} from '../data/types';
import {toID} from './ids';
import {canLearn, learnsetOf, type Learnsets} from './learnsets';
import type {TeamMember} from './paste';
import {STAT_LABELS, STATS} from './stats';

/** Champions limits (Showdown sim/team-validator.ts and Flat Rules). */
export const MAX_TOTAL_SP = 66;
export const MAX_STAT_SP = 32;
export const MAX_MOVES = 4;

/**
 * Rule problems a Champions VGC team would be rejected for. Moves and items are checked against
 * the regulation's game when the tables come from applyMod() (which sets `unavailable`).
 */
export function checkLegality(team: readonly TeamMember[], items?: ItemTable | null, learnsets?: Learnsets): string[] {
  const issues: string[] = [];

  for (const m of team) {
    const total = STATS.reduce((sum, s) => sum + m.sp[s], 0);
    if (total > MAX_TOTAL_SP) issues.push(`${m.label} has ${total} stat points (max ${MAX_TOTAL_SP}).`);
    for (const s of STATS) {
      if (m.sp[s] > MAX_STAT_SP) {
        issues.push(`${m.label} has ${m.sp[s]} stat points in ${STAT_LABELS[s]} (max ${MAX_STAT_SP}).`);
      }
    }
    if (m.moveLines > MAX_MOVES) issues.push(`${m.label} has ${m.moveLines} moves (max ${MAX_MOVES}).`);
    // A Mega uses its base form's learnset; forms with their own learnset (Rotom-Wash) use theirs.
    const learnset = learnsetOf(learnsets, m.species.name, m.baseSpecies.name, m.baseSpecies.baseSpecies);
    for (const move of m.moves) {
      if (move.unavailable) issues.push(`${m.label}: ${move.name} isn't available in this regulation.`);
      else if (!canLearn(learnset, move.name)) issues.push(`${m.baseSpecies.name} can't learn ${move.name}.`);
    }
    if (m.item && items?.[toID(m.item)]?.unavailable) {
      issues.push(`${m.label}: ${m.item} isn't available in this regulation.`);
    }
    const legal = m.baseSpecies.abilities.map(toID);
    if (m.pastedAbility && !legal.includes(toID(m.pastedAbility))) {
      issues.push(`${m.baseSpecies.name} can't have ${m.pastedAbility} (options: ${m.baseSpecies.abilities.join(', ')}).`);
    }
  }

  const dupes = (key: (m: TeamMember) => string, describe: (k: string, who: string) => string) => {
    const groups = new Map<string, TeamMember[]>();
    for (const m of team) {
      const k = key(m);
      if (k) groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    for (const [k, members] of groups) {
      if (members.length > 1) issues.push(describe(k, members.map(m => m.label).join(', ')));
    }
  };
  // Item Clause: no two Pokémon may hold the same item.
  dupes(m => m.item, (item, who) => `${item} is held by more than one Pokémon (${who}).`);
  // Species Clause: forms (and Megas) count as their base species.
  dupes(
    m => m.baseSpecies.baseSpecies ?? m.baseSpecies.name,
    (species, who) => `More than one ${species} (${who}).`,
  );

  return issues;
}
