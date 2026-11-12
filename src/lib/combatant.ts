import type {MetaPokemon} from '../data/types';
import type {Combatant} from './damage';
import type {TeamMember} from './paste';
import {calcStat, STATS, type StatsTable} from './stats';

/** The meta Pokémon's most common ability (decides e.g. Weather Ball's type). */
export function mainAbility(p: MetaPokemon): string {
  const abilities = Object.entries(p.forms[0]?.abilities ?? {});
  return abilities.length ? abilities.reduce((a, b) => (b[1] > a[1] ? b : a))[0] : '';
}

/** An item counts for a meta Pokémon only when most of its sets hold it. */
export const MAIN_ITEM_SHARE = 0.5;

/** One of your Pokémon, with its real spread (Mega form stats when holding the stone). */
export function fromMember(m: TeamMember): Combatant {
  const stats =
    m.stats ??
    (Object.fromEntries(STATS.map(s => [s, calcStat(s, m.species.baseStats[s], m.sp[s], m.nature)])) as StatsTable);
  return {
    name: m.label,
    species: m.species.name,
    types: m.species.types,
    ability: m.ability,
    item: m.item,
    stats,
    // Members built from usage data carry average stats instead of a real spread.
    ...(m.stats ? {} : {build: {nature: m.nature, sp: m.sp}}),
  };
}

/** A meta Pokémon as usually built: mean stats, most common ability, item held by most sets. */
export function fromMeta(p: MetaPokemon): Combatant {
  const [item, share] = Object.entries(p.items).reduce<[string, number]>((a, b) => (b[1] > a[1] ? b : a), ['', 0]);
  return {
    name: p.name,
    species: p.name,
    types: p.forms[0]?.types ?? [],
    ability: mainAbility(p),
    item: share >= MAIN_ITEM_SHARE ? item : '',
    stats: p.stats,
  };
}
