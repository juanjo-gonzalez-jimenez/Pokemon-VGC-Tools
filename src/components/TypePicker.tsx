import {TYPES, type TypeName} from '../lib/typechart';
import {TYPE_COLORS} from './TypeBadge';
import {Panel} from './Panel';

export const MAX_TYPES = 4;

interface Props {
  selected: TypeName[];
  onChange: (types: TypeName[]) => void;
}

export function TypePicker({selected, onChange}: Props) {
  const full = selected.length >= MAX_TYPES;
  const toggle = (t: TypeName) =>
    onChange(selected.includes(t) ? selected.filter(s => s !== t) : [...selected, t]);

  return (
    <Panel
      id="move-types"
      title="Move types"
      note={`${selected.length}/${MAX_TYPES} selected`}
      actions={
        selected.length > 0 && (
          <button className="link" onClick={() => onChange([])}>
            Clear
          </button>
        )
      }
    >
      <div className="type-grid">
        {TYPES.map(t => {
          const on = selected.includes(t);
          return (
            <button
              key={t}
              className={`type-button${on ? ' on' : ''}`}
              style={{'--type-color': TYPE_COLORS[t]} as React.CSSProperties}
              disabled={!on && full}
              aria-pressed={on}
              onClick={() => toggle(t)}
            >
              {t}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
