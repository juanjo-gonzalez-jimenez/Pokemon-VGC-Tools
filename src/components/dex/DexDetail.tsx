import type {ReactNode} from 'react';
import type {ItemTable, MetaPokemon, MoveTable} from '../../data/types';
import {abilityEffect} from '../../lib/abilities';
import {bst, formatSpread} from '../../lib/dex';
import {toID} from '../../lib/ids';
import {moveType} from '../../lib/moves';
import {calcStat, NATURES, STAT_LABELS, STATS} from '../../lib/stats';
import {metaSpeedSummary} from '../../lib/team';
import {mainAbility} from '../../lib/threats';
import {pct} from '../CoverageSummary';
import {ItemIcon, PokemonIcon, Sprite} from '../Sprite';
import {TypeBadge, typingVars} from '../TypeBadge';
import {ShareList, type ShareRow} from './ShareList';

const TOP_TEAMMATES = 15;

const range = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

/** Bar colour by base stat value. */
const statClass = (v: number) => (v < 60 ? 'low' : v < 90 ? 'mid' : v < 120 ? 'good' : 'great');

/** A fixed-height dashboard tile; content that doesn't fit scrolls inside the tile. */
function Tile({title, note, children}: {title: string; note?: ReactNode; children: ReactNode}) {
  return (
    <section className="tile">
      <header>
        <h3>{title}</h3>
        {note && <span className="muted">{note}</span>}
      </header>
      <div className="tile-body" tabIndex={0} aria-label={`${title} (scrollable)`}>
        {children}
      </div>
    </section>
  );
}

interface Props {
  pokemon: MetaPokemon;
  /** Usage rank at the rating cutoff; undefined when it has no data there. */
  rank: number | undefined;
  /** The regulation's rating cutoff, for labels. */
  cutoff: number;
  roster: MetaPokemon[];
  moves: MoveTable | null;
  items: ItemTable | null;
  /** Abilities the species can have (shown when there's no usage data). */
  possibleAbilities: string[];
  onSelect: (id: string) => void;
}

