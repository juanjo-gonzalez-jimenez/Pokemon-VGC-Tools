# Team List PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Download team list" button in the Team tab that asks for language (Español / English) and player details, then downloads one A4 PDF with the staff page (with level-50 stats) and the open team sheet.

**Architecture:** Spanish names are downloaded once by `npm run update-data` from PokéAPI's CSVs into `src/data/names-es.json`. A pure module (`teamlist.ts`) turns the parsed team plus player details into sheet rows; a drawing module (`teamlistPdf.ts`, `pdf-lib`, loaded with `import()` on click) draws both pages in an original layout; a dialog component wires it into the Team tab.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest, `pdf-lib` (new dependency), PokéAPI CSV data.

**Spec:** `docs/superpowers/specs/2026-11-20-team-list-pdf-design.md`

## Global Constraints

- Node comes from nvm: every shell runs `source ~/.nvm/nvm.sh` first.
- Before finishing any task: `npm run lint` (warnings fail), `npx vitest run`, `npm run build` all pass.
- Do **not** commit or push: the owner commits only when they ask. No co-author or attribution lines ever.
- localStorage keys start with `vgc-tools:`. Problems shown in red use `.warnings` / `.legality` / `.calc-warning` / `.field-error`.
- Text boxes stop at 24 characters (`MAX_NAME` from `src/lib/teams.ts`).
- `pdf-lib` is only reached through `import()` so the main bundle doesn't grow.
- Personal details never leave the browser: no network calls with them.
- Original layout only: no Play! Pokémon logos, no copy of the official form's look.
- Date of birth printed DD/MM/YYYY in both languages.
- Visual checks: headless Playwright from the scratchpad at 1440 px and 390 px, no sideways scroll (see memory `vgc-tools-visual-checks`).

## Review Focus

- **CSV fields with commas or quotes** (PokéAPI names such as `"Sr. Mime"`-style quoted fields): parsed as one field, not split. Test in Task 1.
- **Characters the standard PDF font can't draw** (e.g. `♀`, `’`, emoji in a team name): replaced with `?`, never a crash. pdf-lib throws on them otherwise. Test in Task 3.
- **Alternate forms** (`Raichu-Alola`, `Rotom-Wash`): Spanish name is the base species' Spanish name plus the English form suffix (`Raichu-Alola`); a Mega holder is printed as its base species with base stats. Test in Task 2.
- **Incomplete members** (no item, no ability, 1–3 moves, team of 1–5): blank fields/rows, empty cards left out, no crash. Test in Task 2 and Task 3.
- **Long Spanish text** (long move/item names, long player name) in a narrow box: font shrinks down to 7 pt, then truncates with `…`, never overflows the card. Test in Task 3.

---

### Task 1: Spanish names data

**Files:**
- Modify: `scripts/parsers.ts` (add two exports)
- Modify: `scripts/parsers.test.ts`
- Modify: `scripts/update-data.ts` (new step in `main()`)
- Create (generated): `src/data/names-es.json`

**Interfaces:**
- Produces `parseCsv(text: string): string[][]` (rows without the header; RFC 4180 quoting: `"a, b"` is one field, `""` inside quotes is a quote).
- Produces `localNames(identifiers: string[][], names: string[][], languageId: string): Record<string, string>`: `identifiers` rows are `[id, identifier, ...]`, `names` rows are `[ownerId, languageId, name, ...]`; returns `toID(identifier) → name` for that language.
- Produces `src/data/names-es.json` with shape `{species, moves, items, abilities, natures}`, each `Record<showdownId, spanishName>`. Spanish is PokéAPI language id `"7"`.

- [ ] **Step 1: Write the failing tests** in `scripts/parsers.test.ts`:

```ts
test('parseCsv drops the header and keeps quoted commas', () => {
  expect(parseCsv('id,name\n1,"Sr. Mime, el"\n2,"say ""hi"""\n')).toEqual([['1', 'Sr. Mime, el'], ['2', 'say "hi"']]);
});
test('localNames maps Showdown ids to one language', () => {
  const ids = [['264', 'choice-scarf'], ['2263', 'raichunite-y']];
  const names = [['264', '7', 'Pañuelo Elección'], ['264', '9', 'Choice Scarf'], ['2263', '7', 'Raichunita Y']];
  expect(localNames(ids, names, '7')).toEqual({choicescarf: 'Pañuelo Elección', raichunitey: 'Raichunita Y'});
});
```

- [ ] **Step 2: Run** `npx vitest run scripts/parsers.test.ts`. Expected: FAIL, `parseCsv` / `localNames` not exported.

- [ ] **Step 3: Implement both in `scripts/parsers.ts`.** `localNames` uses `toID` the same way the file's other parsers do.

