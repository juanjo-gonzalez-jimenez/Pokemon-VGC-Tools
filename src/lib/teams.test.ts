import {describe, expect, it} from 'vitest';
import {activeTeam, addTeam, decodeShare, duplicate, encodeShare, importTeam, nextName, parseStore, removeActive, rename, select, setText} from './teams';

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
    expect(activeTeam(s)).toMatchObject({name: 'Rain (copy)', text: 'Pelipper'});
    expect(s.teams.map(t => t.name)).toEqual(['Team 1', 'Rain', 'Rain (copy)']);
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
