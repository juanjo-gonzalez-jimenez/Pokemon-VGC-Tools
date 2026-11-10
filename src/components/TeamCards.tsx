import type {TeamMember} from '../lib/paste';
import {moveType} from '../lib/moves';
import {STAT_LABELS, STATS} from '../lib/stats';
import {memberSpeed} from '../lib/team';
import type {ItemTable} from '../data/types';
import {ItemIcon, Sprite} from './Sprite';
import {TypeBadge, typingVars} from './TypeBadge';
import {spriteId} from '../lib/sprites';
import {toID} from '../lib/ids';

const spSummary = (m: TeamMember) =>
  STATS.filter(s => m.sp[s] > 0)
    .map(s => `${m.sp[s]} ${STAT_LABELS[s]}`)
    .join(' / ') || 'No stat points';

export function TeamCards({team, items}: {team: TeamMember[]; items: ItemTable | null}) {
  return (
    <div className="team-cards">
      {team.map((m, i) => (
        <article key={i} className="team-card" style={typingVars(m.species.types)}>
          <header className="team-card-head">
            <Sprite
              sprite={spriteId(m.species.name, m.species.baseSpecies)}
              baseSprite={m.species.baseSpecies ? toID(m.species.baseSpecies) : undefined}
            />
            <div>
              <strong>{m.label}</strong>
              {m.label !== m.species.name && <span className="muted"> ({m.species.name})</span>}
              {m.isMega && <span className="tag">Mega</span>}
              <div className="types">
                {m.species.types.map(t => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
            </div>
          </header>
          <dl>
            <dt>Item</dt>
            <dd className="item-line">
              {m.item ? (
                <>
                  <ItemIcon item={m.item} items={items} /> {m.item}
                </>
              ) : (
                '—'
              )}
            </dd>
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
