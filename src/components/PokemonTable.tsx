import {useState} from 'react';
import {bucketOf, type PokemonCoverage} from '../lib/coverage';
import {pct} from './CoverageSummary';
import {TypeBadge} from './TypeBadge';

const multLabel = (m: number) => `${Number(m.toFixed(3))}×`;

export function PokemonTable({results}: {results: PokemonCoverage[]}) {
  const [wallsOnly, setWallsOnly] = useState(false);
  const rows = wallsOnly ? results.filter(r => r.buckets.resisted + r.buckets.immune > 0) : results;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Roster</h2>
        <label className="muted">
          <input type="checkbox" checked={wallsOnly} onChange={e => setWallsOnly(e.target.checked)} /> Only Pokémon
          that wall you
        </label>
      </div>
      <div className="table-wrap">
        <table>
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
                  <td>{r.pokemon.name}</td>
                  <td className="types">
                    {types.map(t => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </td>
                  <td className="num">{pct(r.pokemon.usage)}</td>
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
        {!rows.length && <p className="muted empty">Nothing walls this selection. 🎉</p>}
      </div>
    </section>
  );
}
