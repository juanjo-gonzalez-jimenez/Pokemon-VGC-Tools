import type {MetaPokemon} from '../../data/types';
import type {PairScore} from '../../lib/matchup';
import type {TeamMember} from '../../lib/paste';
import {Panel} from '../Panel';
import {PokemonLink} from '../PokemonLink';
import {PokemonIcon} from '../Sprite';

const FRACTIONS: Record<number, string> = {0.25: '¼', 0.5: '½', 0.125: '⅛'};
const mult = (m: number) => `${FRACTIONS[m] ?? Number(m.toFixed(2))}×`;

/** Colour band of a matchup: how much it favours you. */
const band = (total: number) => (total >= 0.65 ? 'good' : total >= 0.5 ? 'ok' : total >= 0.35 ? 'risky' : 'bad');

function describe(member: TeamMember, opp: MetaPokemon, s: PairScore): string {
  const speed =
    s.faster === null ? 'Speed unknown' : s.faster > 0.5 ? 'you move first' : s.faster < 0.5 ? 'it moves first' : 'Speed is even';
  return `${member.label} hits ${opp.name} for ${mult(s.myMult)}; ${opp.name}'s common moves hit back for ${mult(s.theirMult)}; ${speed}.`;
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
                      <span className="mu-out">{mult(s.myMult)}</span>
                      <span className="mu-in">{mult(s.theirMult)}</span>
                      <span className="mu-speed">{s.faster === null ? '?' : s.faster > 0.5 ? '▲' : s.faster < 0.5 ? '▼' : '='}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        In each cell: <strong>your best hit on it</strong>, then its best common hit on you (moves on 50%+ of its
        sets), then ▲ if you usually move first or ▼ if it does. Green favours you, red favours them. Hover a cell for
        the sentence.
      </p>
    </Panel>
  );
}
