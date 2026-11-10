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
  note = 'estimated damage, usual sets',
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
              <th>Likely KOs (2 hits or fewer)</th>
              <th>Beaten by</th>
              <th className="num">Acts before</th>
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
                      {t.hits.map((h, k) => (
                        <span key={h.label} title={`${h.move} ~${Math.round(h.percent)}%`}>
                          {k > 0 && ', '}
                          {h.label}
                          <span className="muted"> ({h.hitsToKO === 1 ? 'OHKO' : '2HKO'})</span>
                        </span>
                      ))}
                    </>
                  ) : (
                    <span className="muted">none</span>
                  )}
                </td>
                <td className={`notes ${t.answers.length ? '' : 'no-answer'}`}>
                  {t.answers.length ? t.answers.join(', ') : 'Nobody wins the one-on-one'}
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
        From estimated damage with its usual sets: how many of your Pokémon it likely KOs in two hits or fewer, how
        few of yours beat it one-on-one, and how many it acts before (priority, then Speed, in the current speed mode),
        weighted by usage. Hover a name for the move and estimate.
      </p>
    </Panel>
  );
}
