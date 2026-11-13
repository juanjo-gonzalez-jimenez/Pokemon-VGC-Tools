# Pokémon VGC Tools

## Type Coverage

Pick a Pokémon Champions VGC regulation and up to four attacking move types to see how they hit the meta.

- Coverage buckets (super effective / neutral / resisted / immune), weighted by usage or flat
- Defensive abilities: Levitate, Water Absorb, Flash Fire, Thick Fat, Filter, Tera Shell, …
  weighted by how often each ability is actually run
- Mega Evolutions count as their own entries (as Smogon reports them)
- "Best type to add" ranking

The tabs are connected: Pokémon names in the threat list, teammate suggestions, speed tiers and
coverage table open that Pokémon on the Pokémon tab, and the Coverage tab offers one button per
member of your saved team to load its attacking types. Regulation, meta size, weighting, speed
mode, searcher sort and type filter are remembered in the browser.

## Team analysis

Paste a Showdown / Pokepaste export (the `EVs:` line holds Champions stat points) on the **Team**
tab. The team, its roles and its member cards stay on top; below them, section tabs
(**Defense · Threats · Speed · Swap ideas · Top teams**) show one analysis at a time, and the
last one picked is remembered. They cover:

- Defensive chart: what each attacking type does to each member (abilities and Mega forms
  included), with shared weaknesses called out
- Speed tiers: your Speeds against each meta Pokémon's real spread distribution (Choice Scarf
  sets included) and the share of the meta each member outspeeds, with Normal / My Tailwind /
  Their Tailwind / Trick Room modes
- Team roles checklist: Fake Out, Intimidate, speed control, redirection, Protect (3+ users),
  spread damage, priority attacks
- Legality checks: stat points (66 total, 32 per stat), Item Clause, Species Clause (Megas and
  forms count as their base species), impossible abilities, moves the Pokémon can't learn in the
  regulation (Showdown's Champions learnsets), more than 4 moves
- Threat list: the top-usage Pokémon your team struggles with most, from estimated damage: how
  many of your Pokémon it likely KOs in two hits or fewer, how few of yours beat it one-on-one,
  and how many it acts before (priority, then Speed); weighted by usage
- Teammate suggestions (swap ideas when the team is full): meta Pokémon scored on how often top
  players pair them with your members (Smogon teammate stats), which of your weak types they
  resist, which of your biggest threats their usual set beats one-on-one (estimated damage), and
  which missing roles their usual set fills

Champions Speed formula: `trunc((base + SP + 20) × nature)`; HP is `base + SP + 75`.

**Saved teams**: keep several named teams in the browser's local storage. You can switch between
them (on the Team tab, or from the Matchup tab), duplicate or delete them, and copy a team as
Showdown text. **Copy share link** gives a `#/team/import/…` link: opening it adds that team, or
switches to it if it's already saved.

## Matchup (lead / bring-4 suggester)

On the **Matchup** tab, enter the opponent's six from team preview (search by name; a species
with Mega forms starts as its most used form) against your saved team:

- **Suggested line-ups**: every group of four and pair of leads is scored; the top three are
  shown with reasons (who hits what, who moves first, Fake Out, Intimidate, speed control,
  spread moves, who stays out and why) and warnings about shared weaknesses
- **Matchup grid**: each of your Pokémon against each of theirs: your best hit and its expected
  best hit as estimated % of HP, and who acts first (priority, then Speed)
- **Their biggest threats to you**, with Tailwind / Trick Room modes

Their sets come from usage stats: most common ability, mean stats over all spreads, the item
most sets hold, and every move weighted by how many sets run it. Weather and terrain come from
the abilities in play (Auto) or a fixed choice.

### Damage in the Matchup and Team tabs

