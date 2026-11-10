import {useEffect} from 'react';
import {usePersistentState} from '../hooks/usePersistentState';
import {oneOf} from '../lib/storage';
import {Icon, type IconName} from './Icon';

type Theme = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'vgc-tools:theme';
const OPTIONS: Array<{id: Theme; label: string; icon: IconName}> = [
  {id: 'system', label: 'System theme', icon: 'monitor'},
  {id: 'light', label: 'Light theme', icon: 'sun'},
  {id: 'dark', label: 'Dark theme', icon: 'moon'},
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
          <Icon name={o.icon} />
        </button>
      ))}
    </div>
  );
}
