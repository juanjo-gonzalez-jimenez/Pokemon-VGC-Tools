/** Small builders for unit tests. */
import type {MetaPokemon, MoveData, SpeciesData} from '../data/types';
import type {TeamMember} from './paste';
import type {StatsTable} from './stats';

export const stats = (spe: number): StatsTable => ({hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe});
export const noSp = (spe = 0): StatsTable => ({hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe});

export const species = (name: string, types: string[], spe = 80, abilities: string[] = []): SpeciesData => ({
  name, types, baseStats: stats(spe), abilities,
});

export const move = (name: string, type: string, extra: Partial<MoveData> = {}): MoveData => ({
  name, type, category: 'Physical', basePower: 80, target: 'normal', priority: 0, ...extra,
});

export const member = (s: SpeciesData, ability = '', extra: Partial<TeamMember> = {}): TeamMember => ({
  label: s.name, species: s, baseSpecies: s, isMega: false, item: '', ability, pastedAbility: ability,
  nature: 'Serious', sp: noSp(), moves: [], moveLines: extra.moves?.length ?? 0, ...extra,
});

export const meta = (
  name: string,
  usage: number,
  speeds: Record<string, number>,
  extra: Partial<MetaPokemon> = {},
): MetaPokemon => ({
  id: name.toLowerCase(), name, usage, forms: [], baseStats: stats(80), speeds, items: {}, moves: {}, teammates: {}, spreads: {}, natures: {}, ...extra,
});