- [ ] **Step 4: Run** `npx vitest run scripts/parsers.test.ts`. Expected: PASS.

- [ ] **Step 5: Add the step to `main()` in `scripts/update-data.ts`.** Download from `https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/<file>.csv` with the existing `get()`: pairs `pokemon_species`+`pokemon_species_names`, `moves`+`move_names`, `items`+`item_names`, `abilities`+`ability_names`, `natures`+`nature_names`. Floors with the existing `check()`: species ≥ 1000, moves ≥ 900, items ≥ 1500, abilities ≥ 300, natures = 25. Add `join(OUT_DIR, 'names-es.json')` to `outputs` (pretty JSON like the others) so it's only written when every check passes. Print one summary line, plus up to 20 species/moves/items/abilities used in any written regulation dex (species via `baseSpecies` when set) that have no Spanish name.

- [ ] **Step 6: Run** `npm run update-data`. Expected: finishes, `src/data/names-es.json` exists, `node -e "const n=require('./src/data/names-es.json');console.log(n.items.raichunitey, n.natures.timid, n.moves.fakeout, n.species.sneasler)"` prints `Raichunita Y Miedosa Sorpresa Sneasler`.

---

### Task 2: Sheet content (pure)

**Files:**
- Create: `src/lib/teamlist.ts`
- Create: `src/lib/teamlist.test.ts`

**Interfaces:**
- Consumes `TeamMember` (`src/lib/paste.ts`), `calcStat`, `STATS`, `StatsTable` (`src/lib/stats.ts`), `toID` (`src/lib/ids.ts`), the `names-es.json` shape from Task 1.
- Produces:
  - `type SheetLang = 'es' | 'en'`
  - `interface LocalNames { species; moves; items; abilities; natures: Record<string, string> }` (all five fields `Record<string, string>`)
  - `type Division = '' | 'juniors' | 'seniors' | 'masters'`
  - `interface PlayerInfo { name; trainer; switchProfile; battleTeam; playerId; birthDate; supportId: string; division: Division }`. `birthDate` is the `<input type="date">` value `YYYY-MM-DD`.
  - `const EMPTY_PLAYER: PlayerInfo`
  - `parsePlayer(raw: string): PlayerInfo | undefined`: a `Parse<PlayerInfo>` for `readStored`; bad JSON gives `undefined`, unknown keys are dropped, strings are cut to `MAX_NAME`.
  - `REQUIRED_DETAILS: (keyof PlayerInfo)[]` = `name, trainer, switchProfile, playerId, birthDate, division`; `missingDetails(p: PlayerInfo): (keyof PlayerInfo)[]`.
  - `interface SheetPokemon { species: string; nature: string; ability: string; item: string; moves: [string, string, string, string]; stats: StatsTable }`
  - `sheetPokemon(m: TeamMember, lang: SheetLang, names: LocalNames | null): SheetPokemon`
  - `formatBirthDate(iso: string): string`
  - `LABELS: Record<SheetLang, SheetLabels>`, where `SheetLabels` holds: `title` (`Lista de equipo` / `Team list`), `staffPage` (`Para el personal del torneo` / `For tournament staff`), `opponentPage` (`Hoja de equipo abierta` / `Open team sheet`), one label per `PlayerInfo` key, the division names, `nature`, `ability`, `item`, `move` (`Movimiento` / `Move`), `stats: Record<StatName, string>` (`PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad` / `HP, Atk, Def, SpA, SpD, Spe`), `footer` (`Hecho con VGC Tools` / `Made with VGC Tools`).
  - `teamListFileName(teamName: string): string`

- [ ] **Step 1: Write the failing tests** in `src/lib/teamlist.test.ts` (build members with `member`/`species` from `test-fixtures.ts`, real base stats):

