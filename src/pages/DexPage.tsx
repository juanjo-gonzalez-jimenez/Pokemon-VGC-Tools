import {useMemo, useState} from 'react';
import {DexDetail} from '../components/dex/DexDetail';
import {DexSidebar} from '../components/dex/DexSidebar';
import type {RegulationSummary} from '../data/types';
import {useDexList} from '../data/useDexList';
import {useLookupTables} from '../data/useLookupTables';
import {usePersistentState} from '../hooks/usePersistentState';
import {searchRoster, SORT_KEYS, sortRoster, type SortKey} from '../lib/dex';
import {oneOf} from '../lib/storage';
import {TYPES, type TypeName} from '../lib/typechart';

interface Props {
  regulations: RegulationSummary[];
  regId: string;
  onRegChange: (id: string) => void;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}


export function DexPage({regulations, regId, onRegChange, selectedId, onSelect}: Props) {
  const regulation = regulations.find(r => r.id === regId);
  const tables = useLookupTables(regulation?.mod);
  const [query, setQuery] = useState('');
  const [sort, setSort] = usePersistentState<SortKey>('vgc-tools:dex-sort', 'usage', oneOf(SORT_KEYS));
  const [type, setType] = usePersistentState<TypeName | ''>('vgc-tools:dex-type', '', oneOf(['', ...TYPES]));

  const dexList = useDexList(regId);
  const roster = useMemo(() => dexList ?? [], [dexList]);
  const list = useMemo(() => sortRoster(searchRoster(roster, query, type), sort), [roster, query, type, sort]);
  // Usage rank only among Pokémon with rating-cutoff data (the list is already sorted that way).
  const rank = useMemo(
    () => new Map(roster.filter(p => !p.source).map((p, i) => [p.id, i + 1])),
    [roster],
  );
  const selected = roster.find(p => p.id === selectedId) ?? list[0];

  return (
    <div className="dex">
      <DexSidebar
        regulations={regulations}
        regId={regId}
        onRegChange={onRegChange}
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        type={type}
        onTypeChange={setType}
        list={list}
        total={roster.length}
        selectedId={selected?.id}
        onSelect={onSelect}
      />
      <div className="dex-main">
        {!dexList ? (
          <p className="muted">Loading regulation…</p>
        ) : selected ? (
          <DexDetail
            pokemon={selected}
            rank={rank.get(selected.id)}
            cutoff={regulation?.cutoff ?? 0}
            roster={roster}
            moves={tables?.moves ?? null}
            items={tables?.items ?? null}
            possibleAbilities={tables?.species[selected.id]?.abilities ?? []}
            onSelect={onSelect}
          />
        ) : (
          <p className="muted">No Pokémon match your search.</p>
        )}
      </div>
    </div>
  );
}
