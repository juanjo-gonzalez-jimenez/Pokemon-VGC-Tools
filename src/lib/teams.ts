/** Several named teams kept in the browser, one of them active, and share links for a team. */

export interface SavedTeam {
  id: string;
  name: string;
  /** Showdown / Pokepaste text. */
  text: string;
}

export interface TeamStore {
  /** Id of the team the Team, Matchup and Coverage tabs use. */
  active: string;
  teams: SavedTeam[];
}

let counter = 0;
const newId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Longest team name. */
export const MAX_NAME = 24;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Another team (not `exceptId`) already has this name, ignoring case and spaces at the ends. */
export const nameTaken = (store: TeamStore, name: string, exceptId?: string) =>
  store.teams.some(t => t.id !== exceptId && sameName(t.name, name));

/** `name`, or "name (2)", "name (3)"… so no two teams share a name. */
export function uniqueName(store: TeamStore, name: string): string {
  const base = name.slice(0, MAX_NAME);
  if (!nameTaken(store, base)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, MAX_NAME - suffix.length)}${suffix}`;
    if (!nameTaken(store, candidate)) return candidate;
  }
}

/** "Team 3": the first number not used by another team's default name. */
export function nextName(store: TeamStore | null, base = 'Team'): string {
  for (let n = 1; ; n++) if (!store || !nameTaken(store, `${base} ${n}`)) return `${base} ${n}`;
}

/**
 * The stored teams, or a first one made from the single team older versions kept
 * (`legacyText`). Anything malformed starts over with that.
 */
export function parseStore(raw: string | null, legacyText = ''): TeamStore {
  try {
    const value = raw ? (JSON.parse(raw) as TeamStore) : null;
    const ok =
      value &&
      Array.isArray(value.teams) &&
      value.teams.length > 0 &&
      value.teams.every(t => t && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.text === 'string');
    if (ok) return value.teams.some(t => t.id === value.active) ? value : {...value, active: value.teams[0].id};
  } catch {
    // fall through to a fresh store
  }
  const first = {id: newId(), name: 'Team 1', text: legacyText};
  return {active: first.id, teams: [first]};
}

export const activeTeam = (store: TeamStore): SavedTeam => store.teams.find(t => t.id === store.active) ?? store.teams[0];

export function setText(store: TeamStore, text: string): TeamStore {
  return {...store, teams: store.teams.map(t => (t.id === store.active ? {...t, text} : t))};
}

/** Renames the active team; a blank or already used name is refused (store unchanged). */
export function rename(store: TeamStore, name: string): TeamStore {
  if (!name.trim() || name.length > MAX_NAME || nameTaken(store, name, store.active)) return store;
  return {...store, teams: store.teams.map(t => (t.id === store.active ? {...t, name} : t))};
}

/** Adds a team and makes it active. */
export function addTeam(store: TeamStore, text = '', name = nextName(store)): TeamStore {
  const team = {id: newId(), name: uniqueName(store, name), text};
  return {active: team.id, teams: [...store.teams, team]};
}

/** A copy suffix: " (copy 3)". */
const COPY_SUFFIX = / \(copy \d+\)$/;

/**
 * Copies the active team as "Name (copy 1)", "Name (copy 2)"…: copying a copy numbers it from
 * the original name instead of stacking suffixes.
 */
export function duplicate(store: TeamStore): TeamStore {
  const current = activeTeam(store);
  const original = current.name.replace(COPY_SUFFIX, '');
  for (let n = 1; ; n++) {
    const suffix = ` (copy ${n})`;
    const name = `${original.slice(0, MAX_NAME - suffix.length)}${suffix}`;
    if (!nameTaken(store, name)) return addTeam(store, current.text, name);
  }
}

/** Removes the active team; the one before it becomes active (a blank team when none is left). */
export function removeActive(store: TeamStore): TeamStore {
  const i = store.teams.findIndex(t => t.id === store.active);
  const teams = store.teams.filter(t => t.id !== store.active);
  if (!teams.length) return parseStore(null);
  return {active: teams[Math.max(0, i - 1)].id, teams};
}

export const select = (store: TeamStore, id: string): TeamStore =>
  store.teams.some(t => t.id === id) ? {...store, active: id} : store;

/**
 * Opens a shared team: an existing team with the same text becomes active, otherwise it is added
 * under `name`.
 */
export function importTeam(store: TeamStore, text: string, name: string): TeamStore {
  const same = store.teams.find(t => t.text.trim() === text.trim());
  if (same) return {...store, active: same.id};
  // Fill the blank first team instead of adding next to it.
  const current = activeTeam(store);
  if (!current.text.trim()) {
    const unique = uniqueName({...store, teams: store.teams.filter(t => t.id !== current.id)}, name);
    return {...store, teams: store.teams.map(t => (t.id === current.id ? {...t, name: unique, text} : t))};
  }
  return addTeam(store, text, name);
}

// ---------------------------------------------------------------- share links

/** URL-safe base64 of the UTF-8 text, for `#/team/import/<code>` links. */
export function encodeShare(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The text in a share code; null when it isn't one. */
export function decodeShare(code: string): string | null {
  try {
    const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const text = new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

export const SHARE_PREFIX = '#/team/import/';
