/**
 * Doubles effects on top of the one-on-one damage model: Intimidate, Lightning Rod / Storm Drain
 * redirection, spread moves hitting both foes (and the partner), and a lead-vs-lead board.
 */
import type {MetaPokemon, MoveData, MoveTable} from '../data/types';
import {fromMember, fromMeta} from './combatant';
import {estimateDamage, type Combatant, type DamageEstimate, type Field} from './damage';
import {priorityBlocked, theirMoves} from './exchange';
import {fieldOf} from './field';
import {toID} from './ids';
import {withoutMega, type TeamMember} from './paste';

type Boosts = NonNullable<Combatant['boosts']>;

const INTIMIDATE_IMMUNE = ['clearbody', 'whitesmoke', 'fullmetalbody', 'hypercutter', 'innerfocus', 'oblivious', 'owntempo', 'scrappy'];

const clamp = (n: number) => Math.max(-6, Math.min(6, n));
const boosted = (c: Combatant, change: Boosts): Combatant => {
  const boosts: Boosts = {...c.boosts};
  for (const [stat, n] of Object.entries(change) as Array<[keyof Boosts, number]>) boosts[stat] = clamp((boosts[stat] ?? 0) + n);
  return {...c, boosts};
};

export const hasIntimidate = (c: Pick<Combatant, 'ability'>) => toID(c.ability) === 'intimidate';

/**
 * `target` hit by `user`'s Intimidate, as [user, target] afterwards. Clear Body and similar
 * abilities (and Clear Amulet) block it, Guard Dog raises Attack instead, Defiant and Competitive
 * answer with +2, and Mirror Armor sends the drop back to the user.
 */
export function intimidate(user: Combatant, target: Combatant): [Combatant, Combatant] {
  const ability = toID(target.ability);
  if (ability === 'mirrorarmor') return [dropAttack(user), target];
  return [user, dropAttack(target, ability === 'guarddog')];
}

function dropAttack(c: Combatant, guardDog = false): Combatant {
  const ability = toID(c.ability);
  if (guardDog) return boosted(c, {atk: 1});
  if (INTIMIDATE_IMMUNE.includes(ability) || toID(c.item) === 'clearamulet') return c;
  if (ability === 'defiant') return boosted(c, {atk: 1});
  if (ability === 'competitive') return boosted(c, {atk: -1, spa: 2});
  return boosted(c, {atk: -1});
}

/** One of your Pokémon and one of theirs as they face each other, Intimidate applied both ways. */
export function facing(me: Combatant, them: Combatant): [Combatant, Combatant] {
  let [a, b] = [me, them];
  if (hasIntimidate(a)) [a, b] = intimidate(a, b);
  if (hasIntimidate(b)) [b, a] = intimidate(b, a);
  return [a, b];
}

// ---------------------------------------------------------------- redirection

const REDIRECTORS: Record<string, string> = {lightningrod: 'Electric', stormdrain: 'Water'};
/** Move targets that pick one Pokémon, and so can be redirected. */
const SINGLE_TARGETS = ['normal', 'any', 'adjacentFoe'];

/** The type a Pokémon's ability draws in ('' when none). */
export const redirectType = (ability: string) => REDIRECTORS[toID(ability)] ?? '';

export const singleTarget = (move: MoveData) => SINGLE_TARGETS.includes(move.target);
export const isSpread = (move: MoveData) => move.target === 'allAdjacentFoes' || move.target === 'allAdjacent';
export const hitsPartner = (move: MoveData) => move.target === 'allAdjacent';

/** An attack that a redirector of type `type` pulls away from its intended target. */
export const redirectedBy = (e: DamageEstimate, type: string) => Boolean(type) && singleTarget(e.move) && e.type === type;

// ---------------------------------------------------------------- lead vs lead

export interface BoardHit {
  /** null: no damage possible (status move) or redirected. */
  estimate: DamageEstimate | null;
  /** The partner of the target that pulls this attack in. */
  redirectedTo?: string;
  /** A priority move that fails here (Psychic Terrain, Armor Tail…). */
  blocked?: boolean;
}

export interface BoardRow {
  attacker: string;
  move: MoveData;
  /** Share of their sets running the move (1 for yours). */
  share: number;
  spread: boolean;
  /** Damage to each foe, in the order of the foe pair. */
  foes: [BoardHit, BoardHit];
  /** Damage to the attacker's partner (moves that hit everyone adjacent). */
  partner?: BoardHit;
}

export interface LeadBoard {
  field: Field;
  /** Your leads and theirs as they are on the field (Intimidate drops applied). */
  yours: [Combatant, Combatant];
  theirs: [Combatant, Combatant];
  /** Your attacks into their leads, and theirs into yours. */
  mine: BoardRow[];
  against: BoardRow[];
  /** "Incineroar's Intimidate: Rillaboom −1 Atk" style notes. */
  notes: string[];
}

