import type {MoveData} from '../data/types';
import {toID} from './ids';

/** Weather Ball's type under the weather its user's ability sets. */
const WEATHER_BALL_TYPES: Record<string, string> = {
  drought: 'Fire',
  drizzle: 'Water',
  sandstream: 'Rock',
  snowwarning: 'Ice',
};

/** The type a move actually has when used by a Pokémon with `ability`. */
export function moveType(move: MoveData, ability: string): string {
  if (toID(move.name) === 'weatherball') return WEATHER_BALL_TYPES[toID(ability)] ?? move.type;
  return move.type;
}
