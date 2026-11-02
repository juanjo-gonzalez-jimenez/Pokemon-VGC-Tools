import {describe, expect, it} from 'vitest';
import {parseCollapsed, toggleCollapsed} from './collapsed';

describe('collapsed panels', () => {
  it('toggles ids in and out', () => {
    expect(toggleCollapsed([], 'threats')).toEqual(['threats']);
    expect(toggleCollapsed(['threats', 'roles'], 'threats')).toEqual(['roles']);
  });
  it('treats missing or malformed storage as nothing collapsed', () => {
    expect(parseCollapsed(null)).toEqual([]);
    expect(parseCollapsed('{not json')).toEqual([]);
    expect(parseCollapsed('{"a":1}')).toEqual([]);
    expect(parseCollapsed('["roles", 3]')).toEqual(['roles']);
  });
});