```ts
test('level-50 stats from stat points and nature', () => {
  const sneasler = species('Sneasler', ['Fighting', 'Poison']);
  sneasler.baseStats = {hp: 80, atk: 130, def: 60, spa: 40, spd: 80, spe: 120};
  const m = member(sneasler, 'Unburden', {nature: 'Jolly', sp: {hp: 28, atk: 14, def: 2, spa: 0, spd: 14, spe: 8}});
  expect(sheetPokemon(m, 'en', null).stats).toEqual({hp: 183, atk: 164, def: 82, spa: 54, spd: 114, spe: 162});
});
test('a Mega holder is listed as its base species with base stats', () => {
  // baseSpecies Raichu (60/90/55/90/80/110), species a Mega form with other stats, isMega true,
  // Timid 23/0/14/0/2/27 → species 'Raichu', stats {hp:158, atk:99, def:89, spa:110, spd:102, spe:172}
});
test('Spanish names, form suffix, and English fallback', () => {
  // names: species {raichu:'Raichu'}, items {raichunitey:'Raichunita Y'}, natures {timid:'Miedosa'},
  // abilities {lightningrod:'Pararrayos'}, moves {fakeout:'Sorpresa'}
  // Raichu-Alola (baseSpecies 'Raichu') → species 'Raichu-Alola'; move 'Zap Cannon' missing → 'Zap Cannon'
});
test('ability is the pasted one, missing moves are blank', () => {
  // member with pastedAbility 'Defiant', ability 'Other', 1 move → ability 'Defiant', moves ['X', '', '', '']
});
test('dates print DD/MM/YYYY', () => {
  expect(formatBirthDate('1999-12-31')).toBe('31/12/1999');
  expect(formatBirthDate('')).toBe('');
});
test('stored player details are validated', () => {
  expect(parsePlayer('{oops')).toBeUndefined();
  expect(parsePlayer(JSON.stringify({name: 'x'.repeat(40), evil: 1}))).toEqual({...EMPTY_PLAYER, name: 'x'.repeat(24)});
});
test('missing details list only required empty ones', () => {
  expect(missingDetails({...EMPTY_PLAYER, name: 'Ana', division: 'masters'})).toEqual(['trainer', 'switchProfile', 'playerId', 'birthDate']);
});
test('file name', () => {
  expect(teamListFileName('Rain / Sun!')).toBe('team-list-rain-sun.pdf');
  expect(teamListFileName('')).toBe('team-list.pdf');
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/teamlist.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/teamlist.ts`.** Species: `m.baseSpecies`; Spanish name = `names.species[toID(baseSpecies.baseSpecies ?? baseSpecies.name)]` plus the part of `baseSpecies.name` after the base name (e.g. `-Alola`), else the English name. Ability: `m.pastedAbility || m.ability`. Stats: `calcStat(s, m.baseSpecies.baseStats[s], m.sp[s], m.nature)` for each of `STATS` (ignore `m.stats`). Nature, item, ability and moves are looked up by `toID` in `names` when `lang === 'es'`, falling back to the English text.

- [ ] **Step 4: Run** `npx vitest run src/lib/teamlist.test.ts`. Expected: PASS.

---

### Task 3: PDF drawing

**Files:**
- Modify: `package.json` / `package-lock.json` (`npm i pdf-lib`)
- Create: `src/lib/teamlistPdf.ts`
- Create: `src/lib/teamlistPdf.test.ts`

**Interfaces:**
- Consumes `SheetPokemon`, `PlayerInfo`, `SheetLang`, `LABELS`, `formatBirthDate` from Task 2.
- Produces `buildTeamListPdf(team: SheetPokemon[], player: PlayerInfo, lang: SheetLang): Promise<Uint8Array>`.
- Produces `safeText(text: string, charset: ReadonlySet<number>): string` (each code point not in `charset` becomes `?`), exported for the test.

Layout (A4, 595.28 × 841.89 pt, 36 pt margins, black on white, Helvetica / Helvetica-Bold from `StandardFonts`):
- Header band: `title` bold 20 pt on the left, the page label (`staffPage` / `opponentPage`) on the right; under it the player details in two columns of label + value with a thin rule under each value. Page 1: all `PlayerInfo` fields (date via `formatBirthDate`, division by its label). Page 2: `name`, `trainer`, `switchProfile`, `division` only.
- Six cards in a 2 × 3 grid filling the rest: species bold 13 pt, then rows Nature (page 1 only), Ability, Item, four Move rows. Page 1 adds a stats column on the right edge of each card: six label/value rows, values right-aligned. Fewer members: the empty cards are left out.
- Footer: `footer` text, 7 pt, centred.
- Every string goes through `safeText` with the font's `getCharacterSet()`, then a fit helper: shrink from the row's size down to 7 pt until `widthOfTextAtSize` fits; still too wide → truncate and end with `…`.

- [ ] **Step 1: Write the failing tests** in `src/lib/teamlistPdf.test.ts`:

```ts
test('one PDF with the staff page and the open team sheet', async () => {
  const bytes = await buildTeamListPdf([pokemon], {...EMPTY_PLAYER, name: 'Ana Pérez'}, 'es');
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
});
test('characters the font lacks become ? instead of throwing', async () => {
  expect(safeText('Nidoran♀ ’', new Set([...'Nidoran ?'].map(c => c.codePointAt(0)!)))).toBe('Nidoran? ?');
  await expect(buildTeamListPdf([{...pokemon, species: 'Nidoran♀'}], {...EMPTY_PLAYER, name: '🙂'}, 'en')).resolves.toBeInstanceOf(Uint8Array);
});
test('a full team with long Spanish names still builds', async () => {
  const long = {...pokemon, item: 'Pañuelo Elección Extraordinario Muy Largo', moves: ['Puño Incremento Extremo Largo', '', '', ''] as SheetPokemon['moves']};
  await expect(buildTeamListPdf(Array(6).fill(long), {...EMPTY_PLAYER, name: 'x'.repeat(24)}, 'es')).resolves.toBeInstanceOf(Uint8Array);
});
```

