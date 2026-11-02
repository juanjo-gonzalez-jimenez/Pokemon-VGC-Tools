import type {Suggestion} from '../lib/suggest';
import type {TypeName} from '../lib/typechart';
import {pct} from './CoverageSummary';
import {TypeBadge} from './TypeBadge';
import {Panel} from './Panel';

const signed = (x: number) => `${x >= 0 ? '+' : '−'}${pct(Math.abs(x))}`;

interface Props {
  suggestions: Suggestion[];
  canAdd: boolean;
  onAdd: (type: TypeName) => void;
}

export function Suggestions({suggestions, canAdd, onAdd}: Props) {
  return (
    <Panel id="type-suggestions" title="Best type to add" note={canAdd ? 'click to add' : 'remove a type to try others'}>
      <ol className="suggestions">
        {suggestions.slice(0, 6).map(s => (
          <li key={s.type}>
            <button className="suggestion" disabled={!canAdd} onClick={() => onAdd(s.type)}>
              <TypeBadge type={s.type} />
              <span className="gain good">{signed(s.superGain)} super effective</span>
              <span className={`gain ${s.walledChange <= 0 ? 'good' : 'bad'}`}>{signed(s.walledChange)} walled</span>
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
