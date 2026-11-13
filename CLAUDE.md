# Pokémon Champions VGC Tools

Vite + React 19 + TypeScript web app, deployed to GitHub Pages
(https://juanjo-gonzalez-jimenez.github.io/Pokemon-VGC-Tools/). Pushing to `main` deploys.

## Commands

Node comes only from nvm, so every shell needs `source ~/.nvm/nvm.sh` first.

- `npm run lint`: oxlint with `--deny-warnings`. Warnings fail it.
- `npx vitest run`: unit tests, in `src/lib/*.test.ts` and next to some components.
- `npm run build`: runs `tsc` and then `vite build`.
- `npm run update-data`: downloads Showdown data and Smogon stats into `src/data/`.
- `npm run update-teams`: downloads recent top tournament teams from Limitless (run after `update-data`).
- `npx vite preview --port 4201` serves the build at `http://localhost:4201/`, not at `/Pokemon-VGC-Tools/`. Run `pkill -f "vite preview"` as a separate command, because chaining it with other commands aborts the chain.

Before committing, run lint, tests and build. Commit and push only when the user asks. Never add co-author or attribution lines.

## Routing: where things live

### App shell
| What | Where |
|---|---|
| Tabs, routing (`#/dex`, `#/team`…), regulation select, footer | `src/App.tsx` (`PAGES`). The tab order is Pokémon, Team, Matchup, Calc, Coverage; an empty hash opens Pokémon. |
| Light/Dark switch | `src/components/ThemeToggle.tsx` |
| Disclaimer and credits footer (every tab) | `src/components/LegalFooter.tsx`; fonts are bundled via `@fontsource` imports in `src/main.tsx` (no Google Fonts) |
| Icons | `src/components/Icon.tsx` |
| Collapsible panels | `src/components/Panel.tsx`, `src/lib/collapsed.ts` |
| Styles | `src/styles/base.css` (shared inputs, tables, red problem style, tabs), plus `dex.css`, `team.css`, `matchup.css`, `calc.css` |

### Tabs
| Tab | Page | Main pieces |
|---|---|---|
| Pokémon (dex) | `src/pages/DexPage.tsx` | `components/dex/DexSidebar.tsx` (list, search, sort), `DexDetail.tsx` (stats, sets, usage tiles), `ShareList.tsx`. Sorting and trends: `lib/dex.ts`, `components/Trend.tsx`. |
| Team | `src/pages/TeamPage.tsx` (section tabs: Defense / Threats / Speed / Swap ideas / Top teams) | `TeamSwitcher.tsx` (saved teams), `TeamCards.tsx`, `DefensiveChart.tsx`, `SpeedTiers.tsx`, `ThreatList.tsx`, `RolesChecklist.tsx`, `TeammateSuggestions.tsx`, `TournamentTeams.tsx` |
| Matchup | `src/pages/MatchupPage.tsx` | `components/matchup/OpponentPicker.tsx`, `MatchupGrid.tsx`, `Lineups.tsx` (suggested fours) |
| Calc | `src/pages/CalcPage.tsx` | `components/calc/CalcSide.tsx` (one side's set), `SearchPicker.tsx` (the item and move dropdowns), `CalcResults.tsx`, `CalcFieldPanel.tsx`, `CalcOptimizer.tsx` |
| Coverage | `src/pages/CoveragePage.tsx` | `TypePicker.tsx`, `TeamTypeShortcuts.tsx`, `CoverageSummary.tsx`, `PokemonTable.tsx` (roster table), `Suggestions.tsx` |

### Logic (`src/lib`, pure and tested)
| Topic | File |
|---|---|
| Damage (`@smogon/calc` in Champions mode, `Generations.get(0)`) | `damage.ts` |
| Building a calc input from your member or a meta Pokémon | `combatant.ts` (`fromMember`, `fromMeta`, `mainAbility`) |
| 1v1 duel: KO turns, speed order, best move | `exchange.ts` (`duel`, `bestOption`, `expectedThreat`) |
| Doubles effects: Intimidate, redirection, spread moves | `doubles.ts` |
| Matchup grid scores and suggested bring-four | `matchup.ts` (`pairScore`, `matchupGrid`, `suggestBrings`, `BONUS`) |
| Auto weather and terrain | `field.ts` |
| Calc tab sets and state, usage sets, SP checks | `calcset.ts` |
| Spread optimizer | `optimizer.ts` |
| Stats, natures, SP formula | `stats.ts` |
| Parsing a Showdown paste | `paste.ts` |
| Team analysis: defence chart, speeds, speed modes | `team.ts` |
| Threats; teammate and type suggestions | `threats.ts`, `teammates.ts`, `suggest.ts` |
| Roles checklist | `roles.ts` |
| Legality (SP limits, items, learnsets) | `legality.ts`, `learnsets.ts` |
| Type chart, abilities that change it, move types | `typechart.ts`, `abilities.ts`, `attack.ts`, `moves.ts` |
| Type coverage of a roster | `coverage.ts` |
| Pokémon list search, sort and trends | `dex.ts` |
| Regulation mods applied to moves and items | `mods.ts` |
| Saved teams store, naming rules, share links | `teams.ts`; hook in `src/hooks/useSavedTeam.ts` |
| Tournament teams (Limitless): filtering, paste with usual spreads | `tournaments.ts`; data from `scripts/update-teams.ts` into `src/data/teams/<format>.json`, loaded by `src/data/useTournamentTeams.ts` |
| localStorage helpers, `regulationKey` (Bo1 and Bo3 share stored state) | `storage.ts`; hook in `src/hooks/usePersistentState.ts` |
| Sprites and icon sheets | `sprites.ts`, `components/Sprite.tsx` |
| Test builders | `test-fixtures.ts` |

### Data
| What | Where |
|---|---|
| Data types | `src/data/types.ts` |
| Regulation index (Bo3 regulations listed first, as the default) | `src/data/index.json` |
| One regulation's usage data and its Pokémon list | `src/data/regulations/<id>.json` and `<id>-dex.json` (Bo3 ids end in `bo3`) |
| Mod tables (moves, items, learnsets per game) | `src/data/mods/*.json`, loaded by `src/data/useLookupTables.ts` |
| Base species, moves, items | `src/data/species.json`, `moves.json`, `items.json` |
| Data download script | `scripts/update-data.ts` (fetching, sanity checks, previous month for trends) |
| Showdown source parsers (read as text, never executed) | `scripts/parsers.ts` |

## Conventions

- localStorage keys start with `vgc-tools:`. For example: `vgc-tools:teams`, `vgc-tools:theme`, and `vgc-tools:regulation-v2`. Per-regulation state goes through `regulationKey()`.
- Show problems in red with the existing classes: `.warnings`, `.legality`, `.calc-warning`, `.field-error`.
- Name boxes stop at 24 characters (`MAX_NAME`, `MAX_NAME_LENGTH`).
- Visual checks run headless Playwright from the scratchpad, at 1440 px and 390 px wide. Check that nothing scrolls sideways.
