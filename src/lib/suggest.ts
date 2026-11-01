import {coverRoster, type Bucket, type Pokemon} from './coverage';
import {TYPES, type TypeName} from './typechart';

export interface Suggestion {
  type: TypeName;
  buckets: Record<Bucket, number>;
  /** Change in super-effective share vs the current selection. */
  superGain: number;
  /** Change in "walled" share (resisted + immune); negative is good. */
  walledChange: number;
}

const walled = (b: Record<Bucket, number>) => b.resisted + b.immune;

/**
 * Rank every unselected type by how much adding it improves coverage:
 * more super-effective hits first, fewer walls as the tie-breaker.
 */
export function suggestNext(
  selected: readonly TypeName[],
  roster: readonly Pokemon[],
  weighted: boolean,
): Suggestion[] {
  const base = coverRoster(selected, roster, weighted).buckets;
  return TYPES.filter(t => !selected.includes(t))
    .map(type => {
      const buckets = coverRoster([...selected, type], roster, weighted).buckets;
      return {
        type,
        buckets,
        superGain: buckets.super - base.super,
        walledChange: walled(buckets) - walled(base),
      };
    })
    .sort((a, b) => b.superGain - a.superGain || a.walledChange - b.walledChange);
}
