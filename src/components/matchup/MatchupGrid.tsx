import type {MetaPokemon} from '../../data/types';
import {koLabel} from '../../lib/damage';
import {approx, type PairScore} from '../../lib/matchup';
import type {TeamMember} from '../../lib/paste';
import {Panel} from '../Panel';
import {PokemonLink} from '../PokemonLink';
import {PokemonIcon} from '../Sprite';

/** Colour band of a matchup: how much it favours you. */
const band = (total: number) => (total >= 0.65 ? 'good' : total >= 0.5 ? 'ok' : total >= 0.35 ? 'risky' : 'bad');

const order = (first: number) => (first > 0.5 ? '▲' : first < 0.5 ? '▼' : '=');

function describe(member: TeamMember, opp: MetaPokemon, s: PairScore): string {
  const mine = s.mine
    ? `${member.label}'s ${s.mine.move.name}${s.mine.priority > 0 ? ' (priority)' : ''} does ${approx(s.mine.percent)} (${koLabel(s.mine.percent)})`
    : `${member.label} can't damage ${opp.name}`;
  const theirs = s.theirs
    ? `${opp.name}'s ${s.theirs.move.name}${s.theirs.assumed ? ' (assumed, no usage data)' : ''} does ${approx(s.theirs.percent)} (${koLabel(s.theirs.percent)})`
    : `${opp.name} can't damage ${member.label}`;
  const first = s.first > 0.5 ? `${member.label} usually acts first` : s.first < 0.5 ? `${opp.name} usually acts first` : 'Speed is even';
  return `${mine}. ${theirs}. ${first}.`;
}

interface Props {
  team: TeamMember[];
  opponents: MetaPokemon[];
  grid: PairScore[][];
  iconOf: (member: TeamMember) => number | undefined;
}

export function MatchupGrid({team, opponents, grid, iconOf}: Props) {
  return (
    <Panel id="matchup-grid" title="Matchup grid" note="your Pokémon (rows) against theirs (columns)">
      <div className="table-wrap">
        <table className="matchup-grid">
          <thead>
            <tr>
              <th />
              {opponents.map(o => (
                <th key={o.id}>
                  <PokemonLink pokemon={o} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((m, i) => (
              <tr key={i}>
                <th scope="row">
                  <span className="pokemon-link">
                    <PokemonIcon icon={iconOf(m)} />
                    <span>{m.label}</span>
                  </span>
                </th>
                {opponents.map((o, j) => {
                  const s = grid[i][j];
                  return (
                    <td key={o.id} className={`mu mu-${band(s.total)}`} title={describe(m, o, s)}>
                      <span className="mu-out">{s.mine ? approx(s.mine.percent) : '—'}</span>
                      <span className="mu-in">{s.theirs ? approx(s.theirs.percent) : '—'}</span>
                      <span className="mu-speed">{order(s.first)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        In each cell: <strong>your best hit on it</strong> and its expected best hit on you (estimated % of HP, its
        moves weighted by how many sets run them), then ▲ if you usually act first (priority, then Speed) or ▼ if it
        does. Green means you win the one-on-one, red means it does. Hover a cell for the moves.
      </p>
    </Panel>
  );
}
