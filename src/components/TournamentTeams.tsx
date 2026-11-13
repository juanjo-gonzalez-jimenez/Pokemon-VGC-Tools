import type {MetaPokemon} from '../data/types';
import {useTeamStore} from '../hooks/useSavedTeam';
import {importTeam} from '../lib/teams';
import {limitlessUrl, ordinal, recordText, teamName, toPaste, type TournamentTeam} from '../lib/tournaments';
import {PokemonIcon} from './Sprite';

const dateText = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {day: 'numeric', month: 'short'});

interface Props {
  teams: TournamentTeam[];
  /** Every legal Pokémon of the regulation, for the usual stat point spreads. */
  roster: MetaPokemon[];
}

/** Cards of tournament teams: placing, record, player, event, the six, and Open in Team tab. */
export function TournamentTeams({teams, roster}: Props) {
  const [, update] = useTeamStore();
  return (
    <ul className="tourney-grid">
      {teams.map(t => (
        <li key={`${t.event.id}:${t.player}`} className="tourney-card">
          <div className="tourney-head">
            <strong>
              {ordinal(t.placing)} · {recordText(t.record)}
            </strong>
            <a href={limitlessUrl(t)} target="_blank" rel="noreferrer" className="link">
              {t.playerName}
            </a>
          </div>
          <p className="tourney-event muted">
            <span title={t.event.name}>{t.event.name}</span>
            <span>
              {t.event.players} players · {dateText(t.event.date)}
            </span>
          </p>
          <ul className="tourney-mons">
            {t.members.map((m, i) => (
              <li key={i}>
                <a
                  href={`#/dex/${m.form}`}
                  title={`${m.formName}${m.item ? ` @ ${m.item}` : ''}\n${m.ability}${m.nature ? ` · ${m.nature}` : ''}\n${m.moves.join(' / ')}`}
                  aria-label={`${m.formName}${m.item ? ` @ ${m.item}` : ''}`}
                >
                  <PokemonIcon icon={m.icon} />
                </a>
              </li>
            ))}
          </ul>
          <button
            className="link"
            onClick={() => {
              update(s => importTeam(s, toPaste(t, roster), teamName(t)));
              window.location.hash = '#/team';
            }}
          >
            Open in Team tab
          </button>
        </li>
      ))}
    </ul>
  );
}
