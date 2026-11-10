/** Turns a stored string back into a value; returns undefined when it isn't valid any more. */
export type Parse<T> = (raw: string) => T | undefined;

/** Accepts only the listed values (e.g. the options of a select). */
export function oneOf<T extends string | number>(options: readonly T[]): Parse<T> {
  return raw => options.find(o => String(o) === raw);
}

export const anyString: Parse<string> = raw => raw;
export const boolean: Parse<boolean> = raw => (raw === 'true' ? true : raw === 'false' ? false : undefined);

/** Reads a stored value, falling back when storage is unavailable or the value is no longer valid. */
export function readStored<T>(key: string, fallback: T, parse: Parse<T>): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = parse(raw);
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: string | number | boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage can be unavailable (private mode); the value just won't be remembered.
  }
}
