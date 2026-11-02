import type {TeamMember} from '../lib/paste';
import type {DefensiveRow} from '../lib/team';
import {TypeBadge} from './TypeBadge';
import {Panel} from './Panel';

const FRACTIONS: Record<number, string> = {0.25: '¼', 0.5: '½', 0.375: '⅜', 0.125: '⅛'};
const fmt = (m: number) => (m === 1 ? '' : FRACTIONS[m] ?? `${Number(m.toFixed(2))}`);
const cellClass = (m: number) => (m === 0 ? 'def-immune' : m < 1 ? 'def-resist' : m > 1 ? 'def-weak' : '');

export function DefensiveChart({team, rows}: {team: TeamMember[]; rows: DefensiveRow[]}) {
  const shared = rows.filter(r => r.shared);
  const risky = rows.filter(r => !r.shared && r.weak >= 2 && r.weak > r.resist + r.immune);

  return (
    <Panel id="defense" title="Defensive weaknesses" note="damage taken from each attacking type, abilities included">
      {shared.length > 0 || risky.length > 0 ? (
        <div className="callouts">
          {shared.map(r => (
            <p key={r.type} className="callout bad">
              <TypeBadge type={r.type} /> Shared weakness: {r.weak} of {team.length} weak, only{' '}
              {r.resist + r.immune} can switch in.
            </p>
          ))}
          {risky.map(r => (
            <p key={r.type} className="callout warn">
              <TypeBadge type={r.type} /> {r.weak} weak vs {r.resist + r.immune} that resist or are immune.
            </p>
          ))}
        </div>
      ) : (
        <p className="muted">No shared weaknesses. 🎉</p>
      )}
      <div className="table-wrap">
        <table className="def-chart">
          <thead>
            <tr>
              <th>Attack</th>
              {team.map((m, i) => (
                <th key={i} className="num">
                  {m.label}
                </th>
              ))}
              <th className="num">Weak</th>
              <th className="num">Resist</th>
              <th className="num">Immune</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.type} className={r.shared ? 'shared' : ''}>
                <td>
                  <TypeBadge type={r.type} />
                </td>
                {r.mults.map((m, i) => (
                  <td key={i} className={`num ${cellClass(m)}`}>
                    {fmt(m)}
                  </td>
                ))}
                <td className="num">{r.weak || ''}</td>
                <td className="num">{r.resist || ''}</td>
                <td className="num">{r.immune || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
