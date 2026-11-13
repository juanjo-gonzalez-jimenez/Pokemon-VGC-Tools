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
  calc: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8" />
    </>
  ),
  dex: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
};

export type IconName =
  | 'sun'
  | 'moon'
  | 'chevron'
  | 'check'
  | 'alert'
  | 'coverage'
  | 'team'
  | 'matchup'
  | 'calc'
  | 'dex';

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

/** The app's mark: a capture ball in the app's violet (top), white (bottom), with a dark band and button. */
export function Logo({size = 30}: {size?: number}) {
  const ink = '#1a1830';
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="14.5" fill="#ffffff" />
      <path d="M1.5 16a14.5 14.5 0 0 1 29 0z" fill="var(--accent-fill)" />
      <ellipse cx="10.5" cy="8.5" rx="4" ry="2.2" fill="#ffffff" opacity="0.28" transform="rotate(-30 10.5 8.5)" />
      <rect x="1.5" y="14.6" width="29" height="2.8" fill={ink} />
      <circle cx="16" cy="16" r="14.5" fill="none" stroke={ink} strokeWidth="2" />
      <circle cx="16" cy="16" r="5.2" fill={ink} />
      <circle cx="16" cy="16" r="3.3" fill="#ffffff" />
      <circle cx="16" cy="16" r="1.7" fill="none" stroke={ink} strokeOpacity="0.25" strokeWidth="0.8" />
    </svg>
  );
}
