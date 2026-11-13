import {useId, useRef, useState, type ReactNode} from 'react';
import {toID} from '../../lib/ids';
import {pct} from '../CoverageSummary';

const MAX_RESULTS = 8;

export interface PickerOption {
  name: string;
  /** Share of this Pokémon's sets using it (usage stats), shown on the right. */
  share?: number;
}

interface Props {
  value: string;
  onChange: (name: string) => void;
  /** Everything that can be searched, sorted. */
  names: string[];
  /** Offered as soon as the box is clicked (this Pokémon's usual picks, most used first). */
  usual: PickerOption[];
  /** Label of the empty choice ("No item", "No move"). */
  emptyLabel: string;
  /** Hint in the empty box; the empty choice's label when omitted. */
  placeholder?: string;
  /** Icon in front of an option; null for none. */
  renderIcon: (name: string) => ReactNode;
  /** Also show the icon in front of the closed box (off where space is tight). */
  iconInBox?: boolean;
  /** Extra detail after an option's name (e.g. a move's power). */
  renderDetail?: (name: string) => ReactNode;
  label: string;
  maxLength: number;
  className?: string;
  /**
   * List every name, not just the first few: the usual picks first, then all the others A–Z
   * (e.g. every move the Pokémon can learn). The list scrolls.
   */
  showAll?: boolean;
}

/** Names matching `query`: the ones starting with it first, then ones containing it. */
export function searchNames(names: string[], query: string, limit = MAX_RESULTS): string[] {
  const q = toID(query);
  const starts = names.filter(n => toID(n).startsWith(q));
  const contains = names.filter(n => !toID(n).startsWith(q) && toID(n).includes(q));
  return [...starts, ...contains].slice(0, limit);
}

/**
 * What an empty search offers: the empty choice and the usual picks, plus (with `showAll`)
 * every other name A–Z. `others` is the index where those others start, for a divider.
 */
export function browseOptions(names: string[], usual: PickerOption[], showAll: boolean): {options: PickerOption[]; others: number} {
  const top = [{name: ''}, ...(showAll ? usual : usual.slice(0, MAX_RESULTS))];
  if (!showAll) return {options: top, others: -1};
  const seen = new Set(usual.map(o => o.name));
  const rest = names.filter(n => !seen.has(n)).sort((a, b) => a.localeCompare(b));
  return {options: [...top, ...rest.map(name => ({name}))], others: rest.length ? top.length : -1};
}

/**
 * Search dropdown in the style of the Pokémon search: click it to see the usual picks, type to
 * search everything, pick with the mouse or ↑/↓ and Enter. Esc or clicking away keeps the value.
 */
export function SearchPicker({value, onChange, names, usual, emptyLabel, placeholder = emptyLabel, renderIcon, iconInBox = true, renderDetail, label, maxLength, className, showAll = false}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const searching = Boolean(query.trim());
  const {options, others}: {options: PickerOption[]; others: number} = searching
    ? {options: searchNames(names, query, showAll ? Infinity : MAX_RESULTS).map(name => ({name})), others: -1}
    : browseOptions(names, usual, showAll);

  const close = () => {
    setOpen(false);
    setQuery('');
    setActive(0);
  };
  const pick = (name: string) => {
    onChange(name);
    close();
  };

  return (
    <div className={`opponent-search search-picker${className ? ` ${className}` : ''}`}>
      <span className="picker-box">
        {iconInBox && !open && value && renderIcon(value)}
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={label}
          maxLength={maxLength}
          // Closed: shows the value. Open: an empty search with the value as a hint.
          value={open ? query : value}
          placeholder={open ? value || placeholder : placeholder}
          onFocus={() => setOpen(true)}
          onBlur={close}
          onChange={e => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const step = e.key === 'ArrowDown' ? 1 : -1;
              const next = Math.max(0, Math.min(options.length - 1, active + step));
              setActive(next);
              // Keep the highlighted row in view in a long, scrolling list.
              listRef.current?.children[next]?.scrollIntoView({block: 'nearest'});
            } else if (e.key === 'Enter' && options[active]) {
              e.preventDefault();
              pick(options[active].name);
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              e.currentTarget.blur();
            }
          }}
        />
      </span>
      {open && options.length > 0 && (
        <ul className={`opponent-results${showAll ? ' scrolls' : ''}`} id={listId} role="listbox" ref={listRef}>
          {options.map((o, i) => (
            <li key={o.name || '(none)'} role="option" aria-selected={i === active} className={i === others ? 'others-start' : undefined}>
              {/* mousedown, not click: picking must happen before the box loses focus. */}
              <button
                type="button"
                className={i === active ? 'active' : undefined}
                onMouseDown={e => {
                  e.preventDefault();
                  pick(o.name);
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="picker-icon">{o.name ? renderIcon(o.name) : null}</span>
                <span className="picker-name">
                  {o.name || emptyLabel}
                  {o.name && renderDetail ? <span className="muted small"> {renderDetail(o.name)}</span> : null}
                </span>
                <span className="muted">{o.share !== undefined ? pct(o.share) : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && options.length === 0 && <p className="muted small">Nothing matches “{query}”.</p>}
    </div>
  );
}
