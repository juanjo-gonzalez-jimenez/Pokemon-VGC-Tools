import type {ReactNode} from 'react';

/** Simple line icons (24×24 grid, stroke follows the text colour). */
const PATHS: Record<string, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  monitor: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  check: <path d="M20 6L9 17l-5-5" />,
  alert: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  // Tabs
  coverage: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  team: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  matchup: <path d="M5 4l14 16M19 4L5 20M3 7l4-4M21 7l-4-4M3 17l4 4M21 17l-4 4" />,
  dex: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
};

export type IconName = 'sun' | 'moon' | 'monitor' | 'chevron' | 'check' | 'alert' | 'coverage' | 'team' | 'matchup' | 'dex';

/** Decorative icon; pair it with visible text or an aria-label on the control. */
export function Icon({name, size = 16}: {name: IconName; size?: number}) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

/** The app's mark: coverage bars with one highlighted. */
export function Logo({size = 30}: {size?: number}) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent-fill)" />
      <rect x="6" y="17" width="4" height="9" rx="1.5" fill="#fff" opacity="0.9" />
      <rect x="12" y="11" width="4" height="15" rx="1.5" fill="#fff" opacity="0.9" />
      <rect x="18" y="14" width="4" height="12" rx="1.5" fill="#fff" opacity="0.9" />
      <rect x="24" y="6" width="3" height="20" rx="1.5" fill="var(--accent-2-bright)" />
    </svg>
  );
}
