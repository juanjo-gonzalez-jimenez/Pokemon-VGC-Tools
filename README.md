# Pokémon VGC Tools

## Type Coverage

Pick a Pokémon Champions VGC regulation and up to four attacking move types to see how they hit the meta.

- Coverage buckets (super effective / neutral / resisted / immune), weighted by usage or flat
- Defensive abilities: Levitate, Water Absorb, Flash Fire, Thick Fat, Filter, Tera Shell, …
  weighted by how often each ability is actually run
- Mega Evolutions count as their own entries (as Smogon reports them)
- "Best type to add" ranking

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
- Threat list: the top-usage Pokémon your team struggles with most, scored on how many of your
  Pokémon its common moves (15%+ of sets) hit super effectively, how few of yours hit it super
  effectively, and how many it outspeeds; weighted by usage. A type + speed heuristic, not a
  damage calc.
- Teammate suggestions (swap ideas when the team is full): meta Pokémon scored on how often top
  players pair them with your members (Smogon teammate stats), which of your weak types they
  resist, which of your biggest threats their common moves hit super effectively, and which
  missing roles their usual set fills

Champions Speed formula: `trunc((base + SP + 20) × nature)`; HP is `base + SP + 75`.
The team is saved in the browser's local storage.

### Setup

Node 20+ is required (installed in WSL via nvm: `source ~/.nvm/nvm.sh`).

```sh
npm install
npm run dev          # local dev server
npm test             # unit tests
npm run build        # static site in dist/ (works on GitHub Pages)
npm run update-data  # refresh data from Showdown + Smogon
```

### Data

`npm run update-data` downloads Showdown's `pokedex.json` and the latest Smogon `chaos` usage
stats for every Pokémon Champions VGC format found in the last 3 months (1760 cutoff when available), and
writes `src/data/` (regulation rosters with usage, abilities, items, moves and Speed
distributions, plus `species.json` and `moves.json` for reading pasted teams). A regulation's roster is every Pokémon with ≥0.1% usage in its stats, so new
regulations appear automatically once Smogon publishes them. Re-run monthly.

### Not modelled (yet)

Special moves (Freeze-Dry, Scrappy, Thousand Arrows, Flying Press), Lightning Rod / Storm
Drain redirection in doubles, Tailwind / Trick Room, actual damage. Move data is base Gen 9, so
Champions-specific move changes aren't reflected.
