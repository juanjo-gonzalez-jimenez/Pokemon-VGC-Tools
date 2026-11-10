import {useEffect, useState} from 'react';
import type {ItemTable, MoveTable, SpeciesTable} from './types';

export interface LookupTables {
  species: SpeciesTable;
  moves: MoveTable;
  items: ItemTable;
}

let pending: Promise<LookupTables> | null = null;
let loaded: LookupTables | null = null;

/** Starts the download once; every page shares the same tables. */
function loadTables(): Promise<LookupTables> {
  pending ??= Promise.all([import('./species.json'), import('./moves.json'), import('./items.json')]).then(([s, m, i]) => {
    loaded = {species: s.default as SpeciesTable, moves: m.default as MoveTable, items: i.default as ItemTable};
    return loaded;
  });
  return pending;
}

/** Species and move tables, loaded as a separate chunk on first use (null until ready). */
export function useLookupTables(): LookupTables | null {
  const [tables, setTables] = useState<LookupTables | null>(loaded);
  useEffect(() => {
    let live = true;
    if (!loaded) loadTables().then(t => live && setTables(t));
    return () => {
      live = false;
    };
  }, []);
  return tables;
}
