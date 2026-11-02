export const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
export type StatName = (typeof STATS)[number];
export type StatsTable = Record<StatName, number>;

export const STAT_LABELS: Record<StatName, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

type BoostedStat = Exclude<StatName, 'hp'>;

/** Nature -> [raised stat, lowered stat]. Neutral natures are omitted. */
export const NATURES: Record<string, [BoostedStat, BoostedStat]> = {
  Lonely: ['atk', 'def'], Brave: ['atk', 'spe'], Adamant: ['atk', 'spa'], Naughty: ['atk', 'spd'],
  Bold: ['def', 'atk'], Relaxed: ['def', 'spe'], Impish: ['def', 'spa'], Lax: ['def', 'spd'],
  Timid: ['spe', 'atk'], Hasty: ['spe', 'def'], Jolly: ['spe', 'spa'], Naive: ['spe', 'spd'],
  Modest: ['spa', 'atk'], Mild: ['spa', 'def'], Quiet: ['spa', 'spe'], Rash: ['spa', 'spd'],
  Calm: ['spd', 'atk'], Gentle: ['spd', 'def'], Sassy: ['spd', 'spe'], Careful: ['spd', 'spa'],
};
export const NEUTRAL_NATURES = ['Hardy', 'Docile', 'Serious', 'Bashful', 'Quirky'];

export function isNature(name: string): boolean {
  return name in NATURES || NEUTRAL_NATURES.includes(name);
}

/**
 * Pokémon Champions stat formula (VGC, no Level Clause Mod), from Showdown's
 * data/mods/champions/scripts.ts: stat points (SP) replace EVs/IVs.
 *   HP = base + SP + 75;  other = trunc((base + SP + 20) * nature)
 */
export function calcStat(stat: StatName, base: number, sp: number, nature = 'Serious'): number {
  if (stat === 'hp') return base + sp + 75;
  const raw = base + sp + 20;
  const [plus, minus] = NATURES[nature] ?? [];
  if (plus === stat) return Math.trunc((raw * 110) / 100);
  if (minus === stat) return Math.trunc((raw * 90) / 100);
  return raw;
}

/** Parse a Smogon spread key "Adamant:32/14/10/0/10/0" (HP/Atk/Def/SpA/SpD/Spe). */
export function parseSpread(spread: string): {nature: string; sp: StatsTable} | null {
  const [nature, values] = spread.split(':');
  const nums = values?.split('/').map(Number);
  if (!nums || nums.length !== 6 || nums.some(n => !Number.isFinite(n))) return null;
  const sp = Object.fromEntries(STATS.map((s, i) => [s, nums[i]])) as StatsTable;
  return {nature, sp};
}
