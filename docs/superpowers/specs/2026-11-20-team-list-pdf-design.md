# Team list PDF: design

Date: 2026-11-20. Status: approved by the owner on 2026-11-20.

## Why

Tournaments ask every player for a team list: one page for staff (with stats) and an
open team sheet for the opponent (no stats). Filling it in by hand, or fixing a broken
generator (the one the owner used left every stat but HP as "NaN"), is slow and easy to
get wrong. The app already knows the whole team, so it can produce both pages in one click.

## Goals

- A clearly visible **Download team list** button in the Team tab.
- Clicking it opens a pop-up: "In what language do you want to download?" with **Español**
  and **English**, plus the player details (decision A: asked here and remembered).
- One click downloads **one PDF with both pages**: page 1 for tournament staff, page 2 the
  open team sheet.
- Level-50 stats computed from the team's stat points and nature, so they are always right.
- Spanish output uses the official Spanish names for Pokémon, moves, items, abilities and natures.

## Non-goals

- No other languages for now (the name data makes adding one cheap later).
- No editing of the PDF in the app; change the team, download again.
- No upload, sharing or server: the PDF is made in the browser.

## Anti-goals (a failure even if it works)

- Looking like a copy of the official Play! Pokémon form: no logos, no copied wording
  beyond the field names a team list needs, and a visibly different layout.
- Sending the player's personal details (date of birth, Player ID) anywhere. They stay in
  that browser's localStorage only.
- Making the app slower for everyone: the PDF code loads only when someone clicks Download.

## Constraints

- Static site on GitHub Pages: everything runs client-side.
- Public repo: no official PDF or artwork gets committed.
- Project conventions: localStorage keys start with `vgc-tools:`; problems shown in red with the
  existing classes; name boxes stop at 24 characters; lint, tests and build pass; visual check at
  1440 px and 390 px with no sideways scroll.

## Approaches

1. **`pdf-lib`, drawing the sheet in code (picked).** Real `.pdf` download, identical on every
   browser and phone, about 200 KB loaded only on click.
2. Browser "Print, Save as PDF". No library, but people must pick "Save as PDF" themselves
   (easy to get wrong on phones) and margins/fonts vary by browser. Rejected: a form handed to staff
   must come out the same every time.
3. `jsPDF` converting HTML. Heavier, often blurry or misaligned text. Rejected.

The owner picked 1.

## Design

### The button (Team tab)

A primary (filled purple, like "Find spread") button with a download icon, labelled
**Download team list**, in the "Your team" panel right under the legality line ("No rule problems
found" or the red list of problems). That's where you finish setting up the team, and it shows
without scrolling. Disabled with a short reason when the team is empty.
*(My call: the owner left the spot open.)*

### The pop-up

A native `<dialog>` (keyboard and screen-reader friendly, Esc closes):

- **Language**: two large choices, Español / English. Remembered (`vgc-tools:team-list-lang`).
- **Player details**: Player name, In-game trainer name, Switch profile name, Battle Team number/name
  (optional), Player ID, Date of birth, Support ID (optional), Age division (Juniors / Seniors / Masters). Remembered together
  in `vgc-tools:player` (not per regulation: they're about the person). Text boxes stop at 24 characters.
- **Download** button. Empty required fields don't block the download (people may want to write them
  by hand); they are listed in red under the button as "These will be blank on the sheet: …".
- Legality problems are not repeated in the pop-up (the owner's choice): the Team tab already shows
  them right above the button.
- A one-line note: "Your details stay in this browser."

### The PDF

One A4 file, two pages, file name `team-list-<team name>.pdf` (`team-list.pdf` if unnamed).
Text uses the PDF standard Helvetica font, which covers every Spanish character (á, é, í, ó, ú, ñ, ü,
¿, ¡), so no font file is embedded. Any character it can't draw is replaced, never left as a blank box.
*(My call: avoids the missing-digit problem we hit in the official PDF's cut-down font.)*

Own layout, deliberately unlike the official form: a header band with the title
("Lista de equipo" / "Team list"), page label, and the player details in two columns; then six
Pokémon cards in a 2 × 3 grid. Each card: species name on top, then rows for Nature, Ability, Item,
and the four moves, with a stats column on the right (page 1 only). A small footer: "Made with VGC Tools".

- **Page 1, for tournament staff:** all player details, and per Pokémon: species, nature, ability,
  item, 4 moves, and the six level-50 stats (HP, Atk, Def, SpA, SpD, Spe).
- **Page 2, open team sheet:** player name, trainer name, Switch profile name, age division only
  (no date of birth, Player ID or Support ID), and per Pokémon: species, ability, item, 4 moves.
  No nature, no stats.

Rules for what goes on the sheet:

- Species is the form in the battle team, not the Mega (`baseSpecies`): Raichu holding Raichunite Y is
  listed as Raichu, and its stats are Raichu's.
- Stats are computed with `calcStat` from `src/lib/stats.ts` at level 50 from the member's stat points
  and nature. (Checked against a real team list: all six HP values matched.)
- Ability is the pasted ability (`pastedAbility`), falling back to the analysis ability.
- Fewer than 4 moves leaves blank rows. Fewer than 6 Pokémon leaves the empty cards out.
- Date of birth: typed as a date, printed DD/MM/YYYY in both languages (the owner's choice).

Fixed labels (Nature/Naturaleza, Ability/Habilidad, Held item/Objeto, Move/Movimiento, stat names,
page titles, field names) live in a small table in code for both languages.

### Spanish names

`npm run update-data` gains a step that downloads PokéAPI's open CSV files (`pokemon_species_names`,
`move_names`, `item_names`, `ability_names`, `nature_names`, plus the id tables) from its GitHub repo and
writes `src/data/names-es.json`: `{species, moves, items, abilities, natures}`, each keyed by Showdown ID.
Checked today: Spanish exists for Raichunite Y, Salamencite, Grassy Seed, Choice Scarf and all 25 natures;
the only items missing are Z-Crystals, which Champions doesn't use.

- Forms (e.g. Raichu-Alola, Rotom-Wash) are built from the species name plus the form word; any name
  without a Spanish entry falls back to English. The update script prints the Champions-legal names
  that fell back, so gaps are visible.
- The file is loaded only when a Spanish PDF is made.
- Like the other downloads in the script: sanity checks (e.g. hundreds of moves found), read as data, never run.

### Code layout

| Piece | Where |
|---|---|
| Sheet content (pure, tested): rows per Pokémon for a language, stats, date format | `src/lib/teamlist.ts` + `teamlist.test.ts` |
| PDF drawing with `pdf-lib`, imported with `import()` on click | `src/lib/teamlistPdf.ts` |
| Button + pop-up | `src/components/TeamListDownload.tsx`, styles in `src/styles/team.css` |
| Placed in | `src/pages/TeamPage.tsx` |
| Spanish names download | `scripts/update-data.ts` (step), output `src/data/names-es.json` |
| CLAUDE.md routing table | add the new files |

### Tests and checks

- `teamlist.ts`: species uses the non-Mega form, stats match known values (the six Pokémon from the
  owner's team: e.g. Sneasler Jolly 28/14/2/0/14/8 gives 183/164/82/54/114/162), Spanish names come
  through with English fallback, page 2 has no stats/nature/personal IDs, date printed DD/MM/YYYY.
- One test builds the actual PDF, reloads it with `pdf-lib`, and checks it has 2 pages.
- Visual check: render the PDF to an image and look at both pages in both languages; check the
  pop-up at 1440 px and 390 px.

## Left to the builder

Exact spacing, font sizes and colours of the sheet (black on white, print-friendly); the icon;
wording of the pop-up hints.
