import {useId, useState, type ReactNode} from 'react';
import {COLLAPSED_KEY, parseCollapsed, toggleCollapsed} from '../lib/collapsed';
import {Icon} from './Icon';

function readCollapsed(): string[] {
  try {
    return parseCollapsed(localStorage.getItem(COLLAPSED_KEY));
  } catch {
    return [];
  }
}

/** Open/closed state of one panel, remembered across visits. */
function useCollapsed(id: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => readCollapsed().includes(id));
  const toggle = () => {
    setCollapsed(c => !c);
    try {
      // Re-read so panels toggled elsewhere on the page aren't overwritten.
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(toggleCollapsed(readCollapsed(), id)));
    } catch {
      // Storage unavailable: the panel still toggles, it just won't be remembered.
    }
  };
  return [collapsed, toggle];
}

interface Props {
  /** Stable id used to remember whether the panel is collapsed. */
  id: string;
  title: ReactNode;
  /** Muted text on the right of the header, visible even when collapsed. */
  note?: ReactNode;
  /** Controls in the header (buttons, checkboxes); clicking them doesn't toggle the panel. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A titled panel that folds up to its header when the title is clicked. */
export function Panel({id, title, note, actions, children}: Props) {
  const [collapsed, toggle] = useCollapsed(id);
  const bodyId = useId();
  return (
    <section className={`panel${collapsed ? ' collapsed' : ''}`}>
      <div className="panel-head">
        <h2>
          <button className="panel-toggle" aria-expanded={!collapsed} aria-controls={bodyId} onClick={toggle}>
            <span className="chevron">
              <Icon name="chevron" size={14} />
            </span>
            {title}
          </button>
        </h2>
        {(note || actions) && (
          <span className="muted">
            {note}
            {!collapsed && actions}
          </span>
        )}
      </div>
      {!collapsed && <div id={bodyId}>{children}</div>}
    </section>
  );
}
