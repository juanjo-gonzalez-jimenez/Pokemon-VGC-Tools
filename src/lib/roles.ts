import {toID} from './ids';
import type {TeamMember} from './paste';

export interface RoleCheck {
  role: string;
  /** Labels of members that fill the role. */
  members: string[];
  ok: boolean;
  /** Shown when the role is missing or thin. */
  hint: string;
}

const SPEED_CONTROL = ['tailwind', 'trickroom', 'icywind', 'electroweb', 'thunderwave', 'nuzzle', 'rocktomb', 'bulldoze', 'scaryface'];
const REDIRECTION = ['followme', 'ragepowder'];
const PROTECT = ['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'obstruct'];
const SPREAD_TARGETS = ['allAdjacentFoes', 'allAdjacent'];
export const MIN_PROTECT_USERS = 3;

const hasMove = (m: TeamMember, ids: string[]) => m.moves.some(move => ids.includes(toID(move.name)));
const damaging = (m: TeamMember) => m.moves.filter(move => move.category !== 'Status');

/** Common VGC team roles and which members fill them. Advisory only: not every team needs every role. */
export function teamRoles(team: readonly TeamMember[]): RoleCheck[] {
  const who = (test: (m: TeamMember) => boolean) => team.filter(test).map(m => m.label);
  const checks: Array<[role: string, members: string[], hint: string, min?: number]> = [
    ['Fake Out', who(m => hasMove(m, ['fakeout'])), 'No Fake Out: harder to protect a setup turn.'],
    ['Intimidate', who(m => toID(m.ability) === 'intimidate'), 'No Intimidate to soften physical attackers.'],
    ['Speed control', who(m => hasMove(m, SPEED_CONTROL)), 'No Tailwind, Trick Room or speed-dropping move.'],
    ['Redirection', who(m => hasMove(m, REDIRECTION)), 'No Follow Me / Rage Powder (optional for many teams).'],
    [
      'Protect',
      who(m => hasMove(m, PROTECT)),
      `Fewer than ${MIN_PROTECT_USERS} Protect users: most VGC Pokémon run it.`,
      MIN_PROTECT_USERS,
    ],
    ['Spread damage', who(m => damaging(m).some(move => SPREAD_TARGETS.includes(move.target))), 'No spread moves to pressure both foes.'],
    // Fake Out has its own row, so it doesn't count as a priority attack here.
    [
      'Priority attack',
      who(m => damaging(m).some(move => move.priority > 0 && toID(move.name) !== 'fakeout')),
      'No priority attacks (besides Fake Out) to pick off faster foes.',
    ],
  ];
  return checks.map(([role, members, hint, min = 1]) => ({role, members, ok: members.length >= min, hint}));
}
