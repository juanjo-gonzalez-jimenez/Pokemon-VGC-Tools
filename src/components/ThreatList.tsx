import type {Threat} from '../lib/threats';
import {pct} from './CoverageSummary';
import {Panel} from './Panel';
import {PokemonLink} from './PokemonLink';

interface Props {
  threats: Threat[];
  teamSize: number;
  id?: string;
  title?: string;
  note?: string;
}

export function ThreatList({
  threats,
  teamSize,
  id = 'threats',
  title = 'Biggest threats',
  note = 'type + speed heuristic, no damage calc',
}: Props) {
  return (
    <Panel id={id} title={title} note={note}>
      <div className="table-wrap">
        <table className="threats">
          <thead>
            <tr>
              <th>Pokémon</th>
              <th className="num">Usage</th>
              <th>Threat</th>
              <th>Hits super effectively</th>
              <th>Your answers</th>
              <th className="num">Faster than</th>
            </tr>
          </thead>
          <tbody>
            {threats.map(t => (
              <tr key={t.pokemon.id}>
                <td>
                  <PokemonLink pokemon={t.pokemon} />
                </td>
                <td className="num">{pct(t.pokemon.usage)}</td>
                <td>
                  <div className="severity" title={`Severity ${pct(t.severity, 0)}`}>
                    <div style={{width: pct(t.severity, 0)}} />
                  </div>
                </td>
                <td className="notes">
                  {t.hits.length ? (
                    <>
                      <strong>
                        {t.hits.length}/{teamSize}
                      </strong>{' '}
                      {t.hits.map(h => h.label).join(', ')}
                    </>
                  ) : (
                    <span className="muted">none</span>
                  )}
                </td>
                <td className={`notes ${t.answers.length ? '' : 'no-answer'}`}>
                  {t.answers.length ? t.answers.join(', ') : 'Nobody hits it super effectively'}
                </td>
                <td className="num">
                  {t.fasterThan.length}/{teamSize}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Ranked by how many of your Pokémon it hits super effectively with moves most of its sets run (50%+), how few of yours hit it super effectively, and how many it outspeeds in the current speed mode,
        weighted by usage.
      </p>
    </Panel>
  );
}
