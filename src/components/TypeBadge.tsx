import type {CSSProperties} from 'react';
import {readableOn} from '../lib/color';

export const TYPE_COLORS: Record<string, string> = {
  Normal: '#9fa19f', Fire: '#e62829', Water: '#2980ef', Electric: '#fac000', Grass: '#3fa129',
  Ice: '#3dcef3', Fighting: '#ff8000', Poison: '#9141cb', Ground: '#915121', Flying: '#81b9ef',
  Psychic: '#ef4179', Bug: '#91a119', Rock: '#afa981', Ghost: '#704170', Dragon: '#5060e1',
  Dark: '#624d4e', Steel: '#60a1b8', Fairy: '#ef70ef',
};

const FALLBACK = '#888888';

/** CSS variables for a type: its colour and the text colour that stays readable on it. */
export function typeVars(type: string | undefined): CSSProperties {
  const color = (type && TYPE_COLORS[type]) || FALLBACK;
  return {'--type-color': color, '--type-on': readableOn(color)} as CSSProperties;
}

/** Variables for a Pokémon's typing: `--type-color` and `--type-color-2` (same as the first for mono types). */
export function typingVars(types: readonly string[]): CSSProperties {
  const first = TYPE_COLORS[types[0]] ?? FALLBACK;
  return {'--type-color': first, '--type-color-2': TYPE_COLORS[types[1]] ?? first} as CSSProperties;
}

export function TypeBadge({type}: {type: string}) {
  return (
    <span className="type-badge" style={typeVars(type)}>
      {type}
    </span>
  );
}
