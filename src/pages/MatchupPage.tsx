import {useMemo} from 'react';
import {LeadBoard, type LeadPicks} from '../components/matchup/LeadBoard';
import {Lineups} from '../components/matchup/Lineups';
import {MatchupGrid} from '../components/matchup/MatchupGrid';
import {OpponentPicker} from '../components/matchup/OpponentPicker';
import {Panel} from '../components/Panel';
import {SpeedModeToggle, speedModeNote} from '../components/SpeedModeToggle';
import {PokemonIcon} from '../components/Sprite';
import {TeamSelect} from '../components/TeamSwitcher';
import {ThreatList} from '../components/ThreatList';
import type {MetaPokemon} from '../data/types';
import {useDexList} from '../data/useDexList';
import {useLookupTables} from '../data/useLookupTables';
import {usePersistentState} from '../hooks/usePersistentState';
import {useSavedTeam} from '../hooks/useSavedTeam';
import {toID} from '../lib/ids';
import {mainAbility} from '../lib/combatant';
import {FIELD_CHOICES, resolveField, type FieldChoice, type FieldContext} from '../lib/field';
import {describeAutoField, matchupGrid, previewForms, suggestBrings} from '../lib/matchup';
import {MAX_TEAM_SIZE, parseTeam, type TeamMember} from '../lib/paste';
import {anyString, oneOf} from '../lib/storage';
import {SPEED_MODE_IDS, type SpeedMode} from '../lib/team';
import {assessThreat} from '../lib/threats';

const FIELD_LABELS: Record<FieldChoice, string> = {
  auto: 'Auto (from abilities)',
  none: 'No weather or terrain',
  rain: 'Rain',
  sun: 'Sun',
  sand: 'Sand',
  snow: 'Snow',
  grassy: 'Grassy Terrain',
  electric: 'Electric Terrain',
  psychic: 'Psychic Terrain',
  misty: 'Misty Terrain',
};

const fieldContext = (choice: FieldChoice, team: TeamMember[], opponents: MetaPokemon[]): FieldContext => ({
  choice,
  theirs: opponents.map(mainAbility),
  yours: team.map(m => m.ability),
});

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
  const [fieldChoice, setFieldChoice] = usePersistentState<FieldChoice>('vgc-tools:field', 'auto', oneOf(FIELD_CHOICES));

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
    () => (tables ? matchupGrid(team, opponents, tables.moves, mode, fieldChoice) : []),
    [team, opponents, tables, mode, fieldChoice],
  );
  const lineups = useMemo(
    () => (tables ? suggestBrings(team, opponents, tables.moves, mode, 3, fieldChoice) : []),
    [team, opponents, tables, mode, fieldChoice],
  );
  // Lead vs lead picks: "0,1|2,3" (your team indexes | their six indexes), remembered per regulation.
  const [storedLeads, setStoredLeads] = usePersistentState(`vgc-tools:leads:${regId}`, '', anyString);
  const leadPicks = useMemo((): LeadPicks | null => {
    if (team.length < 2 || opponents.length < 2) return null;
    const pair = (text: string | undefined, size: number): [number, number] | null => {
      const n = (text ?? '').split(',').map(Number);
      return n.length === 2 && n.every(i => Number.isInteger(i) && i >= 0 && i < size) && n[0] !== n[1] ? [n[0], n[1]] : null;
    };
    const [y, t] = storedLeads.split('|');
    const best = lineups[0];
    const yours = pair(y, team.length) ?? (best && best.leads.length === 2 ? (best.leads.map(m => team.findIndex(x => x.label === m.label)) as [number, number]) : [0, 1]);
    // Their likeliest pressure: the two that score best against your two leads.
    const danger = opponents
      .map((_, j) => ({j, total: (grid[yours[0]]?.[j]?.total ?? 0.5) + (grid[yours[1]]?.[j]?.total ?? 0.5)}))
      .sort((a, b) => a.total - b.total);
    const theirs = pair(t, opponents.length) ?? ([danger[0].j, danger[1].j] as [number, number]);
    return {yours: yours[0] === yours[1] || yours.includes(-1) ? [0, 1] : yours, theirs};
  }, [storedLeads, team, opponents, lineups, grid]);
  const fixedField = useMemo(
    () => (fieldChoice === 'auto' ? undefined : resolveField('', '', fieldContext(fieldChoice, team, opponents))),
    [fieldChoice, team, opponents],
  );

  const threats = useMemo(
    () =>
      tables
        ? opponents
            .map(o => assessThreat(o, team, tables.moves, mode, fieldContext(fieldChoice, team, opponents)))
            .sort((a, b) => b.severity - a.severity)
        : [],
    [team, opponents, tables, mode, fieldChoice],
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
          <>
          <TeamSelect />
          <a className="link" href="#/team">
            {team.length ? 'Edit on the Team tab' : 'Go to the Team tab'}
          </a>
          </>
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
          Their sets come from usage stats: most common ability, average stats over all spreads, the item most sets
          hold, and every move weighted by how many sets run it. A Pokémon with a Mega form starts as its most used
          form; change it with the dropdown.
        </p>
      </Panel>

      {team.length > 0 && opponents.length > 0 && (
        <>
          <section className="panel mode-row">
            <span className="muted">Speed control in play</span>
            <SpeedModeToggle mode={mode} onChange={setMode} />
            <label className="field-select">
              <span className="muted">Field</span>
              <select value={fieldChoice} onChange={e => setFieldChoice(e.target.value as FieldChoice)}>
                {FIELD_CHOICES.map(c => (
                  <option key={c} value={c}>
                    {FIELD_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            {fieldChoice === 'auto' && <span className="muted small field-note">Auto: {describeAutoField(team, opponents)}</span>}
          </section>
          <Lineups lineups={lineups} iconOf={iconOf} note={speedModeNote(mode)} />
          {leadPicks && (
            <LeadBoard
              team={team}
              opponents={opponents}
              moves={tables.moves}
              picks={leadPicks}
              onPicks={p => setStoredLeads(`${p.yours.join(',')}|${p.theirs.join(',')}`)}
              mode={mode}
              field={fixedField}
            />
          )}
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
