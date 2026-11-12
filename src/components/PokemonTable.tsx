import {useState} from 'react';
import {bucketOf, type PokemonCoverage} from '../lib/coverage';
import {pct} from './CoverageSummary';
import {TypeBadge} from './TypeBadge';
import {Panel} from './Panel';
import {PokemonLink} from './PokemonLink';
import {Trend} from './Trend';

const multLabel = (m: number) => `${Number(m.toFixed(3))}×`;

interface Props {
  results: PokemonCoverage[];
  title?: string;
  defaultWallsOnly?: boolean;
}

export function PokemonTable({results, title = 'Roster', defaultWallsOnly = false}: Props) {
  const [wallsOnly, setWallsOnly] = useState(defaultWallsOnly);
  const rows = wallsOnly ? results.filter(r => r.buckets.resisted + r.buckets.immune > 0) : results;

  return (
    <Panel
      id={`table-${title}`}
      title={title}
      actions={
        <label>
          <input type="checkbox" checked={wallsOnly} onChange={e => setWallsOnly(e.target.checked)} /> Only Pokémon
          that wall you
        </label>
      }
    >
      <div className="table-wrap">
        <table className="roster-table">
          <thead>
            <tr>
              <th>Pokémon</th>
              <th>Types</th>
              <th className="num">Usage</th>
              <th className="num">Best hit</th>
              <th>With</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const {main} = r;
              const alternatives = r.scenarios.filter(s => bucketOf(s.mult) !== bucketOf(main.mult));
              const types = r.pokemon.forms.find(f => f.name === main.form)?.types ?? [];
              return (
                <tr key={r.pokemon.id}>
                  <td>
                    <PokemonLink pokemon={r.pokemon} />
                  </td>
                  <td className="types">
                    {types.map(t => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </td>
                  <td className="num">
                    {pct(r.pokemon.usage)}
                    <Trend pokemon={r.pokemon} />
                  </td>
                  <td className={`num mult bucket-${bucketOf(main.mult)}`}>{multLabel(main.mult)}</td>
                  <td className="types">
                    {main.bestTypes.map(t => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </td>
                  <td className="notes">
                    {main.note && (
                      <div>
                        {main.ability}: {main.note}
                      </div>
                    )}
                    {r.varies &&
                      alternatives.map(s => (
                        <div key={`${s.form}-${s.ability}`} className="muted">
                          {pct(s.weight, 0)} run {s.ability || 'other'} → {multLabel(s.mult)}
                          {s.note ? ` (${s.note})` : ''}
                        </div>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="muted empty">Nothing walls this selection.</p>}
      </div>
    </Panel>
  );
}
