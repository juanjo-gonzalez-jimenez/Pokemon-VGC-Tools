import type {Pokemon} from '../lib/coverage';

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

export interface RegulationData extends RegulationSummary {
  pokemon: Pokemon[];
}
