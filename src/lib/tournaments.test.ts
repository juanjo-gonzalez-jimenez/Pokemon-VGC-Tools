import {describe, expect, it} from 'vitest';
import speciesJson from '../data/species.json';
import movesJson from '../data/moves.json';
import dexList from '../data/regulations/gen9championsvgc2026regmc-dex.json';
import teamsJson from '../data/teams/M-C.json';
import type {MetaPokemon, MoveTable, SpeciesTable} from '../data/types';
import {parseTeam} from './paste';
import {meta} from './test-fixtures';
import {
  limitlessFormat,
  limitlessUrl,
  ordinal,
  recordText,
  teamName,
  teamsWith,
  bestFirst,
  toPaste,
  usualPoints,
  type TournamentMember,
  type TournamentTeam,
} from './tournaments';

const mon = (species: string, extra: Partial<TournamentMember> = {}): TournamentMember => ({
  species,
  name: species[0].toUpperCase() + species.slice(1),
  form: species,
  formName: species,
  item: '',
  ability: 'Intimidate',
  nature: 'Adamant',
  moves: ['Fake Out'],
  ...extra,
});

const team = (members: TournamentMember[], extra: Partial<TournamentTeam> = {}): TournamentTeam => ({
  event: {id: 'abc', name: 'Weekly #1', date: '2026-11-10T18:00:00.000Z', players: 64},
  player: 'some_player',
  playerName: 'Some Player',
  placing: 1,
  record: {wins: 7, losses: 1, ties: 0},
  members,
  ...extra,
});

describe('limitlessFormat', () => {
  it('maps Bo1 and Bo3 ids of a regulation to the same format', () => {
    expect(limitlessFormat('gen9championsvgc2026regmc')).toBe('M-C');
    expect(limitlessFormat('gen9championsvgc2026regmcbo3')).toBe('M-C');
    expect(limitlessFormat('gen9championsvgc2026regmb')).toBe('M-B');
    expect(limitlessFormat('gen9vgc2025regi')).toBe('I');
    expect(limitlessFormat('somethingelse')).toBeNull();
  });
});

describe('labels', () => {
  it('writes placings, records and names', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd',
    ]);
    expect(recordText({wins: 9, losses: 2, ties: 0})).toBe('9-2');
    expect(recordText({wins: 9, losses: 2, ties: 1})).toBe('9-2-1');
    expect(teamName(team([], {placing: 2}))).toBe('2nd · Some Player');
    expect(limitlessUrl(team([]))).toBe('https://play.limitlesstcg.com/tournament/abc/player/some_player/teamlist');
  });
});

describe('bestFirst', () => {
  it('puts the latest winners first', () => {
    const old1 = team([], {placing: 1, event: {id: 'a', name: 'A', date: '2026-11-01T00:00:00.000Z', players: 40}});
    const new1 = team([], {placing: 1, event: {id: 'b', name: 'B', date: '2026-11-09T00:00:00.000Z', players: 40}});
    const new2 = team([], {placing: 2, event: {id: 'b', name: 'B', date: '2026-11-09T00:00:00.000Z', players: 40}});
    expect(bestFirst([new2, old1, new1])).toEqual([new1, old1, new2]);
  });
});

describe('teamsWith', () => {
  it('matches the form a Pokémon battles as', () => {
    const zard = mon('charizard', {form: 'charizardmegay', item: 'Charizardite Y'});
    const mega = team([zard]);
    const plain = team([mon('charizard')], {player: 'other'});
    expect(teamsWith([mega, plain], 'charizardmegay')).toEqual([mega]);
    expect(teamsWith([mega, plain], 'charizard')).toEqual([plain]);
  });
});

describe('usualPoints and toPaste', () => {
  const roster = [
    meta('Incineroar', 0.3, {}, {
      id: 'incineroar',
      spreads: {'Careful:32/0/2/0/32/0': 0.5, 'Adamant:32/32/0/0/2/0': 0.2},
    }),
  ];

  it('prefers the most used spread with the team’s nature', () => {
    expect(usualPoints(mon('incineroar'), roster)).toEqual({hp: 32, atk: 32, def: 0, spa: 0, spd: 2, spe: 0});
  });

  it('falls back to the most used spread’s points', () => {
    expect(usualPoints(mon('incineroar', {nature: 'Brave'}), roster)).toEqual({hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0});
  });

  it('leaves the stat points out without usage data', () => {
    expect(usualPoints(mon('pikachu'), roster)).toBeNull();
    expect(toPaste(team([mon('pikachu')]), roster)).not.toContain('EVs');
  });

  it('writes Showdown text', () => {
    const t = team([mon('incineroar', {item: 'Sitrus Berry', moves: ['Fake Out', 'Flare Blitz']})]);
    expect(toPaste(t, roster)).toBe(
      'Incineroar @ Sitrus Berry\nAbility: Intimidate\nEVs: 32 HP / 32 Atk / 2 SpD\nAdamant Nature\n- Fake Out\n- Flare Blitz',
    );
  });

  it('turns every downloaded team into a paste the Team tab reads without warnings', () => {
    const species = speciesJson as unknown as SpeciesTable;
    const moves = movesJson as unknown as MoveTable;
    const teams = teamsJson as TournamentTeam[];
    for (const t of teams) {
      const parsed = parseTeam(toPaste(t, dexList as MetaPokemon[]), species, moves);
      expect(parsed.warnings, teamName(t)).toEqual([]);
      expect(parsed.members.length).toBe(6);
      // The Mega form recorded for the team is the one the Team tab analyses.
      expect(parsed.members.map(m => speciesIdOf(m.species.name))).toEqual(t.members.map(m => m.form));
    }
  });
});

const speciesIdOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
