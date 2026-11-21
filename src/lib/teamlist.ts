/** What goes on a tournament team list: per-Pokémon rows, player details and labels in both languages. */
import {toID} from './ids';
import {withoutMega, type TeamMember} from './paste';
import type {Parse} from './storage';
import {calcStat, STATS, type StatName, type StatsTable} from './stats';
import {MAX_NAME} from './teams';

export type SheetLang = 'es' | 'en';

/** Shape of `src/data/names-es.json`: Showdown ID -> local name. */
export interface LocalNames {
  species: Record<string, string>;
  moves: Record<string, string>;
  items: Record<string, string>;
  abilities: Record<string, string>;
  natures: Record<string, string>;
}

export type Division = '' | 'juniors' | 'seniors' | 'masters';
export const DIVISIONS: Exclude<Division, ''>[] = ['juniors', 'seniors', 'masters'];

export interface PlayerInfo {
  name: string;
  trainer: string;
  switchProfile: string;
  battleTeam: string;
  playerId: string;
  /** `<input type="date">` value: YYYY-MM-DD. */
  birthDate: string;
  supportId: string;
  division: Division;
}

export const EMPTY_PLAYER: PlayerInfo = {
  name: '',
  trainer: '',
  switchProfile: '',
  battleTeam: '',
  playerId: '',
  birthDate: '',
  supportId: '',
  division: '',
};

/** Stored player details, from localStorage: anything unexpected is dropped. */
export const parsePlayer: Parse<PlayerInfo> = raw => {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const stored = data as Record<string, unknown>;
  const player = {...EMPTY_PLAYER};
  for (const key of Object.keys(EMPTY_PLAYER) as (keyof PlayerInfo)[]) {
    const value = stored[key];
    if (typeof value !== 'string') continue;
    if (key === 'division') player.division = (DIVISIONS as string[]).includes(value) ? (value as Division) : '';
    else player[key] = value.slice(0, MAX_NAME);
  }
  return player;
};

export const REQUIRED_DETAILS: (keyof PlayerInfo)[] = ['name', 'trainer', 'switchProfile', 'playerId', 'birthDate', 'division'];
export const missingDetails = (p: PlayerInfo) => REQUIRED_DETAILS.filter(key => !p[key].trim());

export interface SheetPokemon {
  species: string;
  nature: string;
  ability: string;
  item: string;
  moves: [string, string, string, string];
  stats: StatsTable;
}

/**
 * One Pokémon as the team list shows it: the form in the battle team (a Mega holder as its base
 * species, with base-form stats at level 50), names in the sheet's language (English if unknown).
 */
export function sheetPokemon(member: TeamMember, lang: SheetLang, names: LocalNames | null): SheetPokemon {
  const m = withoutMega(member);
  const local = lang === 'es' ? names : null;
  const tr = (group: keyof LocalNames, text: string) => (text && local?.[group][toID(text)]) || text;
  const s = m.species;
  const base = s.baseSpecies ?? s.name;
  // A form keeps its English suffix: Raichu-Alola stays "Raichu-Alola" with the Spanish base name.
  const species = s.name.startsWith(base) ? tr('species', base) + s.name.slice(base.length) : s.name;
  const moves = m.moves.slice(0, 4).map(mv => tr('moves', mv.name));
  return {
    species,
    nature: tr('natures', m.nature),
    ability: tr('abilities', m.pastedAbility || m.ability),
    item: tr('items', m.item),
    moves: [0, 1, 2, 3].map(i => moves[i] ?? '') as SheetPokemon['moves'],
    stats: Object.fromEntries(STATS.map(st => [st, calcStat(st, s.baseStats[st], m.sp[st], m.nature)])) as StatsTable,
  };
}

/** YYYY-MM-DD -> DD/MM/YYYY (the owner's choice for both languages). */
export function formatBirthDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

export function teamListFileName(teamName: string): string {
  const slug = teamName
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug ? `team-list-${slug}.pdf` : 'team-list.pdf';
}

export interface SheetLabels {
  title: string;
  staffPage: string;
  opponentPage: string;
  player: Record<keyof PlayerInfo, string>;
  divisions: Record<Exclude<Division, ''>, string>;
  nature: string;
  ability: string;
  item: string;
  move: string;
  stats: Record<StatName, string>;
  footer: string;
}

export const LABELS: Record<SheetLang, SheetLabels> = {
  es: {
    title: 'Lista de equipo',
    staffPage: 'Para el personal del torneo',
    opponentPage: 'Hoja de equipo abierta',
    player: {
      name: 'Nombre del jugador',
      trainer: 'Nombre de Entrenador en el juego',
      switchProfile: 'Nombre del perfil de Switch',
      battleTeam: 'Número / nombre del Equipo de Combate',
      playerId: 'ID de jugador',
      birthDate: 'Fecha de nacimiento',
      supportId: 'ID de soporte',
      division: 'Categoría de edad',
    },
    divisions: {juniors: 'Júnior', seniors: 'Sénior', masters: 'Máster'},
    nature: 'Naturaleza',
    ability: 'Habilidad',
    item: 'Objeto',
    move: 'Movimiento',
    stats: {hp: 'PS', atk: 'Ataque', def: 'Defensa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidad'},
    footer: 'Hecho con VGC Tools',
  },
  en: {
    title: 'Team list',
    staffPage: 'For tournament staff',
    opponentPage: 'Open team sheet',
    player: {
      name: 'Player name',
      trainer: 'Trainer name in game',
      switchProfile: 'Switch profile name',
      battleTeam: 'Battle Team number / name',
      playerId: 'Player ID',
      birthDate: 'Date of birth',
      supportId: 'Support ID',
      division: 'Age division',
    },
    divisions: {juniors: 'Juniors', seniors: 'Seniors', masters: 'Masters'},
    nature: 'Nature',
    ability: 'Ability',
    item: 'Held item',
    move: 'Move',
    stats: {hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'},
    footer: 'Made with VGC Tools',
  },
};
