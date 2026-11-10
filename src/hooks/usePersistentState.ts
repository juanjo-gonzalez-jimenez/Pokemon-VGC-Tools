import {useCallback, useState} from 'react';
import {readStored, writeStored, type Parse} from '../lib/storage';

/**
 * useState that remembers its value in localStorage under `key`. `parse` validates what was
 * stored, so an option that no longer exists falls back to `fallback`.
 */
export function usePersistentState<T extends string | number | boolean>(
  key: string,
  fallback: T,
  parse: Parse<T>,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readStored(key, fallback, parse));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      writeStored(key, next);
    },
    [key],
  );
  return [value, set];
}
