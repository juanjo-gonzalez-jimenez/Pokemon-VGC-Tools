import {useEffect, useMemo, useState} from 'react';
import {CalcFieldPanel} from '../components/calc/CalcFieldPanel';
import {CalcOptimizer} from '../components/calc/CalcOptimizer';
import {CalcResults} from '../components/calc/CalcResults';
import {CalcSide} from '../components/calc/CalcSide';
import type {MetaPokemon} from '../data/types';
import {useDexList} from '../data/useDexList';
import {useLookupTables} from '../data/useLookupTables';
import {calcMoves, usageSet, type CalcSet, type CalcState} from '../lib/calcset';
import {NO_FIELD} from '../lib/damage';
import {anyString, readStored, regulationKey, writeStored} from '../lib/storage';

interface Props {
  regId: string;
  /** The regulation's Showdown data mod, for move and item availability. */
  mod: string | undefined;
}

const EMPTY: CalcState = {a: null, b: null, field: NO_FIELD, sides: {a: {}, b: {}}, singleTarget: false};

/** Stored state, or nothing when it's missing or from an older layout. */
function parseState(raw: string): CalcState | null {
  try {
    const value = JSON.parse(raw) as CalcState;
    if (!value || typeof value !== 'object' || !value.field || !value.sides) return null;
    const ok = (s: CalcSet | null) => s === null || (typeof s.id === 'string' && Array.isArray(s.moves) && Boolean(s.sp) && Boolean(s.boosts));
    return ok(value.a) && ok(value.b) ? {...EMPTY, ...value} : null;
  } catch {
    return null;
  }
}

export function CalcPage({regId, mod}: Props) {
  const tables = useLookupTables(mod);
  const dex = useDexList(regId);
  const key = `vgc-tools:calc:${regulationKey(regId)}`;
  const [state, setState] = useState<CalcState>(() => parseState(readStored(key, '', anyString)) ?? EMPTY);
  useEffect(() => writeStored(key, JSON.stringify(state)), [key, state]);

  const byId = useMemo(() => new Map((dex ?? []).map(p => [p.id, p])), [dex]);
  const itemNames = useMemo(
    () => (tables ? Object.values(tables.items).filter(i => !i.unavailable).map(i => i.name).sort() : []),
    [tables],
  );
  const moveNames = useMemo(
    () =>
      tables
        ? Object.values(tables.moves)
            .filter(m => !m.unavailable && m.category !== 'Status')
            .map(m => m.name)
            .sort()
        : [],
    [tables],
  );

  // First visit: the two most used Pokémon with their usual sets (until the user changes them).
  const defaults = useMemo(() => {
    if (!dex || !tables) return {a: null, b: null};
    const fresh = (p: MetaPokemon | undefined) => (p ? usageSet(p, tables.species[p.id], tables.moves) : null);
    return {a: fresh(dex[0]), b: fresh(dex[1])};
  }, [dex, tables]);
  const setA = state.a ?? defaults.a;
  const setB = state.b ?? defaults.b;

  const sideData = (set: CalcSet | null) => {
    const pokemon = set ? byId.get(set.id) : undefined;
    const species = pokemon && tables ? tables.species[pokemon.id] : undefined;
    return set && pokemon && species ? {set, pokemon, species} : null;
  };
  const a = sideData(setA);
  const b = sideData(setB);

  const results = useMemo(() => {
    if (!a || !b || !tables) return null;
    return {
      ab: calcMoves(a, b, tables.moves, state.field, state.sides.a, state.sides.b, state.singleTarget),
      ba: calcMoves(b, a, tables.moves, state.field, state.sides.b, state.sides.a, state.singleTarget),
    };
  }, [a, b, tables, state.field, state.sides, state.singleTarget]);

  if (!dex || !tables) return <p className="muted">Loading Pokémon data…</p>;
  if (!a || !b) return <p className="muted">Preparing the calculator…</p>;

  const pick = (side: 'a' | 'b') => (p: MetaPokemon) =>
    setState(s => ({...s, [side]: usageSet(p, tables.species[p.id], tables.moves)}));
  const setSide = (side: 'a' | 'b') => (set: CalcSet) => setState(s => ({...s, [side]: set}));
  const common = {dex, tables, itemNames, moveNames};

  return (
    <div className="calc">
      <div className="calc-top">
        <CalcSide side="a" title="Pokémon A" {...common} {...a} onChange={setSide('a')} onPick={pick('a')} />
        <CalcFieldPanel
          field={state.field}
          sides={state.sides}
          names={{a: a.species.name, b: b.species.name}}
          singleTarget={state.singleTarget}
          onField={field => setState(s => ({...s, field}))}
          onSides={sides => setState(s => ({...s, sides}))}
          onSingleTarget={singleTarget => setState(s => ({...s, singleTarget}))}
        />
        <CalcSide side="b" title="Pokémon B" {...common} {...b} onChange={setSide('b')} onPick={pick('b')} />
      </div>
      {results && (
        <div className="calc-bottom">
          <CalcResults title={`${a.species.name} → ${b.species.name}`} results={results.ab} />
          <CalcResults title={`${b.species.name} → ${a.species.name}`} results={results.ba} />
        </div>
      )}
      <CalcOptimizer a={a} b={b} moves={tables.moves} state={state} onApply={(side, set) => setSide(side)(set)} />
      <p className="muted small calc-credit">
        Calculated with Smogon’s damage calculator (@smogon/calc) in its Pokémon Champions mode: exact rolls, Showdown
        rounding. The move list only offers moves the Pokémon can learn in this regulation.
      </p>
    </div>
  );
}