export function DexDetail({pokemon: p, rank, cutoff, roster, moves, items, possibleAbilities, onSelect}: Props) {
  const noData = p.source === 'none';
  const types = p.forms[0]?.types ?? [];
  const ability = mainAbility(p);
  const speed = metaSpeedSummary(p);
  const byName = new Map(roster.map(r => [r.name, r]));
  const rows = (shares: Record<string, number>, build?: (name: string) => Partial<ShareRow>): ShareRow[] =>
    Object.entries(shares)
      .sort((a, b) => b[1] - a[1])
      .map(([name, share]) => ({key: name, label: name, share, ...build?.(name)}));

  const moveRows = rows(p.moves, name => {
    const move = moves?.[toID(name)];
    if (!move) return {};
    return {
      label: (
        <>
          <TypeBadge type={moveType(move, ability)} /> {name}
        </>
      ),
      detail: move.category === 'Status' ? 'Status' : `${move.category} · ${move.basePower || '—'} BP`,
    };
  });

  const natureRows = rows(p.natures, name => {
    const effect = NATURES[name];
    return {detail: effect ? `+${STAT_LABELS[effect[0]]} −${STAT_LABELS[effect[1]]}` : 'neutral'};
  });

  const abilityRows = noData
    ? possibleAbilities.map(name => ({key: name, label: name, share: 0, detail: abilityEffect(name)?.note}))
    : rows(p.forms[0]?.abilities ?? {}, name => ({detail: abilityEffect(name)?.note}));

  const teammateRows = rows(p.teammates, name => {
    const mate = byName.get(name);
    if (!mate) return {};
    return {
      label: (
        <>
          <PokemonIcon icon={mate.icon} /> {name}
        </>
      ),
      onClick: () => onSelect(mate.id),
    };
  }).slice(0, TOP_TEAMMATES);

  const itemRows = rows(p.items, name => ({
    label: (
      <>
        <ItemIcon item={name} items={items} /> {name}
      </>
    ),
  }));

  const spreadRows: ShareRow[] = Object.entries(p.spreads)
    .sort((a, b) => b[1] - a[1])
    .flatMap(([key, share]) => {
      const s = formatSpread(key, p.baseStats);
      if (!s) return [];
      return [{
        key,
        label: (
          <>
            <strong>{s.nature}</strong> {s.text}
          </>
        ),
        detail: STATS.map(stat => s.stats[stat]).join(' / '),
        share,
      }];
    });

  return (
    <div className="dex-detail">
      <header className="dex-head" style={typingVars(types)}>
        <div className="dex-identity">
          <Sprite key={p.id} sprite={p.sprite} baseSprite={p.baseSprite} size={88} />
          <div>
            <h2>{p.name}</h2>
            <div className="types">
              {types.map(t => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
        </div>
        <dl className="dex-facts">
          <div>
            <dt>{p.source === 'all' ? 'Usage (all ratings)' : 'Usage'}</dt>
            <dd>{noData ? '—' : pct(p.usage, p.usage < 0.001 ? 3 : 1)}</dd>
          </div>
          <div>
            <dt>Rank</dt>
            <dd>{rank ? `#${rank}` : '—'}</dd>
          </div>
          <div>
            <dt>Base stat total</dt>
            <dd>{bst(p.baseStats)}</dd>
          </div>
        </dl>
      </header>

      {p.source && (
        <p className="dex-source">
          {p.source === 'all'
            ? `Too rare in ${cutoff}+ rated battles, so moves, items, spreads and teammates below come from all ratings.`
            : 'Legal, but nobody used it in this month’s stats: only base data is available.'}
        </p>
      )}

      <div className="tiles">
        <Tile title="Base stats" note={`Total ${bst(p.baseStats)}`}>
          <ul className="base-stats">
            {STATS.map(s => (
              <li key={s}>
                <span className="muted">{STAT_LABELS[s]}</span>
                <strong>{p.baseStats[s]}</strong>
                <span className="stat-track">
                  <span
                    className={`stat-fill ${statClass(p.baseStats[s])}`}
                    style={{width: `${Math.min(100, (p.baseStats[s] / 200) * 100)}%`}}
                  />
                </span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {noData ? (
              <>
                Possible Speed{' '}
                {range(calcStat('spe', p.baseStats.spe, 0, 'Brave'), calcStat('spe', p.baseStats.spe, 32, 'Jolly'))}{' '}
                (0 points with a −Spe nature to 32 points with a +Spe nature)
              </>
            ) : (
              <>
                In-battle Speed {range(speed.min, speed.max)}
            {speed.scarf >= 0.05 &&
              ` · ${range(speed.scarfMin, speed.scarfMax)} with Choice Scarf (${pct(speed.scarf, 0)} of sets)`}
              </>
            )}
          </p>
        </Tile>

        <Tile title="Moves" note="share of sets">
          <ShareList rows={moveRows} />
        </Tile>

        <Tile title="Items">
          <ShareList rows={itemRows} />
        </Tile>

        <Tile title={noData ? 'Possible abilities' : 'Abilities'}>
          {noData ? (
            <ul className="share-list">
              {abilityRows.map(r => (
                <li key={r.key} className="share-row">
                  <span className="share-label">
                    {r.label}
                    {r.detail && <span className="share-detail">{r.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ShareList rows={abilityRows} />
          )}
        </Tile>

        <Tile title="Natures">
          <ShareList rows={natureRows} />
        </Tile>

        <Tile title="Stat point spreads" note="stats at Lv. 50">
          <ShareList rows={spreadRows} />
        </Tile>

        <Tile title="Teammates" note="share of its teams · click to open">
          <ShareList rows={teammateRows} />
        </Tile>
      </div>
    </div>
  );
}
