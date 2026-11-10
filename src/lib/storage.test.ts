import {afterEach, describe, expect, it, vi} from 'vitest';
import {anyString, boolean, oneOf, readStored, writeStored} from './storage';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  });
  return data;
}

afterEach(() => vi.unstubAllGlobals());

describe('stored settings', () => {
  it('reads valid values and falls back on missing or outdated ones', () => {
    fakeStorage({sort: 'spe', old: 'removed-option', n: '50', flag: 'false'});
    const sorts = oneOf(['usage', 'spe'] as const);
    expect(readStored('sort', 'usage', sorts)).toBe('spe');
    expect(readStored('old', 'usage', sorts)).toBe('usage');
    expect(readStored('missing', 'usage', sorts)).toBe('usage');
    expect(readStored('n', 25, oneOf([25, 50, 100]))).toBe(50);
    expect(readStored('flag', true, boolean)).toBe(false);
  });
  it('writes values as strings', () => {
    const data = fakeStorage();
    writeStored('n', 50);
    writeStored('flag', true);
    expect([...data]).toEqual([['n', '50'], ['flag', 'true']]);
  });
  it('survives storage being unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readStored('x', 'fallback', anyString)).toBe('fallback');
    expect(() => writeStored('x', 'y')).not.toThrow();
  });
});
