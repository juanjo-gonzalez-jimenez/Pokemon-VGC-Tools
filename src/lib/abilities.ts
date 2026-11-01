import {toID} from './ids';
import type {TypeName} from './typechart';

/**
 * Defensive abilities that change how hard an attacking type hits.
 * `apply` receives the raw type-chart multiplier and returns the adjusted one.
 */
interface AbilityEffect {
  apply: (mult: number, attack: TypeName) => number;
  note: string;
}

const immune = (...types: TypeName[]) => (mult: number, atk: TypeName) =>
  types.includes(atk) ? 0 : mult;
const scale = (factor: number, ...types: TypeName[]) => (mult: number, atk: TypeName) =>
  types.includes(atk) ? mult * factor : mult;

export const ABILITY_EFFECTS: Record<string, AbilityEffect> = {
  levitate: {apply: immune('Ground'), note: 'Ground immune'},
  eartheater: {apply: immune('Ground'), note: 'Ground immune'},
  flashfire: {apply: immune('Fire'), note: 'Fire immune'},
  wellbakedbody: {apply: immune('Fire'), note: 'Fire immune'},
  waterabsorb: {apply: immune('Water'), note: 'Water immune'},
  stormdrain: {apply: immune('Water'), note: 'Water immune'},
  dryskin: {
    apply: (m, atk) => (atk === 'Water' ? 0 : atk === 'Fire' ? m * 1.25 : m),
    note: 'Water immune, Fire 1.25x',
  },
  voltabsorb: {apply: immune('Electric'), note: 'Electric immune'},
  lightningrod: {apply: immune('Electric'), note: 'Electric immune'},
  motordrive: {apply: immune('Electric'), note: 'Electric immune'},
  sapsipper: {apply: immune('Grass'), note: 'Grass immune'},
  thickfat: {apply: scale(0.5, 'Fire', 'Ice'), note: 'Fire/Ice 0.5x'},
  heatproof: {apply: scale(0.5, 'Fire'), note: 'Fire 0.5x'},
  waterbubble: {apply: scale(0.5, 'Fire'), note: 'Fire 0.5x'},
  purifyingsalt: {apply: scale(0.5, 'Ghost'), note: 'Ghost 0.5x'},
  fluffy: {apply: scale(2, 'Fire'), note: 'Fire 2x'},
  filter: {apply: m => (m > 1 ? m * 0.75 : m), note: 'Super-effective 0.75x'},
  solidrock: {apply: m => (m > 1 ? m * 0.75 : m), note: 'Super-effective 0.75x'},
  prismarmor: {apply: m => (m > 1 ? m * 0.75 : m), note: 'Super-effective 0.75x'},
  wonderguard: {apply: m => (m > 1 ? m : 0), note: 'Only super-effective hits'},
  terashell: {apply: m => (m > 0 ? 0.5 : 0), note: 'Everything 0.5x at full HP'},
};

export function abilityEffect(ability: string): AbilityEffect | undefined {
  return ABILITY_EFFECTS[toID(ability)];
}
