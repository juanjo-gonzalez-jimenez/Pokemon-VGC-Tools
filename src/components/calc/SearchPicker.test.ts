import {describe, expect, it} from 'vitest';
import {searchNames} from './SearchPicker';

describe('searchNames', () => {
  const names = ['Close Combat', 'Earthquake', 'Fake Out', 'Flare Blitz', 'Heat Wave', 'U-turn'];
  it('puts names starting with the query first, then ones containing it, ignoring case and punctuation', () => {
    expect(searchNames(names, 'f')).toEqual(['Fake Out', 'Flare Blitz']);
    expect(searchNames(names, 'ea')).toEqual(['Earthquake', 'Heat Wave']);
    expect(searchNames(names, 'uturn')).toEqual(['U-turn']);
    expect(searchNames(names, 'zzz')).toEqual([]);
  });
});
