import {useState} from 'react';
import type {MetaPokemon} from '../../data/types';
import {MAX_NAME_LENGTH, searchRoster} from '../../lib/dex';
import {previewForms} from '../../lib/matchup';
import {MAX_TEAM_SIZE} from '../../lib/paste';
import {pct} from '../CoverageSummary';
import {PokemonIcon} from '../Sprite';

const MAX_RESULTS = 8;

interface Props {
  /** Every legal Pokémon of the regulation, most used first. */
  dex: MetaPokemon[];
  opponents: MetaPokemon[];
  onChange: (ids: string[]) => void;
}

/** The opponent's six from team preview: search to add, pick a Mega form, remove. */
export function OpponentPicker({dex, opponents, onChange}: Props) {
  const [query, setQuery] = useState('');
  const ids = opponents.map(p => p.id);
  const full = opponents.length >= MAX_TEAM_SIZE;
  // Species Clause: hide every form of a species that is already picked.
  const taken = new Set(opponents.flatMap(p => previewForms(p, dex).map(f => f.id)));
  const results = query.trim() ? searchRoster(dex, query).filter(p => !taken.has(p.id)).slice(0, MAX_RESULTS) : [];

  const add = (p: MetaPokemon) => {
    // Team preview shows the species; assume its most used form (often a Mega) until told otherwise.
    const form = previewForms(p, dex)[0] ?? p;
    onChange([...ids, (/-Mega(-|$)/.test(p.name) ? p : form).id]);
    setQuery('');
  };
  const replace = (index: number, id: string) => onChange(ids.map((x, i) => (i === index ? id : x)));

  return (
    <div className="opponents">
      <ul className="opponent-slots">
        {opponents.map((p, i) => {
          const forms = previewForms(p, dex);
          return (
            <li key={p.id} className="opponent">
              <PokemonIcon icon={p.icon} />
              {forms.length > 1 ? (
                <select aria-label={`Form of ${p.name}`} value={p.id} onChange={e => replace(i, e.target.value)}>
                  {forms.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="opponent-name">{p.name}</span>
              )}
              <button className="remove" aria-label={`Remove ${p.name}`} onClick={() => onChange(ids.filter(x => x !== p.id))}>
                ×
              </button>
            </li>
          );
        })}
      </ul>

      {!full && (
        <div className="opponent-search">
          <input
            type="search"
            value={query}
            placeholder={`Add their Pokémon (${opponents.length}/${MAX_TEAM_SIZE})`}
            maxLength={MAX_NAME_LENGTH}
            aria-label="Add an opposing Pokémon"
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && results[0]) add(results[0]);
            }}
          />
          {results.length > 0 && (
            <ul className="opponent-results">
              {results.map(p => (
                <li key={p.id}>
                  <button onClick={() => add(p)}>
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
      )}
    </div>
  );
}
