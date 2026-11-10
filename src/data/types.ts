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
  /** Showdown data mod the regulation uses, e.g. "champions"; names its file in data/mods/. */
  mod: string;
}

export interface RegulationIndex {
  /** Newest stats month included, e.g. "2026-10". */
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
  /** Most common spreads, "Nature:hp/atk/def/spa/spd/spe" (stat points) -> share (0..1). */
  spreads: Record<string, number>;
  /** Nature -> share of sets (0..1). */
  natures: Record<string, number>;
  /** Showdown sprite file name, e.g. "charizard-megay". */
  sprite?: string;
  /** Sprite of the base species, used when a form has no sprite yet. */
  baseSprite?: string;
  /** Index on Showdown's 40×30 icon sheet. */
  icon?: number;
  /**
   * Searcher only: where the usage data comes from. Omitted = the regulation's rating cutoff;
   * 'all' = all-ratings stats (too rare at the cutoff); 'none' = no usage data at all.
   */
  source?: 'all' | 'none';
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
  /** Sound-based move (Liquid Voice turns these into Water moves). */
  sound?: true;
  /** Set by applyMod(): the move doesn't exist in the regulation's game. */
  unavailable?: true;
}

export interface ItemData {
  name: string;
  /** Index on Showdown's 24×24 item icon sheet (0 = none). */
  sprite: number;
  /** Set by applyMod(): the item doesn't exist in the regulation's game. */
  unavailable?: true;
}

/** How a regulation's game (a Showdown data mod) differs from the base move and item data. */
export interface ModData {
  /** Moves whose type or base power differ from the base data. */
  moves: Record<string, {type?: string; basePower?: number}>;
  /** Ids of moves and items that don't exist in this game. */
  unavailableMoves: string[];
  unavailableItems: string[];
}

export type SpeciesTable = Record<string, SpeciesData>;
export type ItemTable = Record<string, ItemData>;
export type MoveTable = Record<string, MoveData>;
