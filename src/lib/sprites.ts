import {toID} from './ids';

const SPRITES = 'https://play.pokemonshowdown.com/sprites';

/** Showdown's sheet of 40×30 pixel-art menu icons, 12 per row. */
export const ICON_SHEET_URL = `${SPRITES}/pokemonicons-sheet.png?v22`;
export const ICON_WIDTH = 40;
export const ICON_HEIGHT = 30;
const ICONS_PER_ROW = 12;

/** Showdown's sheet of 24×24 item icons, 16 per row, indexed by each item's `spritenum`. */
export const ITEM_SHEET_URL = `${SPRITES}/itemicons-sheet.png?v1`;
export const ITEM_ICON_SIZE = 24;
const ITEMS_PER_ROW = 16;

export function itemIconPosition(index: number): {x: number; y: number} {
  return {x: (index % ITEMS_PER_ROW) * ITEM_ICON_SIZE, y: Math.floor(index / ITEMS_PER_ROW) * ITEM_ICON_SIZE};
}

/** Background offset of icon `index` in the sheet. */
export function iconPosition(index: number): {x: number; y: number} {
  return {x: (index % ICONS_PER_ROW) * ICON_WIDTH, y: Math.floor(index / ICONS_PER_ROW) * ICON_HEIGHT};
}

/** Showdown sprite file name: "charizard-megay", "urshifu-rapidstrike", "garchomp". */
export function spriteId(name: string, baseSpecies?: string): string {
  if (!baseSpecies) return toID(name);
  return `${toID(baseSpecies)}-${toID(name.slice(baseSpecies.length + 1))}`;
}

/**
 * Pixel-art sprite URLs (Gen 5 style, 96×96), best first: the Pokémon's own, then its base
 * form's. Showdown has no pixel sprite yet for some new Megas, so they show their base form until
 * one is added.
 */
export function spriteUrls(sprite: string, baseSprite?: string): string[] {
  const urls = [`${SPRITES}/gen5/${sprite}.png`];
  if (baseSprite && baseSprite !== sprite) urls.push(`${SPRITES}/gen5/${baseSprite}.png`);
  return urls;
}
