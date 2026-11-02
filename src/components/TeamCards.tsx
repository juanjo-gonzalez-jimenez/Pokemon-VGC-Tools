import type {TeamMember} from '../lib/paste';
import {moveType} from '../lib/moves';
import {STAT_LABELS, STATS} from '../lib/stats';
import {memberSpeed} from '../lib/team';
import {TypeBadge} from './TypeBadge';

const spSummary = (m: TeamMember) =>
  STATS.filter(s => m.sp[s] > 0)
    .map(s => `${m.sp[s]} ${STAT_LABELS[s]}`)
    .join(' / ') || 'No stat points';

export function TeamCards({team}: {team: TeamMember[]}) {
  return (
    <div className="team-cards">
      {team.map((m, i) => (
        <article key={i} className="team-card">
          <header>
            <strong>{m.label}</strong>
            {m.label !== m.species.name && <span className="muted"> ({m.species.name})</span>}
            {m.isMega && <span className="tag">Mega</span>}
          </header>
          <div className="types">
            {m.species.types.map(t => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
          <dl>
            <dt>Item</dt>
            <dd>{m.item || '—'}</dd>
            <dt>Ability</dt>
            <dd>{m.ability || '—'}</dd>
            <dt>Spread</dt>
            <dd>
              {m.nature} · {spSummary(m)}
            </dd>
            <dt>Speed</dt>
            <dd>{memberSpeed(m)}</dd>
          </dl>
          <ul className="moves">
            {m.moves.map(move => (
              <li key={move.name}>
                <TypeBadge type={moveType(move, m.ability)} /> {move.name}
                {move.category === 'Status' && <span className="muted"> (status)</span>}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