Every damage number comes from Smogon's damage calculator ([`@smogon/calc`](https://github.com/smogon/damage-calc))
in its **Pokémon Champions** mode: Champions stats, moves and abilities, Showdown's rounding and
all 16 rolls (`src/lib/damage.ts` maps our data onto it). The Matchup tab and the Team tab's
threats and teammate suggestions score each pairing by who knocks the other out in fewer hits,
then who acts first (priority, then Speed). They still show `~` because the opponent is an
average of its usage (mean stats over all spreads, moves weighted by how many sets run them).
Doubles effects in those scores:
- Intimidate lowers the other side's Attack in every pairing. Clear Body, Inner Focus, Defiant,
  Competitive, Guard Dog, Mirror Armor and Clear Amulet are handled.
- Line-ups credit spread moves for how many of their six they 2HKO. They warn when a lead's
  Earthquake-style move hits its partner hard, and note when the partner is immune.
- A Lightning Rod / Storm Drain user in your four draws their single-target Electric or Water
  attacks away from its partners. Their redirectors raise a warning instead, since they may not be
  brought.

Not part of those scores: other stat boosts (Swords Dance), accuracy, crits, burns, screens,
Helping Hand and Unburden; the Calc tab handles most of them.

## Damage calculator

The **Calc** tab is a Showdown-style calculator for any two legal Pokémon of the regulation,
both ways at once. Each side starts from its most used set (ability, item, spread, moves) and
everything is editable: ability, item, nature, stat points (with the 32 / 66 limits), four moves,
stat boosts (−6 to +6, plus an "Intimidated" shortcut), burn, critical hits and current HP. The
field covers weather, all four terrains, Reflect, Light Screen, Aurora Veil, Helping Hand,
Friend Guard and single-target spread moves. Each move shows its damage range, the KO chance
(from current HP, multi-hit and recovery aware), the 16 rolls and Showdown's description line.
The setup is remembered per regulation. The move list only offers moves the Pokémon can learn
in the regulation (and flags any typed move it can't).

The **Spread optimizer** under the results finds the fewest stat points for one side to:
- survive chosen attacks from the other side (every damage roll, from full HP);
- outspeed the other side or a given Speed (boosts and Choice Scarf included).

It uses everything set in the calculator (items, abilities, boosts, field, screens…). Stats that
aren't goals keep their points, and it can optionally try other natures that don't lower a goal
stat or an attacking stat the set uses. **Apply** writes the spread back to that side.

## Pokémon searcher

The searcher lists **every legal Pokémon** in the regulation (from Showdown's Champions
`formats-data.ts`, minus Flat Rules bans), not just the meta. Pokémon too rare at the rating
cutoff use all-ratings stats (labelled "all"); legal Pokémon nobody used show base data only.

The **Pokémon** tab uses the full screen. Its sidebar has:
- the regulation and a name search;
- sorting by usage, base stat total or any single stat;
- the list of Pokémon.

**Usage trends**: next to each usage figure (searcher, threat list, Coverage table), ▲/▼ shows the
change in percentage points since the previous month of the same regulation at the same rating
cutoff, or "new" for a Pokémon unused last month.
The selected Pokémon shows base stats, moves, items, abilities, natures, the most common
stat-point spreads (with resulting Lv. 50 stats), common teammates (click one to open it) and
recent top tournament teams that use it.
Links like `#/dex/garchomp` open a Pokémon directly.

## Tournament teams

Recent top teams from [Limitless](https://play.limitlesstcg.com/) tournaments: the top 4 of the
25 biggest events (32+ players) of the regulation in the last 30 days, with placing, record,
player and event. They appear on each Pokémon's page and in the Team tab's **Start from a top
team** panel (the latest winners first). **Open in Team tab** saves one as a new team. Tournaments don't publish stat
points, so each Pokémon gets its most used usage spread (with the team's nature when one
matches); edit them in the text. The player's name links to the team on Limitless.

### Setup

Live site: https://juanjo-gonzalez-jimenez.github.io/Pokemon-VGC-Tools/

Node 20+ is required (installed in WSL via nvm: `source ~/.nvm/nvm.sh`).

```sh
npm install
npm run dev          # local dev server
npm run lint         # oxlint
npm test             # unit tests
npm run build        # static site in dist/
npm run update-data  # refresh data from Showdown + Smogon
npm run update-teams # refresh tournament teams from Limitless (after update-data)
```

### Data

`npm run update-data` downloads Showdown's `pokedex.json`, moves and items, and the latest Smogon
`chaos` usage stats for every Pokémon Champions VGC format found in the last 3 months (1760
cutoff when available), and writes `src/data/`: regulation rosters with usage, abilities, items,
moves, spreads and Speed distributions, a searcher list of every legal Pokémon, and
`species.json` / `moves.json` / `items.json` for reading pasted teams. A regulation's meta roster
is every Pokémon with ≥0.1% usage, so new regulations appear automatically once Smogon
publishes them.

Each regulation comes twice in the regulation menu:
- **(Bo3)**, the default: best-of-three, tournament-style play. It has fewer battles, but
  players build their own spreads.
- **(Bo1)**: the best-of-one ladder. It has many more battles, but copied rental teams can
  dominate a Pokémon's sets.

Both share your saved opponents, leads and calculator setup.

`npm run update-teams` reads Limitless's public API (no key; 50 requests per 5 minutes, so it
waits when the limit is close) and writes `src/data/teams/<format>.json`, shared by a
regulation's Bo1 and Bo3 entries. Species are matched to Showdown ids, and a member holding its
Mega Stone is recorded as the Mega form it battles as.

Showdown's source files are only read as text (`scripts/parsers.ts`, covered by tests). The
script computes everything first and aborts without writing if a result looks broken (too few
species, moves, items or legal Pokémon, or a list that shrank by more than 30%).

### Automation

- `.github/workflows/deploy.yml`: every push to `main` is linted, tested, built and published
  to GitHub Pages (repo Settings → Pages → Source: GitHub Actions).
- `.github/workflows/update-data.yml`: every Monday (or run manually from the Actions tab) it
  refreshes the usage data and the tournament teams, commits them if they changed and
  redeploys. Smogon publishes a month's stats in the first days of the next month, so weekly
  runs pick them up within a week.

### Game accuracy

- **Champions changes**: each regulation uses its Showdown data mod (`champions`,
  `championsregmb`). Move type and base power changes are applied, and moves and items that
  don't exist in the game are flagged in the Team tab's legality checks (`src/data/mods/`).
- **Damage**: all damage numbers come from `@smogon/calc` in Champions mode (see above). The
  points below are the app's own type-level model, used by the Coverage tab, the defensive
  chart and type summaries.
- **Defender abilities**: Levitate, Flash Fire, Water Absorb, Thick Fat, Filter and similar.
- **Attacker abilities**: Pixilate / Aerilate / Refrigerate / Galvanize / Normalize / Liquid
  Voice change move types; Mold Breaker / Teravolt / Turboblaze ignore defensive abilities;
  Scrappy / Mind's Eye hit Ghost types; Tinted Lens doubles resisted hits.
- **Moves**: Weather Ball follows the user's weather ability, Freeze-Dry is super effective on
  Water, Flying Press combines Fighting and Flying.

### Not modelled (yet)

In the Matchup / Team scores, the effects listed under "Damage in the Matchup and Team tabs".

### Credits and disclaimer

Unofficial fan project, not affiliated with or endorsed by Nintendo, Game Freak, Creatures or
The Pokémon Company. Pokémon and all related names and images are trademarks and © of their
respective owners. Every tab's footer shows this and a **Credits** list:

- Usage statistics: [Smogon](https://www.smogon.com/stats/)
- Pokémon, move and item data, sprites and icons:
  [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) (MIT License); sprites and
  icons are loaded from Showdown's servers
- Damage calculator: [@smogon/calc](https://github.com/smogon/damage-calc) (MIT License)
- Tournament teams: [Limitless](https://play.limitlesstcg.com/)
- Fonts: Fira Sans and Chakra Petch (SIL Open Font License), bundled with the app through
  Fontsource, so visitors' browsers never contact Google Fonts
