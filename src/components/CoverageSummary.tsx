import {BUCKETS, type Bucket} from '../lib/coverage';
import {Panel} from './Panel';

export const BUCKET_LABELS: Record<Bucket, string> = {
  super: 'Super effective',
  neutral: 'Neutral',
  resisted: 'Resisted',
  immune: 'Immune',
};

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

export function CoverageSummary({buckets, weighted}: {buckets: Record<Bucket, number>; weighted: boolean}) {
  return (
    <Panel id="coverage" title="Coverage" note={weighted ? 'weighted by usage' : 'each Pokémon counts equally'}>
      <div className="stat-row">
        {BUCKETS.map(b => (
          <div key={b} className={`stat bucket-${b}`}>
            <div className="stat-value">{pct(buckets[b])}</div>
            <div className="stat-label">{BUCKET_LABELS[b]}</div>
          </div>
        ))}
      </div>
      <div className="bar" role="img" aria-label="Coverage breakdown">
        {BUCKETS.map(b =>
          buckets[b] > 0 ? (
            <div key={b} className={`bar-seg bucket-${b}`} style={{flexGrow: buckets[b]}} title={`${BUCKET_LABELS[b]}: ${pct(buckets[b])}`} />
          ) : null,
        )}
      </div>
    </Panel>
  );
}
