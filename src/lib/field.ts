/** Which weather and terrain are assumed to be up, from the abilities that set them. */
import {NO_FIELD, type Field, type Terrain, type Weather} from './damage';
import {toID} from './ids';

export const FIELD_CHOICES = ['auto', 'none', 'rain', 'sun', 'sand', 'snow', 'grassy'] as const;
export type FieldChoice = (typeof FIELD_CHOICES)[number];

const WEATHER_SETTERS: Record<string, Weather> = {drizzle: 'rain', drought: 'sun', sandstream: 'sand', snowwarning: 'snow'};
const TERRAIN_SETTERS: Record<string, Terrain> = {grassysurge: 'grassy'};

/** The weather / terrain a group of abilities sets; conflicting setters cancel out. */
export function fieldOf(abilities: readonly string[]): Field {
  const weathers = new Set(abilities.map(a => WEATHER_SETTERS[toID(a)]).filter(Boolean));
  const terrains = new Set(abilities.map(a => TERRAIN_SETTERS[toID(a)]).filter(Boolean));
  return {
    weather: weathers.size === 1 ? [...weathers][0] : '',
    terrain: terrains.size === 1 ? [...terrains][0] : '',
  };
}

export interface FieldContext {
  choice: FieldChoice;
  /** Abilities of the opponent's six and of your team, for Auto. */
  theirs: string[];
  yours: string[];
}

/**
 * The field for one pairing. A fixed choice wins; on Auto, each of weather and terrain comes from
 * the two Pokémon themselves, else a setter on their team, else one on yours.
 */
export function resolveField(myAbility: string, theirAbility: string, ctx?: FieldContext): Field {
  if (ctx && ctx.choice !== 'auto') {
    if (ctx.choice === 'none') return NO_FIELD;
    if (ctx.choice === 'grassy') return {weather: '', terrain: 'grassy'};
    return {weather: ctx.choice, terrain: ''};
  }
  const pair = fieldOf([myAbility, theirAbility]);
  const theirs = fieldOf(ctx?.theirs ?? []);
  const yours = fieldOf(ctx?.yours ?? []);
  return {
    weather: pair.weather || theirs.weather || yours.weather,
    terrain: pair.terrain || theirs.terrain || yours.terrain,
  };
}
