/**
 * Recent tournament teams (from Limitless, downloaded by `npm run update-teams`): which teams use a
 * Pokémon, and turning a team into Showdown text for the Team tab.
 */
import type {MetaPokemon} from '../data/types';
import {parseSpread, STATS, STAT_LABELS, type StatsTable} from './stats';

export interface TournamentMember {
  /** Our species id as brought (base form for a Mega, e.g. "charizard"). */
  species: string;
  /** Name for the Showdown text, e.g. "Charizard". */
  name: string;
  /** The form it battles as: the Mega form when holding its stone, otherwise `species`. */
  form: string;
  formName: string;
  /** Menu-icon index of `form`. */
  icon?: number;
  item: string;
  ability: string;
  nature: string;
  moves: string[];
}

export interface TournamentTeam {
  event: {id: string; name: string; date: string; players: number};
  /** Limitless username (for the link) and display name. */
  player: string;
  playerName: string;
  placing: number;
  record: {wins: number; losses: number; ties: number};
  members: TournamentMember[];
}

/** Limitless's format id for a regulation: "gen9championsvgc2026regmcbo3" -> "M-C"; null if none. */
export function limitlessFormat(regId: string): string | null {
  const m = regId.match(/reg([a-z])([a-z])?(?:bo3)?$/);
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2]}`.toUpperCase() : m[1].toUpperCase();
}

/** Teams that bring `id`, by the form it battles as (Charizard-Mega-Y is not plain Charizard). */
export const teamsWith = (teams: TournamentTeam[], id: string) => teams.filter(t => t.members.some(m => m.form === id));

/** Best placings first, newest event first among equal placings: the latest winners lead. */
export const bestFirst = (teams: TournamentTeam[]) =>
  [...teams].sort((a, b) => a.placing - b.placing || b.event.date.localeCompare(a.event.date));

/** "1st", "2nd", "3rd", "11th"… */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** "9-2" or "9-2-1" with ties. */
export const recordText = ({wins, losses, ties}: TournamentTeam['record']) =>
  ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;

/** Saved-team name, e.g. "1st · MakeItRain". */
export const teamName = (team: TournamentTeam) => `${ordinal(team.placing)} · ${team.playerName}`;

/** The player's team page on Limitless. */
export const limitlessUrl = (team: TournamentTeam) =>
  `https://play.limitlesstcg.com/tournament/${encodeURIComponent(team.event.id)}/player/${encodeURIComponent(team.player)}/teamlist`;

/**
 * Stat points for a member: the most used usage spread with its nature, otherwise the most used
 * spread's points. Null when the Pokémon has no usage spreads.
 */
export function usualPoints(member: TournamentMember, roster: MetaPokemon[]): StatsTable | null {
  const entry = roster.find(p => p.id === member.form) ?? roster.find(p => p.id === member.species);
  const spreads = Object.entries(entry?.spreads ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => parseSpread(key))
    .filter(s => s !== null);
  return (spreads.find(s => s.nature === member.nature) ?? spreads[0])?.sp ?? null;
}

/** Showdown text for the Team tab; stat points come from the usual usage spreads (tournaments don't publish them). */
export function toPaste(team: TournamentTeam, roster: MetaPokemon[]): string {
  return team.members
    .map(m => {
      const sp = usualPoints(m, roster);
      const spLine = sp
        ? STATS.filter(s => sp[s] > 0)
            .map(s => `${sp[s]} ${STAT_LABELS[s]}`)
            .join(' / ')
        : '';
      return [
        m.item ? `${m.name} @ ${m.item}` : m.name,
        m.ability && `Ability: ${m.ability}`,
        spLine && `EVs: ${spLine}`,
        m.nature && `${m.nature} Nature`,
        ...m.moves.map(move => `- ${move}`),
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}
