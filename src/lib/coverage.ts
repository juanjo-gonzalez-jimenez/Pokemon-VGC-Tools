import {abilityEffect} from './abilities';
import {asAttack, attackMultiplier, type AttackLike} from './attack';
import type {TypeName} from './typechart';

export interface Form {
  /** Display name, e.g. "Charizard-Mega-Y". */
  name: string;
  types: string[];
  /** Share of this Pokémon's usage that is in this form (0..1). */
  weight: number;
  /** Ability name -> share of this form's usage (0..1). */
  abilities: Record<string, number>;
}

export interface Pokemon {
  id: string;
  name: string;
  /** Fraction of teams this Pokémon appears on (0..1). */
  usage: number;
  forms: Form[];
}

export type Bucket = 'super' | 'neutral' | 'resisted' | 'immune';
export const BUCKETS: Bucket[] = ['super', 'neutral', 'resisted', 'immune'];

export function bucketOf(mult: number): Bucket {
  if (mult === 0) return 'immune';
  if (mult < 1) return 'resisted';
  if (mult === 1) return 'neutral';
  return 'super';
}

/** One concrete situation (form + ability) and how well the selected types hit it. */
export interface Scenario {
  form: string;
  ability: string;
  weight: number;
  mult: number;
  /** Every selected type that achieves `mult` (ties included). */
  bestTypes: TypeName[];
  note?: string;
}

export interface PokemonCoverage {
  pokemon: Pokemon;
  scenarios: Scenario[];
  /** Probability of each bucket across forms/abilities. */
  buckets: Record<Bucket, number>;
  /** The most likely scenario, used for the table's headline number. */
  main: Scenario;
  /** True when different forms/abilities land in different buckets. */
  varies: boolean;
}

/**
 * Best multiplier any of `attacks` achieves against one form with one ability, and every
 * attacking type that ties for it (none when nothing gets through).
 */
export function bestHit(attacks: readonly AttackLike[], types: readonly string[], ability: string) {
  const effect = abilityEffect(ability);
  let mult = 0;
  let bestTypes: TypeName[] = [];
  for (const raw of attacks) {
    const atk = asAttack(raw);
    let m = attackMultiplier(atk, types);
    if (effect && !atk.ignoresAbility) m = effect.apply(m, atk.type);
    if (atk.tintedLens && m > 0 && m < 1) m *= 2;
    if (m === 0) continue;
    if (m > mult) {
      mult = m;
      bestTypes = [atk.type];
    } else if (m === mult && !bestTypes.includes(atk.type)) {
      bestTypes.push(atk.type);
    }
  }
  return {mult, bestTypes, note: effect?.note};
}

export function coverPokemon(attacks: readonly AttackLike[], pokemon: Pokemon): PokemonCoverage {
  const scenarios: Scenario[] = [];
  for (const form of pokemon.forms) {
    const abilities = Object.entries(form.abilities);
    // A form with no known ability data still counts, just without ability modifiers.
    if (!abilities.length) abilities.push(['', 1]);
    for (const [ability, share] of abilities) {
      const weight = form.weight * share;
      if (weight <= 0) continue;
      scenarios.push({form: form.name, ability, weight, ...bestHit(attacks, form.types, ability)});
    }
  }
  const total = scenarios.reduce((sum, s) => sum + s.weight, 0) || 1;
  const buckets: Record<Bucket, number> = {super: 0, neutral: 0, resisted: 0, immune: 0};
  for (const s of scenarios) buckets[bucketOf(s.mult)] += s.weight / total;
  const main = scenarios.reduce((a, b) => (b.weight > a.weight ? b : a));
  const varies = new Set(scenarios.map(s => bucketOf(s.mult))).size > 1;
  return {pokemon, scenarios, buckets, main, varies};
}

export interface CoverageSummary {
  /** Share of the roster (weighted or not) in each bucket, 0..1. */
  buckets: Record<Bucket, number>;
  results: PokemonCoverage[];
}

/**
 * Aggregate coverage over a roster. With `weighted`, each Pokémon counts by its usage;
 * otherwise each counts equally.
 */
export function coverRoster(
  attacks: readonly AttackLike[],
  roster: readonly Pokemon[],
  weighted: boolean,
): CoverageSummary {
  const results = roster.map(p => coverPokemon(attacks, p));
  const buckets: Record<Bucket, number> = {super: 0, neutral: 0, resisted: 0, immune: 0};
  let total = 0;
  for (const r of results) {
    const w = weighted ? r.pokemon.usage : 1;
    total += w;
    for (const b of BUCKETS) buckets[b] += r.buckets[b] * w;
  }
  if (total > 0) for (const b of BUCKETS) buckets[b] /= total;
  return {buckets, results};
}
