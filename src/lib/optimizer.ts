/**
 * Spread optimizer for the Calc tab: the fewest stat points that let a set survive chosen attacks
 * (every damage roll, from full HP) and outspeed a target, leaving the rest where it was.
 */
import type {MoveData, SpeciesData} from '../data/types';
import {toCombatant, type CalcSet} from './calcset';
import {estimateDamage, type Field, type SideConditions} from './damage';
import {toID} from './ids';
import {MAX_STAT_SP, MAX_TOTAL_SP} from './legality';
import {calcStat, NATURES, NEUTRAL_NATURES, STATS, type StatName, type StatsTable} from './stats';

export interface OptimizeGoal {
  /** The set to change and its species. */
  set: CalcSet;
  species: SpeciesData;
  /** The attacker (as set up in the Calc) and the moves to survive. */
  attacker: {set: CalcSet; species: SpeciesData};
  survive: MoveData[];
  /** Speed to beat (effective Speed: boosts and Choice Scarf included); none when omitted. */
  outspeed?: number;
  /** Natures to try; the set's own nature when omitted. */
  natures?: string[];
  field: Field;
  attackerSide: SideConditions;
  defenderSide: SideConditions;
  singleTarget: boolean;
}

export interface SurviveCheck {
  move: string;
  /** Highest roll as % of max HP with the new spread. */
  maxPercent: number;
}

export interface OptimizeResult {
  nature: string;
  sp: StatsTable;
  /** Points on the goal stats only, and points left unspent overall. */
  spent: number;
  left: number;
  checks: SurviveCheck[];
  speed: number;
}

export interface OptimizeFailure {
  /** Why no spread works, e.g. "Flare Blitz still does up to 124% with 32 HP / 32 Def". */
  reason: string;
}

const STAGE = (n: number) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));

/** Speed as it acts in battle: stat boosts and Choice Scarf applied. */
export function effectiveSpeed(set: CalcSet, species: SpeciesData, sp = set.sp.spe, nature = set.nature): number {
  const stat = calcStat('spe', species.baseStats.spe, sp, nature);
  const boosted = Math.floor(stat * STAGE(set.boosts.spe));
  return toID(set.item) === 'choicescarf' ? Math.floor(boosted * 1.5) : boosted;
}

/** The defense a move hits: Defense for physical moves (and Psyshock-style ones), else Sp. Def. */
const defenseOf = (move: MoveData): 'def' | 'spd' => (move.category === 'Physical' || move.defensive === 'def' ? 'def' : 'spd');

/**
 * Natures worth trying, the current one first: none that lowers a goal stat or a stat the set
 * attacks with.
 */
export function candidateNatures(current: string, protect: readonly StatName[]): string[] {
  const others = [...Object.keys(NATURES).filter(n => !protect.includes(NATURES[n][1])), NEUTRAL_NATURES[0]];
  return [current, ...others.filter(n => n !== current && !(NEUTRAL_NATURES.includes(current) && NEUTRAL_NATURES.includes(n)))];
}

export function optimizeSpread(goal: OptimizeGoal): OptimizeResult | OptimizeFailure {
  const {set, species, attacker, survive} = goal;
  const moves = survive.filter(m => m.category !== 'Status');
  const defenses = [...new Set(moves.map(defenseOf))];
  const goalStats: StatName[] = [...(moves.length ? (['hp', ...defenses] as StatName[]) : []), ...(goal.outspeed ? (['spe'] as const) : [])];
  if (!goalStats.length) return {reason: 'Pick a move to survive or a Speed to beat.'};

  const kept = STATS.filter(s => !goalStats.includes(s)).reduce((sum, s) => sum + set.sp[s], 0);
  const budget = MAX_TOTAL_SP - kept;
  const options = {attackerSide: goal.attackerSide, defenderSide: goal.defenderSide, crit: attacker.set.crit, singleTarget: goal.singleTarget};
  const from = toCombatant(attacker.set, attacker.species);

  /** Highest roll of each move against `sp` (from full HP), as a fraction of max HP. */
  const worst = (sp: StatsTable, nature: string, list: MoveData[]) =>
    list.map(m => {
      const d = toCombatant({...set, sp, nature, hp: 100}, species);
      const e = estimateDamage(from, d, m, goal.field, options);
      return e ? Math.max(...e.rolls) / e.maxHp : 0;
    });
  const survives = (sp: StatsTable, nature: string, list: MoveData[]) => worst(sp, nature, list).every(x => x < 1);

  let best: OptimizeResult | null = null;
  let closest = '';
  for (const nature of goal.natures ?? [set.nature]) {
    // Speed: the fewest points that beat the target.
    let spe = set.sp.spe;
    if (goal.outspeed) {
      const need = Array.from({length: MAX_STAT_SP + 1}, (_, i) => i).find(i => effectiveSpeed(set, species, i, nature) > goal.outspeed!);
      if (need === undefined) {
        closest ||= `Even 32 Spe points reach only ${effectiveSpeed(set, species, MAX_STAT_SP, nature)} Speed with ${nature} (needs ${goal.outspeed + 1}).`;
        continue;
      }
      spe = need;
    }
    const base = {...set.sp, spe};
    let choice: {sp: StatsTable; bulk: number} | null = null;
    if (!moves.length) choice = {sp: base, bulk: 0};
    else {
      for (let hp = 0; hp <= MAX_STAT_SP; hp++) {
        const sp = {...base, hp};
        let ok = true;
        // Each defense only matters for the moves that hit it: binary search its fewest points.
        for (const stat of defenses) {
          const list = moves.filter(m => defenseOf(m) === stat);
          if (!survives({...sp, [stat]: MAX_STAT_SP}, nature, list)) {
            ok = false;
            break;
          }
          let lo = 0;
          let hi = MAX_STAT_SP;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (survives({...sp, [stat]: mid}, nature, list)) hi = mid;
            else lo = mid + 1;
          }
          sp[stat] = lo;
        }
        if (!ok) continue;
        const bulk = hp + defenses.reduce((sum, s) => sum + sp[s], 0);
        // Fewest points; on a tie, more HP (it helps against everything else too).
        if (!choice || bulk < choice.bulk || (bulk === choice.bulk && hp > choice.sp.hp)) choice = {sp, bulk};
      }
      if (!choice) {
        const maxed = {...base, hp: MAX_STAT_SP, def: MAX_STAT_SP, spd: MAX_STAT_SP};
        const w = worst(maxed, nature, moves);
        const i = w.indexOf(Math.max(...w));
        closest ||= `${moves[i].name} still does up to ${Math.round(w[i] * 100)}% with 32 HP / 32 ${defenseOf(moves[i]) === 'def' ? 'Def' : 'SpD'} (${nature}).`;
        continue;
      }
    }
    const spent = goalStats.reduce((sum, s) => sum + choice.sp[s], 0);
    if (spent > budget) {
      closest ||= `It needs ${spent} points on ${goalStats.join('/')} but only ${budget} are free (${nature}); lower the other stats first.`;
      continue;
    }
    if (!best || spent < best.spent) {
      best = {
        nature,
        sp: choice.sp,
        spent,
        left: budget - spent,
        checks: moves.map((m, i) => ({move: m.name, maxPercent: worst(choice.sp, nature, moves)[i] * 100})),
        speed: effectiveSpeed(set, species, choice.sp.spe, nature),
      };
    }
  }
  return best ?? {reason: closest || 'No spread works.'};
}
