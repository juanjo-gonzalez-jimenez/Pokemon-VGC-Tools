import {PDFDocument} from 'pdf-lib';
import {describe, expect, it} from 'vitest';
import {EMPTY_PLAYER, type SheetPokemon} from './teamlist';
import {buildTeamListPdf, safeText} from './teamlistPdf';

const pokemon: SheetPokemon = {
  species: 'Raichu',
  nature: 'Miedosa',
  ability: 'Pararrayos',
  item: 'Raichunita Y',
  moves: ['Electrocañón', 'Onda Certera', 'Sorpresa', 'Protección'],
  stats: {hp: 158, atk: 99, def: 89, spa: 110, spd: 102, spe: 172},
};

describe('buildTeamListPdf', () => {
  it('makes one PDF with the staff page and the open team sheet', async () => {
    const bytes = await buildTeamListPdf([pokemon], {...EMPTY_PLAYER, name: 'Ana Pérez'}, 'es');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });

  it('replaces characters the font lacks instead of throwing', async () => {
    expect(safeText('Nidoran♀ ’', new Set([...'Nidoran ?'].map(c => c.codePointAt(0)!)))).toBe('Nidoran? ?');
    const bytes = buildTeamListPdf([{...pokemon, species: 'Nidoran♀'}], {...EMPTY_PLAYER, name: '🙂 Ana'}, 'en');
    await expect(bytes).resolves.toBeInstanceOf(Uint8Array);
  });

  it('builds a full team with long Spanish names and long player details', async () => {
    const long: SheetPokemon = {
      ...pokemon,
      item: 'Pañuelo Elección Extraordinario Muy Largo',
      moves: ['Puño Incremento Extremo Largo', '', '', ''],
    };
    const player = {...EMPTY_PLAYER, name: 'x'.repeat(24), trainer: 'W'.repeat(24), birthDate: '1999-12-31'};
    const bytes = await buildTeamListPdf(Array(6).fill(long), player, 'es');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
});
