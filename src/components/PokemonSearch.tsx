import {useState} from 'react';
import type {MetaPokemon} from '../data/types';
import {MAX_NAME_LENGTH, searchRoster} from '../lib/dex';
import {pct} from './CoverageSummary';
import {PokemonIcon} from './Sprite';

const MAX_RESULTS = 8;

interface Props {
  dex: MetaPokemon[];
  onPick: (p: MetaPokemon) => void;
  placeholder: string;
  label: string;
}

/** Search box over a regulation's Pokémon, with icons and usage; Enter picks the first result. */
export function PokemonSearch({dex, onPick, placeholder, label}: Props) {
  const [query, setQuery] = useState('');
  const results = query.trim() ? searchRoster(dex, query).slice(0, MAX_RESULTS) : [];
  const pick = (p: MetaPokemon) => {
    onPick(p);
    setQuery('');
  };
  return (
    <div className="opponent-search">
      <input
        type="search"
        value={query}
        placeholder={placeholder}
        maxLength={MAX_NAME_LENGTH}
        aria-label={label}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && results[0]) pick(results[0]);
        }}
      />
      {results.length > 0 && (
        <ul className="opponent-results">
          {results.map(p => (
            <li key={p.id}>
              <button onClick={() => pick(p)}>
                <PokemonIcon icon={p.icon} />
                <span>{p.name}</span>
                <span className="muted">{p.source === 'none' ? '' : pct(p.usage)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && !results.length && <p className="muted small">No legal Pokémon matches “{query}”.</p>}
    </div>
  );
}
