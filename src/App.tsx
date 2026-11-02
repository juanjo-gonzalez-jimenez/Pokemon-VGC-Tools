import {useEffect, useMemo, useState} from 'react';
import {ThemeToggle} from './components/ThemeToggle';
import indexJson from './data/index.json';
import type {RegulationData, RegulationIndex} from './data/types';
import type {TypeName} from './lib/typechart';
import {CoveragePage} from './pages/CoveragePage';
import {TeamPage} from './pages/TeamPage';

const index = indexJson as RegulationIndex;
// Each regulation is its own chunk, loaded on demand.
const loaders = import.meta.glob<RegulationData>('./data/regulations/*.json', {import: 'default'});
const TOP_N_OPTIONS = [25, 50, 100, 0];

const PAGES = {
  coverage: {
    label: 'Coverage',
    intro:
      'Pick up to four attacking move types and see how they hit the Pokémon Champions VGC meta, including abilities like Levitate, Water Absorb and Thick Fat.',
  },
  team: {
    label: 'Team',
    intro:
      'Paste a Showdown export of your team to see its weaknesses and speed against the Pokémon Champions VGC meta.',
  },
} as const;
type PageId = keyof typeof PAGES;

const pageFromHash = (): PageId => (window.location.hash === '#/team' ? 'team' : 'coverage');

export function App() {
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [regId, setRegId] = useState(index.regulations[0]?.id ?? '');
  const [reg, setReg] = useState<RegulationData | null>(null);
  const [weighted, setWeighted] = useState(true);
  const [topN, setTopN] = useState(50);
  // Kept here so switching tabs doesn't lose the selection.
  const [types, setTypes] = useState<TypeName[]>([]);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let live = true;
    loaders[`./data/regulations/${regId}.json`]?.().then(data => live && setReg(data));
    return () => {
      live = false;
    };
  }, [regId]);

  const roster = useMemo(() => (reg ? (topN ? reg.pokemon.slice(0, topN) : reg.pokemon) : []), [reg, topN]);
  const summary = index.regulations.find(r => r.id === regId);

  return (
    <main>
      <header>
        <div className="title-row">
          <h1>VGC Tools</h1>
          <div className="header-actions">
            <nav className="tabs">
              {(Object.keys(PAGES) as PageId[]).map(id => (
                <a key={id} href={`#/${id}`} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined}>
                  {PAGES[id].label}
                </a>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
        <p className="muted">{PAGES[page].intro}</p>
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
          Meta
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

      {page === 'coverage' ? (
        <CoveragePage roster={roster} weighted={weighted} types={types} onTypesChange={setTypes} />
      ) : (
        <TeamPage roster={roster} weighted={weighted} />
      )}

      <footer className="muted">
        Type chart, defensive abilities and Speed only. Not modelled: special moves (Freeze-Dry, Scrappy,
        Thousand Arrows…), Lightning Rod/Storm Drain redirection, Tailwind/Trick Room, damage.
      </footer>
    </main>
  );
}