(`pokemon` is a `SheetPokemon` literal for Raichu with the stats from Task 2.)

- [ ] **Step 2: Run** `npx vitest run src/lib/teamlistPdf.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: `npm i pdf-lib`, then implement `src/lib/teamlistPdf.ts`** to the layout above.

- [ ] **Step 4: Run** `npx vitest run src/lib/teamlistPdf.test.ts`. Expected: PASS.

- [ ] **Step 5: Visual check of the PDF.** From the scratchpad, write the bytes for the owner's team (Raichu, Sneasler, Salamence, Annihilape, Incineroar, Rillaboom from the spec) in both languages to files, render both pages to PNG (pypdfium2 venv in the scratchpad) and look at them: nothing overlaps or leaves its card, page 2 has no stats, nature, date of birth, Player ID or Support ID, and the stats match the spec's table.

---

### Task 4: Button and pop-up in the Team tab

**Files:**
- Create: `src/components/TeamListDownload.tsx`
- Modify: `src/components/Icon.tsx` (add `'download'` to `IconName` and `PATHS`: a down arrow onto a tray)
- Modify: `src/pages/TeamPage.tsx` (render under the legality line in the "Your team" panel)
- Modify: `src/styles/team.css`
- Modify: `CLAUDE.md` (routing table: `teamlist.ts`, `teamlistPdf.ts`, `TeamListDownload.tsx`, `names-es.json`)

**Interfaces:**
- Consumes `TeamMember[]` (`team` in `TeamPage`), the active team's name (`activeTeam(store).name` via `useTeamStore`), everything from Tasks 2 and 3, `readStored`/`writeStored` (`src/lib/storage.ts`), `usePersistentState` + `oneOf`.
- Produces `TeamListDownload({team, teamName}: {team: TeamMember[]; teamName: string})`.

Behaviour:
- Button: `className="primary"`, `<Icon name="download" />` + `Download team list`; `disabled` with `title="Paste a team first"` when `team.length === 0`.
- Clicking opens a native `<dialog>` with `showModal()` (Esc and a Cancel button close it). Heading "In what language do you want to download?", two large toggle buttons `Español` / `English` (state `usePersistentState('vgc-tools:team-list-lang', 'es', oneOf(['es', 'en']))`).
- Player fields: a text input per `PlayerInfo` text field (`maxLength={MAX_NAME}`), `type="date"` for `birthDate`, a `<select>` for `division`. Labels in the chosen language from `LABELS`. Stored as JSON under `vgc-tools:player` with `readStored(key, EMPTY_PLAYER, parsePlayer)` / `writeStored` on every change.
- Note under the fields: "Your details stay in this browser."
- Download button: builds rows with `sheetPokemon` (loading `names-es.json` with `import()` only for Spanish), `const {buildTeamListPdf} = await import('../lib/teamlistPdf')`, then downloads via a `Blob` (`application/pdf`) and a temporary `<a download={teamListFileName(teamName)}>`. Shows "Making PDF…" while working. On error: a red `.field-error` line with the message, dialog stays open.
- When `missingDetails` isn't empty: a red `.field-error` line under the Download button, "These will be blank on the sheet: …" (labels in the chosen language). Download still works.

- [ ] **Step 1: Implement the component, icon, TeamPage placement, CSS and CLAUDE.md rows.** The dialog fits a 390 px screen (full width minus 16 px gutters, scrolls inside itself if taller than the screen).

- [ ] **Step 2: Run** `npm run lint && npx vitest run && npm run build`. Expected: all pass; `dist/assets` shows `pdf-lib` in its own chunk, not in the main `index-*.js` (`grep -l PDFDocument dist/assets/*.js` lists only a separate chunk).

- [ ] **Step 3: Visual check** (headless Playwright, `npx vite preview --port 4201`, then `pkill -f "vite preview"` as its own command): paste the owner's team into the Team tab at 1440 px and 390 px; the button is visible under the legality line without scrolling past the paste box; the dialog opens, Esc closes it, the fields remember values after reload; Download (both languages) produces a file; nothing scrolls sideways; no console errors.

- [ ] **Step 4: Report to the owner** with screenshots of the button, the dialog and both PDF pages. Don't commit.
