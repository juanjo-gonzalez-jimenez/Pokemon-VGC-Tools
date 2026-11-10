import {useState} from 'react';
import type {ItemTable} from '../data/types';
import {toID} from '../lib/ids';
import {
  ICON_HEIGHT,
  ICON_SHEET_URL,
  ICON_WIDTH,
  iconPosition,
  ITEM_ICON_SIZE,
  ITEM_SHEET_URL,
  itemIconPosition,
  spriteUrls,
} from '../lib/sprites';

interface SpriteProps {
  sprite?: string;
  baseSprite?: string;
  /** Rendered box size in px (Gen 5 sprites are 96×96). */
  size?: number;
}

/** A full-size Showdown sprite that falls back through spriteUrls() and hides itself if none load. */
export function Sprite({sprite, baseSprite, size = 96}: SpriteProps) {
  const urls = sprite ? spriteUrls(sprite, baseSprite) : [];
  const [failed, setFailed] = useState(0);
  const src = urls[failed];
  return (
    <span className="sprite" style={{width: size, height: size}} aria-hidden>
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          width={size}
          height={size}
          onError={() => setFailed(f => f + 1)}
        />
      )}
    </span>
  );
}

/** A crisp 40×30 pixel-art menu icon from Showdown's icon sheet, drawn at its native size. */
export function PokemonIcon({icon}: {icon?: number}) {
  const {x, y} = iconPosition(icon ?? 0);
  return (
    <span
      className="poke-icon"
      aria-hidden
      style={{
        width: ICON_WIDTH,
        height: ICON_HEIGHT,
        backgroundImage: icon ? `url(${ICON_SHEET_URL})` : undefined,
        backgroundPosition: `-${x}px -${y}px`,
      }}
    />
  );
}

/** A 24×24 pixel-art item icon from Showdown's item sheet; renders nothing for unknown items. */
export function ItemIcon({item, items}: {item: string; items: ItemTable | null | undefined}) {
  const sprite = items?.[toID(item)]?.sprite;
  if (!sprite) return null;
  const {x, y} = itemIconPosition(sprite);
  return (
    <span
      className="item-icon"
      aria-hidden
      style={{
        width: ITEM_ICON_SIZE,
        height: ITEM_ICON_SIZE,
        backgroundImage: `url(${ITEM_SHEET_URL})`,
        backgroundPosition: `-${x}px -${y}px`,
      }}
    />
  );
}
