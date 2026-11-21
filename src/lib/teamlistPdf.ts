/**
 * Draws the team list PDF: page 1 for tournament staff (with stats), page 2 the open team sheet.
 * Loaded with import() only when someone downloads, so pdf-lib stays out of the main bundle.
 * The layout is our own (header band, label/value cards), not a copy of the official form.
 */
import {PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage} from 'pdf-lib';
import {STATS} from './stats';
import {formatBirthDate, LABELS, type PlayerInfo, type SheetLang, type SheetPokemon} from './teamlist';

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 36;
const MIN_SIZE = 7;
const INK = rgb(0, 0, 0);
const MUTED = rgb(0.38, 0.38, 0.42);
const LINE = rgb(0.72, 0.72, 0.76);
const BAND = rgb(0.94, 0.94, 0.96);

/** Each character the font can't draw (♀, emoji, curly quotes…) becomes "?"; pdf-lib would throw instead. */
export function safeText(text: string, charset: ReadonlySet<number>): string {
  return [...text].map(c => (charset.has(c.codePointAt(0)!) ? c : '?')).join('');
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  charset: ReadonlySet<number>;
}

/** Draws text that fits `maxWidth`: shrinks down to 7 pt, then cuts with "…". `align` right uses x as the right edge. */
function drawFit(
  page: PDFPage,
  fonts: Fonts,
  text: string,
  opts: {x: number; y: number; size: number; maxWidth: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' | 'center'},
) {
  const font = opts.bold ? fonts.bold : fonts.regular;
  let t = safeText(text, fonts.charset);
  let size = opts.size;
  while (size > MIN_SIZE && font.widthOfTextAtSize(t, size) > opts.maxWidth) size -= 0.5;
  if (font.widthOfTextAtSize(t, size) > opts.maxWidth) {
    while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > opts.maxWidth) t = t.slice(0, -1);
    t = `${t.trimEnd()}…`;
  }
  const width = font.widthOfTextAtSize(t, size);
  const x = opts.align === 'right' ? opts.x - width : opts.align === 'center' ? opts.x - width / 2 : opts.x;
  page.drawText(t, {x, y: opts.y, size, font, color: opts.color ?? INK});
}

/** Title band and player details; returns the y where the cards may start. */
function drawHeader(page: PDFPage, fonts: Fonts, lang: SheetLang, pageLabel: string, details: [string, string][]): number {
  const [w, h] = A4;
  const L = LABELS[lang];
  const bandH = 40;
  page.drawRectangle({x: MARGIN, y: h - MARGIN - bandH, width: w - 2 * MARGIN, height: bandH, color: BAND});
  drawFit(page, fonts, L.title, {x: MARGIN + 12, y: h - MARGIN - 27, size: 20, maxWidth: 250, bold: true});
  drawFit(page, fonts, pageLabel, {x: w - MARGIN - 12, y: h - MARGIN - 24, size: 11, maxWidth: 230, align: 'right', color: MUTED});

  const colW = (w - 2 * MARGIN - 24) / 2;
  const rowH = 28;
  let y = h - MARGIN - bandH - 12;
  details.forEach(([label, value], i) => {
    const x = MARGIN + (i % 2) * (colW + 24);
    const top = y - Math.floor(i / 2) * rowH;
    drawFit(page, fonts, label, {x, y: top - 8, size: 7, maxWidth: colW, color: MUTED});
    drawFit(page, fonts, value, {x, y: top - 21, size: 11, maxWidth: colW});
    page.drawLine({start: {x, y: top - 25}, end: {x: x + colW, y: top - 25}, thickness: 0.6, color: LINE});
  });
  y -= Math.ceil(details.length / 2) * rowH;
  return y - 10;
}

