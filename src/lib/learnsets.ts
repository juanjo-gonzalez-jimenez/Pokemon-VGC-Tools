/** Which moves a Pokémon can learn in a regulation's game (from the mod's learnsets). */
import type {ModData} from '../data/types';
import {toID} from './ids';

export type Learnsets = NonNullable<ModData['learnsets']>;

const sets = new WeakMap<string[], Set<string>>();

/**
 * The learnable move ids of the first of `ids` (species ids, most specific first: the form, then
 * the species it belongs to) that has a learnset; null when none does (nothing to check against).
 */
export function learnsetOf(learnsets: Learnsets | undefined, ...ids: Array<string | undefined>): Set<string> | null {
  if (!learnsets) return null;
  for (const id of ids) {
    const list = id ? learnsets[toID(id)] : undefined;
    if (!list) continue;
    let set = sets.get(list);
    if (!set) {
      set = new Set(list);
      sets.set(list, set);
    }
    return set;
  }
  return null;
}

/** Whether a move name is learnable; true when there's nothing to check against. */
export const canLearn = (learnset: Set<string> | null, move: string) => !learnset || learnset.has(toID(move));
