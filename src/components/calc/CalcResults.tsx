import {useState} from 'react';
import type {MoveResult} from '../../lib/calcset';
import {TypeBadge} from '../TypeBadge';

const fmt = (x: number) => x.toFixed(1);

interface Props {
  title: string;
  results: MoveResult[];
}

/** Each move's damage range and KO chance; click a move for the 16 rolls and the full line. */
export function CalcResults({title, results}: Props) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="panel calc-results">
      <h2>{title}</h2>
      {!results.length && <p className="muted">No moves set.</p>}
      <ul>
        {results.map(r => {
          const e = r.estimate;
          const isOpen = open === r.name;
          return (
            <li key={r.name}>
              <button className="calc-result" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.name)} disabled={!e || e.max <= 0}>
                <span className="calc-move">
                  {e && <TypeBadge type={e.type} />}
                  {r.name}
                  {e && e.priority > 0 && <span className="tag">priority</span>}
                </span>
                {!e ? (
                  <span className="muted">{r.name ? 'status or unknown move' : ''}</span>
                ) : e.max <= 0 ? (
                  <span className="muted">no damage</span>
                ) : (
                  <>
                    <span className="calc-range">
                      {fmt(e.min)} – {fmt(e.max)}%
                    </span>
                    <span className="calc-ko">{e.koText}</span>
                    <span className="calc-bar" aria-hidden>
                      <span className="calc-bar-min" style={{width: `${Math.min(100, e.min)}%`}} />
                      <span className="calc-bar-max" style={{width: `${Math.min(100, e.max)}%`}} />
                    </span>
                  </>
                )}
              </button>
              {isOpen && e && (
                <div className="calc-detail">
                  <p>{e.desc}</p>
                  <p className="muted small">Rolls (HP): {e.rolls.join(', ')}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
