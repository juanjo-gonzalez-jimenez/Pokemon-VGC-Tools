import type {ItemTable, ModData, MoveTable} from '../data/types';

/**
 * Move and item tables as they are in a regulation's game: type and base power changes applied,
 * and entries that don't exist there flagged `unavailable`.
 */
export function applyMod<T extends {moves: MoveTable; items: ItemTable}>(tables: T, mod: ModData): T {
  const goneMoves = new Set(mod.unavailableMoves);
  const goneItems = new Set(mod.unavailableItems);
  const moves: MoveTable = {};
  for (const [id, move] of Object.entries(tables.moves)) {
    const changed = mod.moves[id];
    moves[id] = changed || goneMoves.has(id) ? {...move, ...changed, ...(goneMoves.has(id) ? {unavailable: true} : {})} : move;
  }
  const items: ItemTable = {};
  for (const [id, item] of Object.entries(tables.items)) {
    items[id] = goneItems.has(id) ? {...item, unavailable: true} : item;
  }
  return {...tables, moves, items, ...(mod.learnsets ? {learnsets: mod.learnsets} : {})};
}
