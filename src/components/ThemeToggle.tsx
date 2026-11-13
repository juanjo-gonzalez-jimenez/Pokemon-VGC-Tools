import {useEffect, useState} from 'react';
import {Icon, type IconName} from './Icon';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'vgc-tools:theme';
const OPTIONS: Array<{id: Theme; label: string; icon: IconName}> = [
  {id: 'light', label: 'Light theme', icon: 'sun'},
  {id: 'dark', label: 'Dark theme', icon: 'moon'},
];

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');
const systemTheme = (): Theme => (darkQuery()?.matches ? 'dark' : 'light');

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Light / Dark switch. Until the user picks one, the device's setting is followed (and shown as
 * selected); a pick is remembered and sets `data-theme` on <html>, which the stylesheets key off.
 */
export function ThemeToggle() {
  const [picked, setPicked] = useState<Theme | null>(storedTheme);
  const [system, setSystem] = useState<Theme>(systemTheme);

  // Follow the device while nothing is picked.
  useEffect(() => {
    const query = darkQuery();
    if (!query) return;
    const onChange = () => setSystem(systemTheme());
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (picked) root.dataset.theme = picked;
    else delete root.dataset.theme;
  }, [picked]);

  const theme = picked ?? system;
  const pick = (t: Theme) => {
    setPicked(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Storage unavailable: the theme just won't be remembered.
    }
  };

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
          onClick={() => pick(o.id)}
        >
          <Icon name={o.icon} />
        </button>
      ))}
    </div>
  );
}
