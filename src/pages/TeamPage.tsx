import {useMemo} from 'react';
import {DefensiveChart} from '../components/DefensiveChart';
import {Icon} from '../components/Icon';
import {Panel} from '../components/Panel';
import {RolesChecklist} from '../components/RolesChecklist';
import {SpeedTiers} from '../components/SpeedTiers';
import {TeamCards} from '../components/TeamCards';
import {TeammateSuggestions} from '../components/TeammateSuggestions';
import {ThreatList} from '../components/ThreatList';
import type {MetaPokemon} from '../data/types';
import {useLookupTables} from '../data/useLookupTables';
import {usePersistentState} from '../hooks/usePersistentState';
import {useSavedTeam} from '../hooks/useSavedTeam';
import {checkLegality} from '../lib/legality';
import {parseTeam} from '../lib/paste';
import {teamRoles} from '../lib/roles';
import {oneOf} from '../lib/storage';
import {defensiveChart, SPEED_MODE_IDS, teamSpeeds, type SpeedMode} from '../lib/team';
import {suggestTeammates} from '../lib/teammates';
import {threatList} from '../lib/threats';
import {TeamSwitcher} from '../components/TeamSwitcher';
import {TournamentTeams} from '../components/TournamentTeams';
import {useDexList} from '../data/useDexList';
import {useTournamentTeams} from '../data/useTournamentTeams';
import {bestFirst} from '../lib/tournaments';

const EXAMPLE_TEAM = `Sneasler @ White Herb
Ability: Unburden
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Close Combat
- Dire Claw
- Fake Out
- Protect

Kingambit @ Chople Berry
Ability: Defiant
EVs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Protect

Basculegion @ Focus Sash
Ability: Adaptability
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Wave Crash
- Last Respects
- Aqua Jet
- Protect

Charizard @ Charizardite Y
Ability: Blaze
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Heat Wave
- Weather Ball
- Solar Beam
- Protect

Rillaboom @ Miracle Seed
Ability: Grassy Surge
EVs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Fake Out
- Grassy Glide
- Wood Hammer
- U-turn

Incineroar @ Sitrus Berry
Ability: Intimidate
EVs: 32 HP / 2 Def / 32 SpD
Careful Nature
- Fake Out
- Parting Shot
- Flare Blitz
- Darkest Lariat`;

/** The analysis sections under the team; one shows at a time. */
const SECTIONS = [
  {id: 'defense', label: 'Defense'},
  {id: 'threats', label: 'Threats'},
  {id: 'speed', label: 'Speed'},
  {id: 'ideas', label: 'Swap ideas'},
  {id: 'top', label: 'Top teams'},
] as const;
type Section = (typeof SECTIONS)[number]['id'];
const SECTION_IDS = SECTIONS.map(s => s.id);

