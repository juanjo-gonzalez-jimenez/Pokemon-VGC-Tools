import {describe, expect, it} from 'vitest';
import {teamRoles} from './roles';
import {member, move, species} from './test-fixtures';

const protect = move('Protect', 'Normal', {category: 'Status'});

describe('teamRoles', () => {
  const team = [
    member(species('Inci', ['Fire', 'Dark']), 'Intimidate', {
      moves: [move('Fake Out', 'Normal', {priority: 3}), move('Flare Blitz', 'Fire'), protect],
    }),
    member(species('Gambit', ['Dark', 'Steel']), 'Defiant', {
      moves: [move('Sucker Punch', 'Dark', {priority: 1})],
    }),
    member(species('Zard', ['Fire', 'Flying']), 'Drought', {
      moves: [move('Heat Wave', 'Fire', {target: 'allAdjacentFoes'}), move('Tailwind', 'Flying', {category: 'Status'}), protect],
    }),
  ];
  const roles = Object.fromEntries(teamRoles(team).map(r => [r.role, r]));

  it('finds the members filling each role', () => {
    expect(roles['Fake Out'].members).toEqual(['Inci']);
    expect(roles['Intimidate'].members).toEqual(['Inci']);
    expect(roles['Speed control'].members).toEqual(['Zard']);
    expect(roles['Spread damage'].members).toEqual(['Zard']);
    // Fake Out alone doesn't count as a priority attack.
    expect(roles['Priority attack'].members).toEqual(['Gambit']);
  });
  it('flags missing roles and too few Protect users', () => {
    expect(roles['Redirection'].ok).toBe(false);
    expect(roles['Protect'].members).toHaveLength(2);
    expect(roles['Protect'].ok).toBe(false);
  });
});
