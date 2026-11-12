import {useEffect, useState} from 'react';
import {applyMod} from '../lib/mods';
import type {ItemTable, ModData, MoveTable, SpeciesTable} from './types';

export interface LookupTables {
  species: SpeciesTable;
  moves: MoveTable;
  items: ItemTable;
  /** Species id -> learnable move ids, when the regulation's game has learnsets. */
  learnsets?: Record<string, string[]>;
}

let base: Promise<LookupTables> | null = null;
/** Each regulation game's differences from the base data, one small lazy chunk per mod. */
const modLoaders = import.meta.glob<ModData>('./mods/*.json', {import: 'default'});
/** Tables with a mod applied, by mod name ('' = base data). */
const ready = new Map<string, LookupTables>();
const pending = new Map<string, Promise<LookupTables>>();

function loadBase(): Promise<LookupTables> {
  base ??= Promise.all([import('./species.json'), import('./moves.json'), import('./items.json')]).then(
    ([s, m, i]) => ({species: s.default as SpeciesTable, moves: m.default as MoveTable, items: i.default as ItemTable}),
  );
  return base;
}

/** Starts each download once; every page shares the same tables. */
function loadTables(mod: string): Promise<LookupTables> {
  if (!pending.has(mod)) {
    const loader = modLoaders[`./mods/${mod}.json`];
    pending.set(
      mod,
      Promise.all([loadBase(), loader ? loader() : null]).then(([tables, modData]) => {
        const result = modData ? applyMod(tables, modData) : tables;
        ready.set(mod, result);
        return result;
      }),
    );
  }
  return pending.get(mod)!;
}

/**
 * Species, move and item tables for a regulation's game (`mod`, from the regulation summary),
 * loaded on first use; null until ready. Without a mod the base data is returned.
 */
export function useLookupTables(mod = ''): LookupTables | null {
  const [, rerender] = useState(0);
  useEffect(() => {
    let live = true;
    if (!ready.has(mod)) loadTables(mod).then(() => live && rerender(n => n + 1));
    return () => {
      live = false;
    };
  }, [mod]);
  return ready.get(mod) ?? null;
}
