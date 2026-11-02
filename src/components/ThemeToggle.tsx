import {useEffect, useState} from 'react';

type Theme = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'vgc-tools:theme';
const OPTIONS: Array<{id: Theme; label: string; icon: string}> = [
  {id: 'system', label: 'System theme', icon: '◐'},
  {id: 'light', label: 'Light theme', icon: '☀'},
  {id: 'dark', label: 'Dark theme', icon: '☾'},
];

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

/** System / Light / Dark switch. Sets `data-theme` on <html>, which styles.css keys off. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(loadTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage unavailable: the choice just won't be remembered.
    }
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
