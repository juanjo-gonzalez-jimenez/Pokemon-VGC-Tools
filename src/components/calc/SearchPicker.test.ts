import {describe, expect, it} from 'vitest';
import {browseOptions, searchNames} from './SearchPicker';

describe('searchNames', () => {
  const names = ['Close Combat', 'Earthquake', 'Fake Out', 'Flare Blitz', 'Heat Wave', 'U-turn'];
  it('puts names starting with the query first, then ones containing it, ignoring case and punctuation', () => {
    expect(searchNames(names, 'f')).toEqual(['Fake Out', 'Flare Blitz']);
    expect(searchNames(names, 'ea')).toEqual(['Earthquake', 'Heat Wave']);
    expect(searchNames(names, 'uturn')).toEqual(['U-turn']);
    expect(searchNames(names, 'zzz')).toEqual([]);
  });
});

describe('browseOptions', () => {
  const names = ['Protect', 'Earthquake', 'Fake Out', 'Close Combat', 'Rock Slide'];
  const usual = [{name: 'Fake Out', share: 0.9}, {name: 'Protect', share: 0.8}];
  it('offers the empty choice and the usual picks', () => {
    expect(browseOptions(names, usual, false)).toEqual({options: [{name: ''}, ...usual], others: -1});
  });
  it('with showAll, lists every other name A–Z after the usual ones', () => {
    const {options, others} = browseOptions(names, usual, true);
    expect(options.map(o => o.name)).toEqual(['', 'Fake Out', 'Protect', 'Close Combat', 'Earthquake', 'Rock Slide']);
    expect(others).toBe(3);
  });
  it('searches without the result limit when asked', () => {
    const many = Array.from({length: 20}, (_, i) => `Move ${i}`);
    expect(searchNames(many, 'move')).toHaveLength(8);
    expect(searchNames(many, 'move', Infinity)).toHaveLength(20);
  });
});
