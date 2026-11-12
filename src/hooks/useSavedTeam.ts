import {useSyncExternalStore} from 'react';
import {activeTeam, parseStore, setText, type TeamStore} from '../lib/teams';

const STORE_KEY = 'vgc-tools:teams';
/** The single team older versions kept; still written with the active team's text. */
const LEGACY_KEY = 'vgc-tools:team';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let store: TeamStore = parseStore(read(STORE_KEY), read(LEGACY_KEY) ?? '');
const listeners = new Set<() => void>();

function save(next: TeamStore) {
  store = next;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    localStorage.setItem(LEGACY_KEY, activeTeam(next).text);
  } catch {
    // Storage unavailable: teams last until the page is closed.
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const updateStore = (update: (s: TeamStore) => TeamStore) => save(update(store));

/** All saved teams and a way to change them (every tab sees the change). */
export function useTeamStore(): [TeamStore, typeof updateStore] {
  return [useSyncExternalStore(subscribe, () => store), updateStore];
}

/** The active team's paste (shared by the Team, Coverage and Matchup tabs). */
export function useSavedTeam(): [string, (text: string) => void] {
  const [value, update] = useTeamStore();
  return [activeTeam(value).text, text => update(s => setText(s, text))];
}