function drawCard(page: PDFPage, fonts: Fonts, lang: SheetLang, p: SheetPokemon, box: {x: number; y: number; w: number; h: number}, withStats: boolean) {
  const L = LABELS[lang];
  const pad = 9;
  page.drawRectangle({x: box.x, y: box.y, width: box.w, height: box.h, borderColor: INK, borderWidth: 1});
  const statsW = withStats ? 76 : 0;
  const mainW = box.w - statsW - 2 * pad;
  const top = box.y + box.h;
  drawFit(page, fonts, p.species, {x: box.x + pad, y: top - pad - 12, size: 13, maxWidth: box.w - 2 * pad, bold: true});
  const headerH = 26;
  page.drawLine({start: {x: box.x, y: top - headerH}, end: {x: box.x + box.w, y: top - headerH}, thickness: 0.6, color: LINE});

  const rows: [string, string][] = [
    ...(withStats ? [[L.nature, p.nature] as [string, string]] : []),
    [L.ability, p.ability],
    [L.item, p.item],
    ...p.moves.map((m, i) => [`${L.move} ${i + 1}`, m] as [string, string]),
  ];
  const labelW = 64;
  const rowH = (box.h - headerH - pad) / rows.length;
  rows.forEach(([label, value], i) => {
    const base = top - headerH - (i + 1) * rowH + rowH * 0.3;
    drawFit(page, fonts, label, {x: box.x + pad, y: base + 1, size: 7, maxWidth: labelW - 4, color: MUTED});
    drawFit(page, fonts, value, {x: box.x + pad + labelW, y: base, size: 10, maxWidth: mainW - labelW});
  });

  if (withStats) {
    const sx = box.x + box.w - statsW;
    page.drawLine({start: {x: sx, y: box.y}, end: {x: sx, y: top - headerH}, thickness: 0.6, color: LINE});
    const statH = (box.h - headerH - pad) / STATS.length;
    STATS.forEach((s, i) => {
      const base = top - headerH - (i + 1) * statH + statH * 0.3;
      drawFit(page, fonts, L.stats[s], {x: sx + 7, y: base + 1, size: 7, maxWidth: 38, color: MUTED});
      drawFit(page, fonts, String(p.stats[s]), {x: box.x + box.w - pad, y: base, size: 11, maxWidth: 26, bold: true, align: 'right'});
    });
  }
}

function drawPage(doc: PDFDocument, fonts: Fonts, lang: SheetLang, team: SheetPokemon[], player: PlayerInfo, staff: boolean) {
  const page = doc.addPage(A4);
  const [w] = A4;
  const L = LABELS[lang];
  const division = player.division ? L.divisions[player.division] : '';
  const details: [string, string][] = staff
    ? [
        [L.player.name, player.name],
        [L.player.playerId, player.playerId],
        [L.player.trainer, player.trainer],
        [L.player.birthDate, formatBirthDate(player.birthDate)],
        [L.player.switchProfile, player.switchProfile],
        [L.player.division, division],
        [L.player.battleTeam, player.battleTeam],
        [L.player.supportId, player.supportId],
      ]
    : [
        [L.player.name, player.name],
        [L.player.division, division],
        [L.player.trainer, player.trainer],
        [L.player.switchProfile, player.switchProfile],
      ];
  const cardsTop = drawHeader(page, fonts, lang, staff ? L.staffPage : L.opponentPage, details);
  const footerY = MARGIN;
  const gap = 10;
  const cardW = (w - 2 * MARGIN - gap) / 2;
  const cardH = (cardsTop - (footerY + 14) - 2 * gap) / 3;
  team.slice(0, 6).forEach((p, i) => {
    const x = MARGIN + (i % 2) * (cardW + gap);
    const y = cardsTop - (Math.floor(i / 2) + 1) * cardH - Math.floor(i / 2) * gap;
    drawCard(page, fonts, lang, p, {x, y, w: cardW, h: cardH}, staff);
  });
  drawFit(page, fonts, L.footer, {x: w / 2, y: footerY, size: 7, maxWidth: w - 2 * MARGIN, color: MUTED, align: 'center'});
}

export async function buildTeamListPdf(team: SheetPokemon[], player: PlayerInfo, lang: SheetLang): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const L = LABELS[lang];
  // Document metadata is Unicode, so the name goes in as typed.
  doc.setTitle(player.name ? `${L.title} - ${player.name}` : L.title);
  doc.setCreator('VGC Tools');
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // Both standard fonts use the same WinAnsi character set.
  const fonts = {regular, bold, charset: new Set(regular.getCharacterSet())};
  drawPage(doc, fonts, lang, team, player, true);
  drawPage(doc, fonts, lang, team, player, false);
  return doc.save();
}
