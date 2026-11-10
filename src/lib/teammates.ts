import type {MetaPokemon, MoveData, MoveTable, SpeciesTable} from '../data/types';
import {coverPokemon} from './coverage';
import {toID} from './ids';
import type {TeamMember} from './paste';
import {teamRoles} from './roles';
import {defensiveChart, type SpeedMode} from './team';
import {MAIN_ITEM_SHARE} from './combatant';
import {duel} from './exchange';
import {resolveField} from './field';
import {mainAbility, threatList} from './threats';
import type {TypeName} from './typechart';

/** A move is treated as part of a candidate's usual set when this share of its sets run it. */
export const SET_MOVE_SHARE = 0.3;
/** Pairing rate that counts as "very commonly paired" (full marks for synergy). */
const STRONG_PAIRING = 0.25;
const WEIGHTS = {pairing: 0.35, weaknesses: 0.25, threats: 0.25, roles: 0.15};
const THREATS_CONSIDERED = 10;

export interface TeammateSuggestion {
  pokemon: MetaPokemon;
  /** For each of your members with usage data: share of its teams that also run this Pokémon. */
  pairings: Array<{label: string; rate: number}>;
  /** Mean pairing rate across your members that have usage data. */
  pairing: number;
  /** Your team's problem types this Pokémon resists or is immune to. */
  covers: TypeName[];
  /** Your biggest threats it beats one-on-one with its usual set (estimated damage). */
  checks: string[];
  /** Roles your team is missing that its usual set fills. */
  roles: string[];
  /** 0..1 overall fit. */
  score: number;
}

/** Species Clause key: forms and Megas count as their base species. */
const speciesKey = (name: string, species: SpeciesTable) => {
  const entry = species[toID(name)];
  return toID(entry?.baseSpecies ?? entry?.name ?? name);
};

/**
 * The candidate's usual set as a team member (common moves, average stats over all spreads, item
 * held by most sets), so the roles checklist and the damage estimate can be reused.
 */
function usualSet(p: MetaPokemon, species: SpeciesTable, moves: MoveTable): TeamMember | null {
  const s = species[p.id];
  if (!s) return null;
  const setMoves = Object.entries(p.moves)
    .filter(([, share]) => share >= SET_MOVE_SHARE)
    .map(([name]) => moves[toID(name)])
    .filter((m): m is MoveData => Boolean(m));
  const ability = mainAbility(p) || (s.abilities[0] ?? '');
  const [item, itemShare] = Object.entries(p.items).reduce<[string, number]>((a, b) => (b[1] > a[1] ? b : a), ['', 0]);
  return {
    label: p.name, species: s, baseSpecies: s, isMega: false, item: itemShare >= MAIN_ITEM_SHARE ? item : '',
    ability, pastedAbility: ability, nature: 'Serious', sp: {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0},
    stats: p.stats, moves: setMoves, moveLines: setMoves.length,
  };
}

/**
 * Meta Pokémon that would fit the team: commonly paired with your members by real players,
 * covering your weaknesses, checking your biggest threats and filling missing roles.
 */
export function suggestTeammates(
  team: readonly TeamMember[],
  roster: readonly MetaPokemon[],
  species: SpeciesTable,
  moves: MoveTable,
  mode: SpeedMode = 'normal',
  limit = 8,
): TeammateSuggestion[] {
  if (!team.length) return [];
  const byId = new Map(roster.map(p => [p.id, p]));
  const memberMeta = team
    .map(m => ({label: m.label, meta: byId.get(toID(m.species.name)) ?? byId.get(toID(m.baseSpecies.name))}))
    .filter((x): x is {label: string; meta: MetaPokemon} => Boolean(x.meta));
  const onTeam = new Set(team.map(m => speciesKey(m.baseSpecies.name, species)));

  const problemTypes = defensiveChart(team)
    .filter(r => r.weak > r.resist + r.immune)
    .map(r => r.type);
  const threats = threatList(team, roster, moves, mode, THREATS_CONSIDERED);
  const missingRoles = teamRoles(team)
    .filter(r => !r.ok)
    .map(r => r.role);

  const share = (n: number, of: number) => (of ? n / of : 0);

  return roster
    .filter(p => !onTeam.has(speciesKey(p.name, species)))
    .map(p => {
      const pairings = memberMeta.map(({label, meta}) => ({label, rate: meta.teammates[p.name] ?? 0}));
      const pairing = pairings.length ? pairings.reduce((a, b) => a + b.rate, 0) / pairings.length : 0;

      const covers = problemTypes.filter(type => {
        const b = coverPokemon([type], p).buckets;
        return b.resisted + b.immune >= 0.5;
      });

      const set = usualSet(p, species, moves);
      const checks = set
        ? threats
            .filter(t => duel(set, t.pokemon, moves, resolveField(set.ability, mainAbility(t.pokemon)), mode).win > 0.5)
            .map(t => t.pokemon.name)
        : [];

      const filled = set ? teamRoles([set]).filter(r => r.members.length > 0).map(r => r.role) : [];
      const roles = missingRoles.filter(r => filled.includes(r));

      const score =
        WEIGHTS.pairing * Math.min(1, pairing / STRONG_PAIRING) +
        WEIGHTS.weaknesses * share(covers.length, problemTypes.length) +
        WEIGHTS.threats * share(checks.length, threats.length) +
        WEIGHTS.roles * share(roles.length, missingRoles.length);

      return {pokemon: p, pairings: pairings.filter(x => x.rate > 0).sort((a, b) => b.rate - a.rate), pairing, covers, checks, roles, score};
    })
    .sort((a, b) => b.score - a.score)
    // One entry per species: Garchomp and Garchomp-Mega-Z can't both be brought.
    .filter((s, i, all) => all.findIndex(o => speciesKey(o.pokemon.name, species) === speciesKey(s.pokemon.name, species)) === i)
    .slice(0, limit);
}