/** Defense / Threats / Speed / Swap ideas / Top teams switch (←/→ move between them). */
function SectionTabs({section, onChange}: {section: Section; onChange: (s: Section) => void}) {
  return (
    <div
      className="segmented section-tabs"
      role="tablist"
      aria-label="Team analysis"
      onKeyDown={e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = SECTION_IDS.indexOf(section);
        const next = SECTION_IDS[(i + (e.key === 'ArrowRight' ? 1 : SECTION_IDS.length - 1)) % SECTION_IDS.length];
        onChange(next);
        e.currentTarget.querySelector<HTMLButtonElement>(`#tab-${next}`)?.focus();
      }}
    >
      {SECTIONS.map(s => (
        <button
          key={s.id}
          id={`tab-${s.id}`}
          role="tab"
          aria-selected={section === s.id}
          aria-controls="team-section"
          tabIndex={section === s.id ? 0 : -1}
          className={section === s.id ? 'on' : ''}
          onClick={() => onChange(s.id)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** Tournament teams shown on the Team tab: the latest winners. */
const TOP_TEAMS = 8;

/** Recent top tournament teams, each one click from being your team. */
function TopTeamsPanel({regId}: {regId: string}) {
  const teams = useTournamentTeams(regId);
  // Every legal Pokémon (not just the meta roster), so each member finds its usual spread.
  const dexList = useDexList(regId);
  if (teams && !teams.length) return null;
  return (
    <Panel id="top-teams" title="Start from a top team" note="recent tournaments · from Limitless">
      {!teams || !dexList ? (
        <p className="muted">Loading teams…</p>
      ) : (
        <>
          <TournamentTeams teams={bestFirst(teams).slice(0, TOP_TEAMS)} roster={dexList} />
          <p className="muted small">
            Tournament teams don’t publish stat points, so an opened team gets each Pokémon’s most used spread (with
            its nature when possible). Change them in the text.
          </p>
        </>
      )}
    </Panel>
  );
}

interface Props {
  regId: string;
  roster: MetaPokemon[];
  weighted: boolean;
  /** The regulation's Showdown data mod, for move and item differences. */
  mod: string | undefined;
}

export function TeamPage({regId, roster, weighted, mod}: Props) {
  const [text, update] = useSavedTeam();
  const tables = useLookupTables(mod);
  // Shared by the speed tiers and the threat list.
  const [speedMode, setSpeedMode] = usePersistentState<SpeedMode>('vgc-tools:speed-mode', 'normal', oneOf(SPEED_MODE_IDS));
  const [section, setSection] = usePersistentState<Section>('vgc-tools:team-section', 'defense', oneOf(SECTION_IDS));

  const parsed = useMemo(
    () => (tables ? parseTeam(text, tables.species, tables.moves) : {members: [], warnings: []}),
    [text, tables],
  );
  const team = parsed.members;
  const defense = useMemo(() => defensiveChart(team), [team]);
  const speeds = useMemo(() => teamSpeeds(team, roster, weighted, speedMode), [team, roster, weighted, speedMode]);
  const legality = useMemo(() => checkLegality(team, tables?.items, tables?.learnsets), [team, tables]);
  const roles = useMemo(() => teamRoles(team), [team]);
  const threats = useMemo(
    () => (tables ? threatList(team, roster, tables.moves, speedMode) : []),
    [team, roster, tables, speedMode],
  );
  const teammates = useMemo(
    () => (tables ? suggestTeammates(team, roster, tables.species, tables.moves, speedMode) : []),
    [team, roster, tables, speedMode],
  );

  return (
    <>
      {/* On wide screens the paste and the roles sit side by side. */}
      <div className="panel-pair">
      <Panel
        id="team-paste"
        title="Your team"
        actions={
          <>
            <button className="link" onClick={() => update(EXAMPLE_TEAM)}>
              Load example
            </button>
            {text && (
              <button className="link" onClick={() => update('')}>
                Clear
              </button>
            )}
          </>
        }
      >
        <TeamSwitcher />
        <textarea
          className="paste"
          value={text}
          onChange={e => update(e.target.value)}
          placeholder={'Paste a Showdown / Pokepaste export here.\n\nIncineroar @ Sitrus Berry\nAbility: Intimidate\nEVs: 32 HP / 2 Def / 32 SpD\nCareful Nature\n- Fake Out\n- ...'}
          spellCheck={false}
          rows={10}
        />
        {!tables && <p className="muted">Loading Pokémon data…</p>}
        {parsed.warnings.length > 0 && (
          <ul className="warnings">
            {parsed.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
        {team.length > 0 &&
          (legality.length > 0 ? (
            <ul className="legality">
              {legality.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p className="legal-ok">
              <Icon name="check" /> No rule problems found (stat points, items, species, abilities, moves,
              availability).
            </p>
          ))}
      </Panel>
      {team.length > 0 && <RolesChecklist roles={roles} />}
      </div>
      {team.length === 0 && <TopTeamsPanel regId={regId} />}

      {team.length > 0 && (
        <>
          <Panel id="team-members" title="Team members" note={`${team.length} Pokémon`}>
            <TeamCards team={team} items={tables?.items ?? null} />
          </Panel>
          <SectionTabs section={section} onChange={setSection} />
          <div id="team-section" role="tabpanel" aria-labelledby={`tab-${section}`} className="team-section">
            {section === 'defense' && <DefensiveChart team={team} rows={defense} />}
            {section === 'threats' && <ThreatList threats={threats} teamSize={team.length} />}
            {section === 'speed' && (
              <SpeedTiers speeds={speeds} roster={roster} mode={speedMode} onModeChange={setSpeedMode} />
            )}
            {section === 'ideas' && <TeammateSuggestions suggestions={teammates} teamSize={team.length} />}
            {section === 'top' && <TopTeamsPanel regId={regId} />}
          </div>
        </>
      )}
    </>
  );
}
