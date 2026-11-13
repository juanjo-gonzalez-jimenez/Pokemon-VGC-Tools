import {describe, expect, it} from 'vitest';
import {activeTeam, addTeam, decodeShare, duplicate, encodeShare, importTeam, MAX_NAME, nameTaken, nextName, parseStore, removeActive, rename, select, setText} from './teams';

describe('saved teams', () => {
  it('starts from the single team older versions saved', () => {
    const s = parseStore(null, 'Rillaboom @ Miracle Seed');
    expect(s.teams).toHaveLength(1);
    expect(activeTeam(s)).toMatchObject({name: 'Team 1', text: 'Rillaboom @ Miracle Seed'});
    expect(parseStore('{broken', 'x').teams[0].text).toBe('x');
  });
  it('reads a stored list back, fixing a missing active team', () => {
    const raw = JSON.stringify({active: 'gone', teams: [{id: 'a', name: 'A', text: '1'}, {id: 'b', name: 'B', text: '2'}]});
    expect(parseStore(raw).active).toBe('a');
  });
  it('adds, renames, edits, duplicates, selects and removes teams', () => {
    let s = parseStore(null, 'one');
    s = addTeam(s);
    expect(activeTeam(s).name).toBe('Team 2');
    s = setText(rename(s, 'Rain'), 'Pelipper');
    s = duplicate(s);
    expect(activeTeam(s)).toMatchObject({name: 'Rain (copy 1)', text: 'Pelipper'});
    expect(s.teams.map(t => t.name)).toEqual(['Team 1', 'Rain', 'Rain (copy 1)']);
    s = removeActive(s);
    expect(activeTeam(s).name).toBe('Rain');
    s = select(s, s.teams[0].id);
    expect(activeTeam(s).text).toBe('one');
    s = removeActive(removeActive(s));
    expect(s.teams).toHaveLength(1);
    expect(activeTeam(s).text).toBe('');
    expect(nextName(s, 'Shared team')).toBe('Shared team 1');
  });
  it('imports a shared team once, filling a blank team first', () => {
    let s = parseStore(null, '');
    s = importTeam(s, 'Incineroar', 'Shared team 1');
    expect(s.teams).toHaveLength(1);
    expect(activeTeam(s)).toMatchObject({name: 'Shared team 1', text: 'Incineroar'});
    s = addTeam(s, 'Other');
    s = importTeam(s, 'Incineroar\n', 'Shared team 2');
    expect(s.teams).toHaveLength(2);
    expect(activeTeam(s).name).toBe('Shared team 1');
  });
});

describe('share links', () => {
  it('round-trips any text, accents included', () => {
    const text = 'Flabébé @ Sitrus Berry\nAbility: Flower Veil\n- Moonblast';
    const code = encodeShare(text);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShare(code)).toBe(text);
  });
  it('rejects broken codes', () => {
    expect(decodeShare('***')).toBeNull();
    expect(decodeShare('')).toBeNull();
  });
});

describe('team names', () => {
  it('refuses a name another team already has, ignoring case', () => {
    let s = addTeam(parseStore(null, 'one'), 'two', 'Rain');
    expect(nameTaken(s, ' rain ')).toBe(true);
    expect(nameTaken(s, 'rain', s.active)).toBe(false);
    s = select(s, s.teams[0].id);
    expect(activeTeam(rename(s, 'RAIN')).name).toBe('Team 1');
    expect(activeTeam(rename(s, '')).name).toBe('Team 1');
    expect(activeTeam(rename(s, 'x'.repeat(MAX_NAME + 1))).name).toBe('Team 1');
    expect(activeTeam(rename(s, 'Sun')).name).toBe('Sun');
  });
  it('gives new and copied teams unique names', () => {
    let s = addTeam(parseStore(null, ''), '', 'Rain');
    s = addTeam(s, '', 'Rain');
    expect(activeTeam(s).name).toBe('Rain (2)');
    s = duplicate(duplicate(s));
    // Copying a copy numbers from the original name instead of stacking suffixes.
    expect(s.teams.map(t => t.name)).toEqual(['Team 1', 'Rain', 'Rain (2)', 'Rain (2) (copy 1)', 'Rain (2) (copy 2)']);
    s = duplicate(select(s, s.teams[1].id));
    expect(activeTeam(s).name).toBe('Rain (copy 1)');
    const long = duplicate(rename(s, 'A very long team name 24'));
    expect(activeTeam(long).name).toBe('A very long tea (copy 1)');
    expect(s.teams.every(t => t.name.length <= MAX_NAME)).toBe(true);
  });
});
