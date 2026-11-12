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
tab to see:

- Defensive chart: what each attacking type does to each member (abilities and Mega forms
  included), with shared weaknesses called out
- Speed tiers: your Speeds against each meta Pokémon's real spread distribution (Choice Scarf
  sets included) and the share of the meta each member outspeeds, with Normal / My Tailwind /
  Their Tailwind / Trick Room modes
- Team roles checklist: Fake Out, Intimidate, speed control, redirection, Protect (3+ users),
  spread damage, priority attacks
- Legality checks: stat points (66 total, 32 per stat), Item Clause, Species Clause (Megas and
  forms count as their base species), impossible abilities, more than 4 moves
- Threat list: the top-usage Pokémon your team struggles with most, from estimated damage: how
  many of your Pokémon it likely KOs in two hits or fewer, how few of yours beat it one-on-one,
  and how many it acts before (priority, then Speed); weighted by usage
- Teammate suggestions (swap ideas when the team is full): meta Pokémon scored on how often top
  players pair them with your members (Smogon teammate stats), which of your weak types they
  resist, which of your biggest threats their usual set beats one-on-one (estimated damage), and
  which missing roles their usual set fills

Champions Speed formula: `trunc((base + SP + 20) × nature)`; HP is `base + SP + 75`.
The team is saved in the browser's local storage.

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
Not part of those scores: stat boosts (Swords Dance, Intimidate drops), accuracy, crits, burns,
screens, partner support and Unburden; the Calc tab handles most of them.

## Damage calculator

The **Calc** tab is a Showdown-style calculator for any two legal Pokémon of the regulation,
both ways at once. Each side starts from its most used set (ability, item, spread, moves) and
everything is editable: ability, item, nature, stat points (with the 32 / 66 limits), four moves,
stat boosts (−6 to +6, plus an "Intimidated" shortcut), burn, critical hits and current HP. The
field covers weather, all four terrains, Reflect, Light Screen, Aurora Veil, Helping Hand,
Friend Guard and single-target spread moves. Each move shows its damage range, the KO chance
(from current HP, multi-hit and recovery aware), the 16 rolls and Showdown's description line.
The setup is remembered per regulation. Learnsets aren't checked.

## Pokémon searcher

The searcher lists **every legal Pokémon** in the regulation (from Showdown's Champions
`formats-data.ts`, minus Flat Rules bans), not just the meta. Pokémon too rare at the rating
cutoff use all-ratings stats (labelled "all"); legal Pokémon nobody used show base data only.

The **Pokémon** tab uses the full screen: a sidebar with the regulation, a name search, sorting
(usage, name, base stat total or any single stat) and the list of Pokémon.
The selected Pokémon shows base stats, moves, items, abilities, natures, the most common
stat-point spreads (with resulting Lv. 50 stats) and common teammates (click one to open it).
Links like `#/dex/garchomp` open a Pokémon directly.

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
```

### Data

`npm run update-data` downloads Showdown's `pokedex.json`, moves and items, and the latest Smogon
`chaos` usage stats for every Pokémon Champions VGC format found in the last 3 months (1760
cutoff when available), and writes `src/data/`: regulation rosters with usage, abilities, items,
moves, spreads and Speed distributions, a searcher list of every legal Pokémon, and
`species.json` / `moves.json` / `items.json` for reading pasted teams. A regulation's meta roster
is every Pokémon with ≥0.1% usage, so new regulations appear automatically once Smogon
publishes them.

Showdown's source files are only read as text (`scripts/parsers.ts`, covered by tests). The
script computes everything first and aborts without writing if a result looks broken (too few
species, moves, items or legal Pokémon, or a list that shrank by more than 30%).

### Automation

- `.github/workflows/deploy.yml`: every push to `main` is linted, tested, built and published
  to GitHub Pages (repo Settings → Pages → Source: GitHub Actions).
- `.github/workflows/update-data.yml`: on the 3rd and 10th of each month (or run manually from
  the Actions tab) it refreshes the data, commits it if it changed and redeploys.

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

Lightning Rod / Storm Drain redirection in doubles, learnsets (whether a Pokémon can learn a
move), and in the Matchup / Team scores the effects listed under "Damage in the Matchup and Team
tabs".
