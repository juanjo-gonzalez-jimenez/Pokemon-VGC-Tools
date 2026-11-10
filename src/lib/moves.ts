import type {MoveData} from '../data/types';
import {toID} from './ids';

/** Weather Ball's type under the weather its user's ability sets. */
const WEATHER_BALL_TYPES: Record<string, string> = {
  drought: 'Fire',
  drizzle: 'Water',
  sandstream: 'Rock',
  snowwarning: 'Ice',
};

/** Abilities that turn the user's Normal-type moves into another type. */
const NORMAL_MOVES_BECOME: Record<string, string> = {
  pixilate: 'Fairy',
  aerilate: 'Flying',
  refrigerate: 'Ice',
  galvanize: 'Electric',
};

/**
 * The type a move actually has when used by a Pokémon with `ability`. Status moves keep their own
 * type: abilities like Pixilate do change them in the game, but it never matters and showing
 * Protect as a Fairy move would only confuse.
 */
export function moveType(move: MoveData, ability: string): string {
  if (move.category === 'Status') return move.type;
  const ab = toID(ability);
  if (toID(move.name) === 'weatherball' && WEATHER_BALL_TYPES[ab]) return WEATHER_BALL_TYPES[ab];
  if (ab === 'normalize') return 'Normal';
  if (ab === 'liquidvoice' && move.sound) return 'Water';
  if (move.type === 'Normal' && NORMAL_MOVES_BECOME[ab]) return NORMAL_MOVES_BECOME[ab];
  return move.type;
}
