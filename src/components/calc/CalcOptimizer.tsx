import {useState} from 'react';
import type {MoveTable, SpeciesData} from '../../data/types';
import type {CalcSet, CalcState} from '../../lib/calcset';
import {toID} from '../../lib/ids';
import {candidateNatures, effectiveSpeed, optimizeSpread, type OptimizeFailure, type OptimizeResult} from '../../lib/optimizer';
import {STAT_LABELS, STATS, type StatName} from '../../lib/stats';
import {Panel} from '../Panel';

type Side = 'a' | 'b';
interface SideData {
  set: CalcSet;
  species: SpeciesData;
}

interface Props {
  a: SideData;
  b: SideData;
  moves: MoveTable;
  state: CalcState;
  onApply: (side: Side, set: CalcSet) => void;
}

const spreadText = (r: OptimizeResult) =>
  `${r.nature} · ${STATS.filter(s => r.sp[s] > 0)
    .map(s => `${r.sp[s]} ${STAT_LABELS[s]}`)
    .join(' / ') || 'no points'}`;

/** Finds the fewest stat points for one side to survive the other's attacks and outspeed it. */
export function CalcOptimizer({a, b, moves, state, onApply}: Props) {
  const [side, setSide] = useState<Side>('a');
  const [picked, setPicked] = useState<string[]>([]);
  const [speedGoal, setSpeedGoal] = useState<'none' | 'other' | 'custom'>('none');
  const [customSpeed, setCustomSpeed] = useState(100);
  const [natureFree, setNatureFree] = useState(false);
  const [result, setResult] = useState<OptimizeResult | OptimizeFailure | null>(null);

  const me = side === 'a' ? a : b;
  const them = side === 'a' ? b : a;
  const theirMoves = them.set.moves.map(n => moves[toID(n)]).filter(m => m && m.category !== 'Status');
  const chosen = theirMoves.filter(m => picked.includes(m.name));
  const otherSpeed = effectiveSpeed(them.set, them.species);
  const target = speedGoal === 'other' ? otherSpeed : speedGoal === 'custom' ? customSpeed : undefined;

  const run = () => {
    // Natures that don't lower a goal stat or a stat this set attacks with.
    const attacks = me.set.moves.map(n => moves[toID(n)]?.category);
    const protect: StatName[] = ['hp', 'def', 'spd', ...(target ? (['spe'] as const) : [])];
    if (attacks.includes('Physical')) protect.push('atk');
    if (attacks.includes('Special')) protect.push('spa');
    setResult(
      optimizeSpread({
        set: me.set,
        species: me.species,
        attacker: them,
        survive: chosen,
        outspeed: target,
        natures: natureFree ? candidateNatures(me.set.nature, protect) : undefined,
        field: state.field,
        attackerSide: state.sides[side === 'a' ? 'b' : 'a'],
        defenderSide: state.sides[side],
        singleTarget: state.singleTarget,
      }),
    );
  };
  const reset = (next: Side) => {
    setSide(next);
    setPicked([]);
    setResult(null);
  };

  return (
    <Panel id="calc-optimizer" title="Spread optimizer" note="fewest stat points for your goals">
      <div className="opt-form">
        <label className="opt-row">
          <span className="calc-label">Optimize</span>
          <select value={side} onChange={e => reset(e.target.value as Side)}>
            <option value="a">{a.species.name} (A)</option>
            <option value="b">{b.species.name} (B)</option>
          </select>
        </label>
        <fieldset className="opt-row">
          <legend className="calc-label">Survive from full HP (every roll)</legend>
          {theirMoves.length ? (
            theirMoves.map(m => (
              <label key={m.name} className="check">
                <input
                  type="checkbox"
                  checked={picked.includes(m.name)}
                  onChange={e => setPicked(p => (e.target.checked ? [...p, m.name] : p.filter(x => x !== m.name)))}
                />
                {them.species.name}’s {m.name}
              </label>
            ))
          ) : (
            <span className="muted small">{them.species.name} has no damaging moves set.</span>
          )}
        </fieldset>
        <fieldset className="opt-row">
          <legend className="calc-label">Outspeed</legend>
          <select value={speedGoal} onChange={e => setSpeedGoal(e.target.value as typeof speedGoal)}>
            <option value="none">No Speed goal</option>
            <option value="other">
              {them.species.name} ({otherSpeed})
            </option>
            <option value="custom">A Speed of…</option>
          </select>
          {speedGoal === 'custom' && (
            <input
              type="number"
              min={1}
              max={999}
              value={customSpeed}
              aria-label="Speed to beat"
              onChange={e => setCustomSpeed(Math.max(1, Number(e.target.value) || 1))}
            />
          )}
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={natureFree} onChange={e => setNatureFree(e.target.checked)} />
          Allow a different nature
        </label>
        <button className="primary" onClick={run} disabled={!chosen.length && !target}>
          Find spread
        </button>
      </div>
      <p className="muted small">
        Uses everything set above: items, abilities, boosts, burn, crits, field and side conditions. Stats that aren’t
        goals keep their points; Speed includes boosts and Choice Scarf.
      </p>
      {result &&
        ('reason' in result ? (
          <p className="calc-warning">{result.reason}</p>
        ) : (
          <div className="opt-result">
            <strong>{spreadText(result)}</strong>
            <ul>
              {result.checks.map(c => (
                <li key={c.move}>
                  Survives {c.move}: up to {c.maxPercent.toFixed(1)}%
                </li>
              ))}
              {target !== undefined && (
                <li>
                  Speed {result.speed} beats {target}
                </li>
              )}
              <li>
                {result.left} stat point{result.left === 1 ? '' : 's'} left to spend
              </li>
            </ul>
            <button
              className="primary"
              onClick={() => {
                onApply(side, {...me.set, nature: result.nature, sp: result.sp});
                setResult(null);
              }}
            >
              Apply to {me.species.name}
            </button>
          </div>
        ))}
    </Panel>
  );
}