/** Their moves shown on the board: run by at least this share of sets, most used first. */
export const BOARD_MOVE_SHARE = 0.15;
const BOARD_MAX_MOVES = 4;

/** Intimidate from every Intimidate user on one side into both foes. */
function applyIntimidates(side: Combatant[], foes: Combatant[], notes: string[]): void {
  for (let i = 0; i < side.length; i++) {
    if (!hasIntimidate(side[i])) continue;
    for (let j = 0; j < foes.length; j++) {
      const before = {user: side[i].boosts?.atk ?? 0, target: foes[j].boosts ?? {}};
      [side[i], foes[j]] = intimidate(side[i], foes[j]);
      const after = foes[j].boosts ?? {};
      const changes = (['atk', 'spa'] as const)
        .map(s => [s, (after[s] ?? 0) - (before.target[s] ?? 0)] as const)
        .filter(([, n]) => n !== 0)
        .map(([s, n]) => `${n > 0 ? '+' : '−'}${Math.abs(n)} ${s === 'atk' ? 'Atk' : 'SpA'}`);
      const reflected = (side[i].boosts?.atk ?? 0) !== before.user;
      const effect = reflected
        ? `reflected by ${foes[j].name}'s Mirror Armor`
        : changes.length
          ? `${foes[j].name} ${changes.join(', ')}`
          : `${foes[j].name} unaffected`;
      notes.push(`${side[i].name}'s Intimidate: ${effect}`);
    }
  }
}

function rowsFor(
  attacker: Combatant,
  partner: Combatant,
  foes: [Combatant, Combatant],
  list: Array<[MoveData, number]>,
  field: Field,
): BoardRow[] {
  return list.flatMap(([move, share]) => {
    const probe = estimateDamage(attacker, foes[0], move, field);
    if (!probe) return [];
    const hit = (target: Combatant, other: Combatant): BoardHit => {
      const estimate = estimateDamage(attacker, target, move, field);
      if (!estimate) return {estimate: null};
      const pull = redirectType(other.ability);
      // The partner draws it in, unless the target itself has the same ability (then it's immune anyway).
      if (redirectedBy(estimate, pull) && redirectType(target.ability) !== pull) return {estimate: null, redirectedTo: other.name};
      return {estimate, blocked: priorityBlocked(estimate, target, field)};
    };
    const row: BoardRow = {
      attacker: attacker.name,
      move,
      share,
      spread: isSpread(move),
      foes: [hit(foes[0], foes[1]), hit(foes[1], foes[0])],
    };
    if (hitsPartner(move)) row.partner = {estimate: estimateDamage(attacker, partner, move, field)};
    return [row];
  });
}

/**
 * Two of your leads against two of theirs: every attack each side can make into each foe, with
 * spread moves on both foes (and the partner when it hits everyone), Intimidate from everyone on
 * the field and Lightning Rod / Storm Drain redirection between the two targets.
 */
export function leadBoard(
  yours: [TeamMember, TeamMember],
  theirs: [MetaPokemon, MetaPokemon],
  moves: MoveTable,
  fixedField?: Field,
): LeadBoard {
  const notes: string[] = [];
  // Only one Pokémon Mega Evolves per battle: with two stone holders, the first one does.
  if (yours[0].isMega && yours[1].isMega) {
    notes.push(`One Mega per battle: ${yours[1].label} stays as ${yours[1].baseSpecies.name}`);
    const base = withoutMega(yours[1]);
    yours = [yours[0], /-Mega(-|$)/.test(base.label) ? {...base, label: base.species.name} : base];
  }
  const mine = yours.map(fromMember);
  const opp = theirs.map(fromMeta);
  applyIntimidates(mine, opp, notes);
  applyIntimidates(opp, mine, notes);
  const field = fixedField ?? fieldOf([...mine, ...opp].map(c => c.ability));
  const [a, b] = mine as [Combatant, Combatant];
  const [x, y] = opp as [Combatant, Combatant];

  const myMoves = (m: TeamMember): Array<[MoveData, number]> => m.moves.filter(mv => mv.category !== 'Status').map(mv => [mv, 1]);
  const theirList = (p: MetaPokemon, c: Combatant): Array<[MoveData, number]> => {
    const {list, assumed} = theirMoves(p, c, moves);
    return list
      .filter(([, share]) => assumed || share >= BOARD_MOVE_SHARE)
      .sort((p1, p2) => p2[1] - p1[1])
      .slice(0, BOARD_MAX_MOVES);
  };
  return {
    field,
    yours: [a, b],
    theirs: [x, y],
    mine: [...rowsFor(a, b, [x, y], myMoves(yours[0]), field), ...rowsFor(b, a, [x, y], myMoves(yours[1]), field)],
    against: [
      ...rowsFor(x, y, [a, b], theirList(theirs[0], x), field),
      ...rowsFor(y, x, [a, b], theirList(theirs[1], y), field),
    ],
    notes,
  };
}
