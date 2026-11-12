import {lazy, Suspense, useEffect, useMemo, useState} from 'react';
import {usePersistentState} from './hooks/usePersistentState';
import {boolean, oneOf} from './lib/storage';
import {Icon, Logo} from './components/Icon';
import {ThemeToggle} from './components/ThemeToggle';
import indexJson from './data/index.json';
import type {RegulationData, RegulationIndex} from './data/types';
import type {TypeName} from './lib/typechart';
import {CoveragePage} from './pages/CoveragePage';
import {DexPage} from './pages/DexPage';

// Pages that use the damage calculator load it (and themselves) only when opened.
const TeamPage = lazy(() => import('./pages/TeamPage').then(m => ({default: m.TeamPage})));
const MatchupPage = lazy(() => import('./pages/MatchupPage').then(m => ({default: m.MatchupPage})));
const CalcPage = lazy(() => import('./pages/CalcPage').then(m => ({default: m.CalcPage})));

const index = indexJson as RegulationIndex;
// Each regulation is its own chunk, loaded on demand.
const loaders = import.meta.glob<RegulationData>(['./data/regulations/*.json', '!./data/regulations/*-dex.json'], {
  import: 'default',
});
const TOP_N_OPTIONS = [25, 50, 100, 0];

const PAGES = {
  dex: {
    label: 'Pokémon',
    intro: 'Browse every Pokémon in the regulation: stats, moves, items, abilities, spreads, natures and teammates.',
  },
  team: {
    label: 'Team',
    intro:
      'Paste a Showdown export of your team to see its weaknesses and speed against the Pokémon Champions VGC meta.',
  },
  matchup: {
    label: 'Matchup',
    intro: 'At team preview, enter the opponent’s six to see how your team matches up and which four to bring.',
  },
  calc: {
    label: 'Calc',
    intro: 'Exact damage between any two Pokémon of the regulation, both ways, starting from their most used sets.',
  },
  coverage: {
    label: 'Coverage',
    intro:
      'Pick up to four attacking move types and see how they hit the Pokémon Champions VGC meta, including abilities like Levitate, Water Absorb and Thick Fat.',
  },
} as const;
type PageId = keyof typeof PAGES;

interface Route {
  page: PageId;
  /** Selected Pokémon on the dex page (#/dex/<id>). */
  id?: string;
}

function routeFromHash(): Route {
  const [page, id] = window.location.hash.replace(/^#\/?/, '').split('/');
  if (page === 'team') return {page: 'team'};
  if (page === 'matchup') return {page: 'matchup'};
  if (page === 'calc') return {page: 'calc'};
  if (page === 'coverage') return {page: 'coverage'};
  // The first tab, Pokémon, is also the landing page.
  return {page: 'dex', id: page === 'dex' ? id || undefined : undefined};
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const {page} = route;
  // Settings are remembered; a stored regulation that no longer exists falls back to the newest.
  // (A new key: the Bo3 data became the default, so everyone starts there once.)
  const [regId, setRegId] = usePersistentState(
    'vgc-tools:regulation-v2',
    index.regulations[0]?.id ?? '',
    oneOf(index.regulations.map(r => r.id)),
  );
  const [reg, setReg] = useState<RegulationData | null>(null);
  const [weighted, setWeighted] = usePersistentState('vgc-tools:weighted', true, boolean);
  const [topN, setTopN] = usePersistentState('vgc-tools:meta-size', 50, oneOf(TOP_N_OPTIONS));
  // Kept here so switching tabs doesn't lose the selection.
  const [types, setTypes] = useState<TypeName[]>([]);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
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
    <main className={page === 'dex' ? 'wide' : page === 'calc' ? 'full' : 'full narrow'}>
      <header>
        <div className="title-row">
          <h1>
            <a className="brand" href="#/dex">
              <Logo />
              <span>
                VGC <span className="brand-accent">Tools</span>
              </span>
            </a>
          </h1>
          <div className="header-actions">
            <nav className="tabs">
              {(Object.keys(PAGES) as PageId[]).map(id => (
                <a key={id} href={`#/${id}`} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined}>
                  <Icon name={id} />
                  {PAGES[id].label}
                </a>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
        <p className="muted">{PAGES[page].intro}</p>
      </header>

      {page !== 'dex' && (
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
          {/* The Matchup tab compares against the opponent's six, not the meta. */}
          {(page === 'coverage' || page === 'team') && (
            <>
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
            </>
          )}
          {summary && (
            <p className="muted source">
              Smogon stats {summary.month}, {summary.cutoff}+ rating, {summary.battles.toLocaleString()} battles
            </p>
          )}
        </section>
      )}

      {page === 'dex' ? (
        <DexPage
          regulations={index.regulations}
          regId={regId}
          onRegChange={setRegId}
          selectedId={route.id}
          onSelect={id => {
            window.location.hash = `#/dex/${id}`;
          }}
        />
      ) : page === 'coverage' ? (
        <CoveragePage roster={roster} weighted={weighted} types={types} onTypesChange={setTypes} mod={summary?.mod} />
      ) : page === 'matchup' ? (
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <MatchupPage key={regId} regId={regId} mod={summary?.mod} />
        </Suspense>
      ) : page === 'calc' ? (
        <Suspense fallback={<p className="muted">Loading the calculator…</p>}>
          <CalcPage key={regId} regId={regId} mod={summary?.mod} />
        </Suspense>
      ) : (
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <TeamPage roster={roster} weighted={weighted} mod={summary?.mod} />
        </Suspense>
      )}

      {page !== 'dex' && page !== 'calc' && (
        <footer className="muted">
          Built on Smogon usage stats. Damage figures are estimates: Intimidate and redirection are included; other
          stat boosts, accuracy, crits, screens and Helping Hand are not.
        </footer>
      )}
    </main>
  );
}
