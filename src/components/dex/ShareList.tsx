import type {ReactNode} from 'react';
import {pct} from '../CoverageSummary';

export interface ShareRow {
  key: string;
  label: ReactNode;
  share: number;
  /** Extra muted text under the label. */
  detail?: ReactNode;
  onClick?: () => void;
}

/** Rows of "label ··· 42.0%" with a proportional bar; clickable rows render as buttons. */
export function ShareList({rows, empty = 'No data.'}: {rows: ShareRow[]; empty?: string}) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  const top = Math.max(...rows.map(r => r.share)) || 1;
  return (
    <ul className="share-list">
      {rows.map(r => {
        const body = (
          <>
            <span className="share-label">
              {r.label}
              {r.detail && <span className="share-detail">{r.detail}</span>}
            </span>
            <span className="share-value">{pct(r.share)}</span>
            <span className="share-bar" style={{width: `${(r.share / top) * 100}%`}} aria-hidden />
          </>
        );
        return (
          <li key={r.key}>
            {r.onClick ? (
              <button className="share-row clickable" onClick={r.onClick}>
                {body}
              </button>
            ) : (
              <div className="share-row">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
