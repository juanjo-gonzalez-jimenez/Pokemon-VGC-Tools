import {useMemo, useState} from 'react';
import {DefensiveChart} from '../components/DefensiveChart';
import {Panel} from '../components/Panel';
import {RolesChecklist} from '../components/RolesChecklist';
import {SpeedTiers} from '../components/SpeedTiers';
import {TeamCards} from '../components/TeamCards';
import {TeammateSuggestions} from '../components/TeammateSuggestions';
import {ThreatList} from '../components/ThreatList';
import {TypeBadge} from '../components/TypeBadge';
import type {MetaPokemon} from '../data/types';
import {useLookupTables} from '../data/useLookupTables';
import {checkLegality} from '../lib/legality';
import {parseTeam} from '../lib/paste';
import {teamRoles} from '../lib/roles';
import {defensiveChart, teamAttackTypes, teamSpeeds, type SpeedMode} from '../lib/team';
import {suggestTeammates} from '../lib/teammates';
import {threatList} from '../lib/threats';

const STORAGE_KEY = 'vgc-tools:team';

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

function loadSaved(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function save(text: string) {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Storage can be unavailable (private mode); the team just won't persist.
  }
}

export function TeamPage({roster, weighted}: {roster: MetaPokemon[]; weighted: boolean}) {
  const [text, setText] = useState(loadSaved);
  const tables = useLookupTables();
  // Shared by the speed tiers and the threat list.
  const [speedMode, setSpeedMode] = useState<SpeedMode>('normal');

  const parsed = useMemo(
    () => (tables ? parseTeam(text, tables.species, tables.moves) : {members: [], warnings: []}),
    [text, tables],
  );
  const team = parsed.members;
  const defense = useMemo(() => defensiveChart(team), [team]);
  const attackTypes = useMemo(() => teamAttackTypes(team), [team]);
  const speeds = useMemo(() => teamSpeeds(team, roster, weighted, speedMode), [team, roster, weighted, speedMode]);
  const legality = useMemo(() => checkLegality(team), [team]);
  const roles = useMemo(() => teamRoles(team), [team]);
  const threats = useMemo(
    () => (tables ? threatList(team, roster, tables.moves, speedMode) : []),
    [team, roster, tables, speedMode],
  );
  const teammates = useMemo(
    () => (tables ? suggestTeammates(team, roster, tables.species, tables.moves, speedMode) : []),
    [team, roster, tables, speedMode],
  );

  const update = (value: string) => {
    setText(value);
    save(value);
  };

  return (
    <>
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
            <p className="legal-ok">✓ No rule problems found (stat points, items, species, abilities, moves).</p>
          ))}
      </Panel>

      {team.length > 0 && (
        <>
          <Panel id="team-members" title="Team members" note={`${team.length} Pokémon`}>
            <TeamCards team={team} items={tables?.items ?? null} />
          </Panel>
          <RolesChecklist roles={roles} />
          <DefensiveChart team={team} rows={defense} />
          <ThreatList threats={threats} teamSize={team.length} />
          <TeammateSuggestions suggestions={teammates} teamSize={team.length} />

          <Panel id="attack-types" title="Your attacking types" note="from damaging moves">
            <div className="types">
              {attackTypes.length ? attackTypes.map(t => <TypeBadge key={t} type={t} />) : 'No damaging moves.'}
            </div>
          </Panel>

          <SpeedTiers speeds={speeds} roster={roster} mode={speedMode} onModeChange={setSpeedMode} />
        </>
      )}
    </>
  );
}
