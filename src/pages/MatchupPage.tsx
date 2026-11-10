import {useMemo} from 'react';
import {Lineups} from '../components/matchup/Lineups';
import {MatchupGrid} from '../components/matchup/MatchupGrid';
import {OpponentPicker} from '../components/matchup/OpponentPicker';
import {Panel} from '../components/Panel';
import {SpeedModeToggle, speedModeNote} from '../components/SpeedModeToggle';
import {PokemonIcon} from '../components/Sprite';
import {ThreatList} from '../components/ThreatList';
import type {MetaPokemon} from '../data/types';
import {useDexList} from '../data/useDexList';
import {useLookupTables} from '../data/useLookupTables';
import {usePersistentState} from '../hooks/usePersistentState';
import {useSavedTeam} from '../hooks/useSavedTeam';
import {toID} from '../lib/ids';
import {matchupGrid, previewForms, suggestBrings} from '../lib/matchup';
import {MAX_TEAM_SIZE, parseTeam, type TeamMember} from '../lib/paste';
import {anyString, oneOf} from '../lib/storage';
import {SPEED_MODE_IDS, type SpeedMode} from '../lib/team';
import {assessThreat} from '../lib/threats';

interface Props {
  regId: string;
  /** The regulation's Showdown data mod, for move and item differences. */
  mod: string | undefined;
}

export function MatchupPage({regId, mod}: Props) {
  const tables = useLookupTables(mod);
  const dex = useDexList(regId);
  const [teamText] = useSavedTeam();
  // Opposing Pokémon ids, comma separated, remembered per regulation.
  const [stored, setStored] = usePersistentState(`vgc-tools:opponents:${regId}`, '', anyString);
  const [mode, setMode] = usePersistentState<SpeedMode>('vgc-tools:speed-mode', 'normal', oneOf(SPEED_MODE_IDS));

  const team = useMemo(
    () => (tables ? parseTeam(teamText, tables.species, tables.moves).members : []),
    [teamText, tables],
  );
  const byId = useMemo(() => new Map((dex ?? []).map(p => [p.id, p])), [dex]);
  const opponents = useMemo(
    () =>
      stored
        .split(',')
        .map(id => byId.get(id))
        .filter((p): p is MetaPokemon => Boolean(p))
        .slice(0, MAX_TEAM_SIZE),
    [stored, byId],
  );
  const setOpponents = (ids: string[]) => setStored(ids.join(','));

  const grid = useMemo(
    () => (tables ? matchupGrid(team, opponents, tables.moves, mode) : []),
    [team, opponents, tables, mode],
  );
  const lineups = useMemo(
    () => (tables ? suggestBrings(team, opponents, tables.moves, mode) : []),
    [team, opponents, tables, mode],
  );
  const threats = useMemo(
    () =>
      tables
        ? opponents.map(o => assessThreat(o, team, tables.moves, mode)).sort((a, b) => b.severity - a.severity)
        : [],
    [team, opponents, tables, mode],
  );

  if (!tables || !dex) return <p className="muted">Loading Pokémon data…</p>;

  const iconOf = (m: TeamMember) => byId.get(toID(m.species.name))?.icon ?? byId.get(toID(m.baseSpecies.name))?.icon;
  // A quick way to try the tool: the six most used species of the regulation.
  const loadExample = () => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const p of dex) {
      const forms = previewForms(p, dex).map(f => f.id);
      if (forms.some(id => seen.has(id))) continue;
      forms.forEach(id => seen.add(id));
      ids.push(p.id);
      if (ids.length === MAX_TEAM_SIZE) break;
    }
    setOpponents(ids);
  };

  return (
    <>
      <Panel
        id="matchup-team"
        title="Your team"
        note={team.length ? `${team.length} Pokémon` : undefined}
        actions={
          <a className="link" href="#/team">
            {team.length ? 'Edit on the Team tab' : 'Go to the Team tab'}
          </a>
        }
      >
        {team.length ? (
          <div className="lineup-members">
            {team.map((m, i) => (
              <span key={i} className="lineup-member">
                <PokemonIcon icon={iconOf(m)} />
                {m.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">Paste your team on the Team tab first; it is remembered here.</p>
        )}
      </Panel>

      <Panel
        id="matchup-opponents"
        title="Their team"
        note="from team preview"
        actions={
          <>
            <button className="link" onClick={loadExample}>
              Load example
            </button>
            {opponents.length > 0 && (
              <button className="link" onClick={() => setOpponents([])}>
                Clear
              </button>
            )}
          </>
        }
      >
        <OpponentPicker dex={dex} opponents={opponents} onChange={setOpponents} />
        <p className="muted small">
          Their sets are assumed from usage stats: most common ability, moves on 50%+ of sets, and real Speed spreads.
          A Pokémon with a Mega form starts as its most used form; change it with the dropdown.
        </p>
      </Panel>

      {team.length > 0 && opponents.length > 0 && (
        <>
          <section className="panel mode-row">
            <span className="muted">Speed control in play</span>
            <SpeedModeToggle mode={mode} onChange={setMode} />
          </section>
          <Lineups lineups={lineups} iconOf={iconOf} note={speedModeNote(mode)} />
          <MatchupGrid team={team} opponents={opponents} grid={grid} iconOf={iconOf} />
          <ThreatList
            id="matchup-threats"
            title="Their biggest threats to you"
            note="most dangerous first"
            threats={threats}
            teamSize={team.length}
          />
        </>
      )}
    </>
  );
}
