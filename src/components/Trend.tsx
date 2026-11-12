import {STEADY, usageTrend, type TrendInput} from '../lib/dex';
import {pct} from './CoverageSummary';

/** "▲ 12.9" / "▼ 3.1" / "new": change in usage since last month, in percentage points. */
export function Trend({pokemon}: {pokemon: TrendInput}) {
  const t = usageTrend(pokemon);
  if (!t) return null;
  const title = `Last month ${pct(t.previous, 1)}, now ${pct(pokemon.usage, 1)}`;
  if (t.isNew) return <span className="trend trend-up" title={title}>new</span>;
  if (Math.abs(t.change) < STEADY) return <span className="trend trend-flat" title={title}>=</span>;
  const up = t.change > 0;
  return (
    <span className={`trend ${up ? 'trend-up' : 'trend-down'}`} title={title}>
      {up ? '▲' : '▼'} {(Math.abs(t.change) * 100).toFixed(1)}
    </span>
  );
}
