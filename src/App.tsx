import {useEffect, useMemo, useState} from 'react';
import {CoverageSummary} from './components/CoverageSummary';
import {PokemonTable} from './components/PokemonTable';
import {Suggestions} from './components/Suggestions';
import {MAX_TYPES, TypePicker} from './components/TypePicker';
import indexJson from './data/index.json';
import type {RegulationData, RegulationIndex} from './data/types';
import {coverRoster} from './lib/coverage';
import {suggestNext} from './lib/suggest';
import type {TypeName} from './lib/typechart';

const index = indexJson as RegulationIndex;
// Each regulation is its own chunk, loaded on demand.
const loaders = import.meta.glob<RegulationData>('./data/regulations/*.json', {import: 'default'});
const TOP_N_OPTIONS = [25, 50, 100, 0];

export function App() {
  const [regId, setRegId] = useState(index.regulations[0]?.id ?? '');
  const [reg, setReg] = useState<RegulationData | null>(null);
  const [types, setTypes] = useState<TypeName[]>([]);
  const [weighted, setWeighted] = useState(true);
  const [topN, setTopN] = useState(50);

  useEffect(() => {
    let live = true;
    loaders[`./data/regulations/${regId}.json`]?.().then(data => live && setReg(data));
    return () => {
      live = false;
    };
  }, [regId]);

  const roster = useMemo(() => (reg ? (topN ? reg.pokemon.slice(0, topN) : reg.pokemon) : []), [reg, topN]);
  const coverage = useMemo(() => coverRoster(types, roster, weighted), [types, roster, weighted]);
  const suggestions = useMemo(() => suggestNext(types, roster, weighted), [types, roster, weighted]);
  const summary = index.regulations.find(r => r.id === regId);

  return (
    <main>
      <header>
        <h1>VGC Type Coverage</h1>
        <p className="muted">
          Pick up to four attacking move types and see how they hit the Pokémon Champions VGC meta, including
          abilities like Levitate, Water Absorb and Thick Fat.
        </p>
      </header>

      <section className="panel controls">
        <label>
          Regulation
          <select value={regId} onChange={e => setRegId(e.target.value)}>
            {index.regulations.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Roster
          <select value={topN} onChange={e => setTopN(Number(e.target.value))}>
            {TOP_N_OPTIONS.map(n => (
              <option key={n} value={n}>
                {n ? `Top ${n} by usage` : 'Everything with ≥0.1% usage'}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={weighted} onChange={e => setWeighted(e.target.checked)} /> Weight by
          usage
        </label>
        {summary && (
          <p className="muted source">
            Smogon stats {summary.month}, {summary.cutoff}+ rating, {summary.battles.toLocaleString()} battles
          </p>
        )}
      </section>

      <TypePicker selected={types} onChange={setTypes} />

      {types.length === 0 ? (
        <Suggestions suggestions={suggestions} canAdd onAdd={t => setTypes([t])} />
      ) : (
        <>
          <CoverageSummary buckets={coverage.buckets} weighted={weighted} />
          <Suggestions
            suggestions={suggestions}
            canAdd={types.length < MAX_TYPES}
            onAdd={t => setTypes([...types, t])}
          />
          <PokemonTable results={coverage.results} />
        </>
      )}

      <footer className="muted">
        Type chart + defensive abilities only. Not modelled: Tera, special moves (Freeze-Dry, Scrappy,
        Thousand Arrows…), Lightning Rod/Storm Drain redirection, damage.
      </footer>
    </main>
  );
}
