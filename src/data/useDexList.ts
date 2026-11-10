import {useEffect, useState} from 'react';
import type {MetaPokemon} from './types';

// Every legal Pokémon per regulation, one lazy chunk each.
const dexLoaders = import.meta.glob<MetaPokemon[]>('./regulations/*-dex.json', {import: 'default'});

/** Every legal Pokémon of a regulation, most used first; null while loading. */
export function useDexList(regId: string): MetaPokemon[] | null {
  const [state, setState] = useState<{regId: string; list: MetaPokemon[]} | null>(null);
  useEffect(() => {
    let live = true;
    dexLoaders[`./regulations/${regId}-dex.json`]?.().then(list => live && setState({regId, list}));
    return () => {
      live = false;
    };
  }, [regId]);
  return state?.regId === regId ? state.list : null;
}
