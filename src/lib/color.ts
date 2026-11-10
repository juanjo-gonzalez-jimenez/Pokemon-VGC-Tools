/** Relative luminance of a "#rrggbb" colour (WCAG 2). */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two "#rrggbb" colours (1..21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const INK = '#16142a';
export const PAPER = '#ffffff';

/** Dark or white text, whichever reads better on `background`. */
export function readableOn(background: string): string {
  return contrast(background, INK) >= contrast(background, PAPER) ? INK : PAPER;
}
