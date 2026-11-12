import {useEffect, useRef, type KeyboardEvent} from 'react';
import type {MetaPokemon, RegulationSummary} from '../../data/types';
import {bst, type SortKey} from '../../lib/dex';
import {TYPES, type TypeName} from '../../lib/typechart';
import {pct} from '../CoverageSummary';
import {PokemonIcon} from '../Sprite';
import {Trend} from '../Trend';

const SORT_OPTIONS: Array<[SortKey, string]> = [
  ['usage', 'Usage'],
  ['rising', 'Rising since last month'],
  ['falling', 'Falling since last month'],
  ['name', 'Name'],
  ['bst', 'Base stat total'],
  ['bstNoMega', 'Base stat total (no Megas)'],
  ['hp', 'HP'],
  ['atk', 'Attack'],
  ['def', 'Defense'],
  ['spa', 'Sp. Atk'],
  ['spd', 'Sp. Def'],
  ['spe', 'Speed'],
];

interface Props {
  regulations: RegulationSummary[];
  regId: string;
  onRegChange: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  type: TypeName | '';
  onTypeChange: (t: TypeName | '') => void;
  list: MetaPokemon[];
  total: number;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function DexSidebar(props: Props) {
  const {list, selectedId, onSelect} = props;
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the selected row visible (e.g. after following a link from another tab). Only the list
  // itself is scrolled, never the page.
  useEffect(() => {
    const ul = listRef.current;
    if (!ul || !list.some(p => p.id === selectedId)) return;
    const row = ul.querySelector<HTMLElement>(`[data-id="${selectedId}"]`);
    if (!row) return;
    const top = row.offsetTop - ul.offsetTop;
    if (top < ul.scrollTop) ul.scrollTop = top;
    else if (top + row.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = top + row.offsetHeight - ul.clientHeight;
  }, [selectedId, list]);

  // ↑/↓ move the selection through the visible list.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = list.findIndex(p => p.id === selectedId);
    const next = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (!next) return;
    onSelect(next.id);
    listRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
  };

  return (
    <aside className="dex-sidebar">
      <div className="dex-filters">
        <label className="field">
          Regulation
          <select value={props.regId} onChange={e => props.onRegChange(e.target.value)}>
            {props.regulations.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Search
          <input
            type="search"
            value={props.query}
            placeholder="Pokémon name"
            onChange={e => props.onQueryChange(e.target.value)}
          />
        </label>
        <label className="field">
          Sort by
          <select value={props.sort} onChange={e => props.onSortChange(e.target.value as SortKey)}>
            {SORT_OPTIONS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Type
          <select value={props.type} onChange={e => props.onTypeChange(e.target.value as TypeName | '')}>
            <option value="">All types</option>
            {TYPES.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className="dex-count">
          <span className="muted">
            {list.length} of {props.total} Pokémon
          </span>
        </div>
      </div>

      <ul className="dex-list" ref={listRef} onKeyDown={onKeyDown} aria-label="Pokémon">
        {list.map(p => (
          <li key={p.id}>
            <button
              data-id={p.id}
              className={`dex-row${p.id === selectedId ? ' selected' : ''}`}
              aria-current={p.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(p.id)}
            >
              <PokemonIcon icon={p.icon} />
              <span className="dex-row-name">{p.name}</span>
              <span className="dex-row-usage" title={p.source === 'all' ? 'Usage at all ratings' : undefined}>
                {p.source === 'none' ? '—' : pct(p.usage, p.usage < 0.001 ? 3 : 1)}
                {p.source === 'all' && <span className="tag">all</span>}
                <Trend pokemon={p} />
              </span>
              <span className="dex-row-bst muted">BST {bst(p.baseStats)}</span>
            </button>
          </li>
        ))}
        {!list.length && <li className="muted empty">No Pokémon match your search.</li>}
      </ul>
    </aside>
  );
}
