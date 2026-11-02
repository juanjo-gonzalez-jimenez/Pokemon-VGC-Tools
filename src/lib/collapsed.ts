/** Which panels the viewer has collapsed, stored as a JSON array of panel ids. */
export const COLLAPSED_KEY = 'vgc-tools:collapsed';

/** Parse the stored list, treating anything malformed as "nothing collapsed". */
export function parseCollapsed(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Collapse `id` if it's open, or open it if it's collapsed. */
export function toggleCollapsed(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
}
