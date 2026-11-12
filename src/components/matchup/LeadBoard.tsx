import {useMemo} from 'react';
import type {MetaPokemon, MoveTable} from '../../data/types';
import {koLabel, type Field} from '../../lib/damage';
import {leadBoard, type BoardHit, type BoardRow} from '../../lib/doubles';
import {weatherSpeedFactor} from '../../lib/exchange';
import type {TeamMember} from '../../lib/paste';
import {memberSpeed, metaSpeedSummary, mySpeedIn, theirSpeedIn, type SpeedMode} from '../../lib/team';
import {Panel} from '../Panel';

export interface LeadPicks {
  /** Indexes into your team. */
  yours: [number, number];
  /** Indexes into their six. */
  theirs: [number, number];
}

interface Props {
  team: TeamMember[];
  opponents: MetaPokemon[];
  moves: MoveTable;
  picks: LeadPicks;
  onPicks: (picks: LeadPicks) => void;
  mode: SpeedMode;
  /** A fixed field from the page's Field choice; Auto when omitted. */
  field?: Field;
}

const FIELD_NAMES: Record<string, string> = {
  rain: 'Rain', sun: 'Sun', sand: 'Sand', snow: 'Snow',
  grassy: 'Grassy Terrain', electric: 'Electric Terrain', psychic: 'Psychic Terrain', misty: 'Misty Terrain',
};

function Cell({hit, approx}: {hit: BoardHit | undefined; approx: boolean}) {
  if (!hit) return <td className="lb-none">—</td>;
  if (hit.redirectedTo) return <td className="lb-redirect" title={`Drawn in by ${hit.redirectedTo}`}>→ {hit.redirectedTo}</td>;
  const e = hit.estimate;
  if (!e) return <td className="lb-none">—</td>;
  if (hit.blocked) return <td className="lb-none" title="Priority move blocked here">blocked</td>;
  if (e.percent === 0) return <td className="lb-none">immune</td>;
  const range = `${approx ? '~' : ''}${Math.round(e.min)}–${Math.round(e.max)}%`;
  const ko = koLabel(e.percent);
  return (
    <td className={`lb-hit${e.max >= 100 ? ' lb-ko' : ''}`} title={e.desc || e.koText}>
      <span>{range}</span>
      <span className="lb-ko-label">{e.koText || ko}</span>
    </td>
  );
}

function Rows({rows, foes, approx, showShare}: {rows: BoardRow[]; foes: [string, string]; approx: boolean; showShare: boolean}) {
  const anyPartner = rows.some(r => r.partner);
  return (
    <div className="table-wrap">
      <table className="lead-board">
        <thead>
          <tr>
            <th>Attacker</th>
            <th>Move</th>
            <th>→ {foes[0]}</th>
            <th>→ {foes[1]}</th>
            {anyPartner && <th>Partner</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i > 0 && rows[i - 1].attacker !== r.attacker ? 'lb-break' : undefined}>
              <th scope="row">{i === 0 || rows[i - 1].attacker !== r.attacker ? r.attacker : ''}</th>
              <td className="lb-move">
                {r.move.name}
                {r.spread && <span className="tag">both foes</span>}
                {showShare && r.share < 1 && <span className="muted small"> {Math.round(r.share * 100)}% of sets</span>}
              </td>
              <Cell hit={r.foes[0]} approx={approx} />
              <Cell hit={r.foes[1]} approx={approx} />
              {anyPartner && <Cell hit={r.partner} approx={approx} />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeadBoard({team, opponents, moves, picks, onPicks, mode, field}: Props) {
  const {yours, theirs, board} = useMemo(() => {
    const y = picks.yours.map(i => team[i]) as [TeamMember, TeamMember];
    const t = picks.theirs.map(i => opponents[i]) as [MetaPokemon, MetaPokemon];
    return {yours: y, theirs: t, board: leadBoard(y, t, moves, field)};
  }, [picks, team, opponents, moves, field]);

  // Move order within a priority bracket: Speed, after weather abilities, Tailwind and Trick Room.
  const order = [
    ...board.yours.map((c, i) => ({name: c.name, speed: mySpeedIn(memberSpeed(yours[i]) * weatherSpeedFactor(c.ability, board.field), mode), usual: false})),
    ...board.theirs.map((c, i) => ({
      name: c.name,
      speed: theirSpeedIn(Math.floor(metaSpeedSummary(theirs[i]).common * weatherSpeedFactor(c.ability, board.field)), mode),
      usual: true,
    })),
  ].sort((a, b) => (mode === 'trickRoom' ? a.speed - b.speed : b.speed - a.speed));

  const fieldText = [board.field.weather, board.field.terrain].filter(Boolean).map(f => FIELD_NAMES[f]).join(', ') || 'No weather or terrain';
  const select = (side: 'yours' | 'theirs', slot: 0 | 1) => {
    const list = side === 'yours' ? team.map(m => m.label) : opponents.map(o => o.name);
    const current = picks[side];
    return (
      <select
        aria-label={`${side === 'yours' ? 'Your' : 'Their'} lead ${slot + 1}`}
        value={current[slot]}
        onChange={e => {
          const next = [...current] as [number, number];
          next[slot] = Number(e.target.value);
          // Picking the Pokémon already in the other slot swaps the two.
          if (next[0] === next[1]) next[1 - slot] = current[slot];
          onPicks({...picks, [side]: next});
        }}
      >
        {list.map((name, i) => (
          <option key={i} value={i}>
            {name}
          </option>
        ))}
      </select>
    );
  };

  return (
    <Panel id="lead-board" title="Lead vs lead" note="both of yours against two of theirs">
      <div className="lb-picks">
        <span className="muted">Your leads</span>
        {select('yours', 0)}
        {select('yours', 1)}
        <span className="muted">vs</span>
        {select('theirs', 0)}
        {select('theirs', 1)}
      </div>
      <ul className="lb-notes muted small">
        <li>Field: {fieldText}</li>
        <li>
          Speed order: {order.map(o => `${o.name} ${o.speed}${o.usual ? ' (usual)' : ''}`).join(' › ')}
          {mode === 'trickRoom' ? ' (Trick Room)' : ''}
        </li>
        {board.notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
      <h3 className="lb-title">Your attacks</h3>
      <Rows rows={board.mine} foes={[board.theirs[0].name, board.theirs[1].name]} approx={false} showShare={false} />
      <h3 className="lb-title">Their attacks</h3>
      <Rows rows={board.against} foes={[board.yours[0].name, board.yours[1].name]} approx showShare />
      <p className="muted small">
        Spread moves already include the 0.75× doubles penalty. Lightning Rod and Storm Drain pull single-target
        Electric and Water moves into their user. Their sets are averages from usage stats, so their numbers are
        approximate (~). Hover a cell for the full calc line.
      </p>
    </Panel>
  );
}
