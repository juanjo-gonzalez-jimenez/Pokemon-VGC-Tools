import {useEffect} from 'react';
import {usePersistentState} from '../hooks/usePersistentState';
import {oneOf} from '../lib/storage';

type Theme = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'vgc-tools:theme';
const OPTIONS: Array<{id: Theme; label: string; icon: string}> = [
  {id: 'system', label: 'System theme', icon: '◐'},
  {id: 'light', label: 'Light theme', icon: '☀'},
  {id: 'dark', label: 'Dark theme', icon: '☾'},
];

/** System / Light / Dark switch. Sets `data-theme` on <html>, which the stylesheets key off. */
export function ThemeToggle() {
  // index.html applies a stored 'light' / 'dark' before first paint; 'system' means no override.
  const [theme, setTheme] = usePersistentState<Theme>(STORAGE_KEY, 'system', oneOf(['system', 'light', 'dark']));

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="segmented theme-toggle" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(o => (
        <button
          key={o.id}
          role="radio"
          aria-checked={theme === o.id}
          aria-label={o.label}
          title={o.label}
          className={theme === o.id ? 'on' : ''}
          onClick={() => setTheme(o.id)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
