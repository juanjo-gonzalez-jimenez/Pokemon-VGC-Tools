import type {Pokemon} from '../lib/coverage';
import type {StatsTable} from '../lib/stats';

export interface RegulationSummary {
  id: string;
  name: string;
  /** Smogon stats month, e.g. "2026-10". */
  month: string;
  /** Rating cutoff the stats were taken at. */
  cutoff: number;
  battles: number;
}

export interface RegulationIndex {
  updated: string;
  regulations: RegulationSummary[];
}

/** A roster Pokémon plus the usage details the team tools need. */
export interface MetaPokemon extends Pokemon {
  baseStats: StatsTable;
  /** Final Speed stat -> share of spreads (0..1), without items or boosts. */
  speeds: Record<string, number>;
  /** Most common items: name -> share (0..1). */
  items: Record<string, number>;
  /** Most common moves: name -> share of sets running it (0..1). */
  moves: Record<string, number>;
  /** Most common teammates: name -> share of this Pokémon's teams that also have it (0..1). */
  teammates: Record<string, number>;
}

export interface RegulationData extends RegulationSummary {
  pokemon: MetaPokemon[];
}

export interface SpeciesData {
  name: string;
  types: string[];
  baseStats: StatsTable;
  abilities: string[];
  /** Set for alternate forms (incl. Megas): the species they belong to. */
  baseSpecies?: string;
  /** Set for Mega forms: the stone that triggers them. */
  requiredItem?: string;
}

export interface MoveData {
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  /** Showdown target, e.g. "normal", "allAdjacentFoes" (spread), "allAdjacent" (hits partner too). */
  target: string;
  /** Move priority bracket; > 0 moves before normal moves. */
  priority: number;
}

export type SpeciesTable = Record<string, SpeciesData>;
export type MoveTable = Record<string, MoveData>;
