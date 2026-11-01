# Pokémon VGC Tools

## Type Coverage

Pick a Pokémon Champions VGC regulation and up to four attacking move types to see how they hit the meta.

- Coverage buckets (super effective / neutral / resisted / immune), weighted by usage or flat
- Defensive abilities: Levitate, Water Absorb, Flash Fire, Thick Fat, Filter, Tera Shell, …
  weighted by how often each ability is actually run
- Mega Evolutions count as their own entries (as Smogon reports them)
- "Best type to add" ranking

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
writes `src/data/`. A regulation's roster is every Pokémon with ≥0.1% usage in its stats, so new
regulations appear automatically once Smogon publishes them. Re-run monthly.

### Not modelled (yet)

Tera, special moves (Freeze-Dry, Scrappy, Thousand Arrows, Flying Press), Lightning Rod / Storm
Drain redirection in doubles, actual damage.
