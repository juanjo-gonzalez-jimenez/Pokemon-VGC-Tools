import type {MetaPokemon, SpeciesData} from '../../data/types';
import type {LookupTables} from '../../data/useLookupTables';
import {BOOST_STATS, setStats, spProblems, spreadOptions, withSpread, type BoostStat, type CalcSet} from '../../lib/calcset';
import {NATURES, NEUTRAL_NATURES, STAT_LABELS, STATS} from '../../lib/stats';
import {pct} from '../CoverageSummary';
import {PokemonSearch} from '../PokemonSearch';
import {ItemIcon, Sprite} from '../Sprite';
import {TypeBadge, typingVars} from '../TypeBadge';

const NATURE_NAMES = [...Object.keys(NATURES), ...NEUTRAL_NATURES].sort();
const BOOSTS = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6];

interface Props {
  side: 'a' | 'b';
  title: string;
  dex: MetaPokemon[];
  tables: LookupTables;
  /** Item and move names for the input suggestions. */
  itemNames: string[];
  moveNames: string[];
  pokemon: MetaPokemon;
  species: SpeciesData;
  set: CalcSet;
  onChange: (set: CalcSet) => void;
  onPick: (p: MetaPokemon) => void;
}

export function CalcSide({side, title, dex, tables, itemNames, moveNames, pokemon, species, set, onChange, onPick}: Props) {
  const stats = setStats(set, species);
  const problems = spProblems(set.sp);
  const spreads = spreadOptions(pokemon);
  const spreadKey = `${set.nature}:${STATS.map(s => set.sp[s]).join('/')}`;
  const update = (patch: Partial<CalcSet>) => onChange({...set, ...patch});
  const abilities = [...new Set([...species.abilities, set.ability].filter(Boolean))];
  // This Pokémon's own common moves first, then every move in the game.
  const ownMoves = Object.keys(pokemon.moves);
  const movesId = `calc-moves-${side}`;
  const itemsId = `calc-items-${side}`;

  return (
    <section className={`panel calc-side calc-side-${side}`} style={typingVars(species.types)}>
      <header className="calc-side-head">
        <span className="calc-side-label">{title}</span>
        <div className="calc-identity">
          <Sprite key={pokemon.id} sprite={pokemon.sprite} baseSprite={pokemon.baseSprite} icon={pokemon.icon} size={72} />
          <div>
            <h2>{species.name}</h2>
            <div className="types">
              {species.types.map(t => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
        </div>
        <PokemonSearch dex={dex} onPick={onPick} placeholder="Change Pokémon…" label={`${title}: change Pokémon`} />
      </header>

      {spreads.length > 0 ? (
        <label className="calc-field">
          <span>Usage spread</span>
          <select value={spreads.some(([k]) => k === spreadKey) ? spreadKey : ''} onChange={e => e.target.value && onChange(withSpread(set, e.target.value))}>
            <option value="">Custom</option>
            {spreads.map(([key, share]) => (
              <option key={key} value={key}>
                {key.replace(':', ' ')} ({pct(share)})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="muted small">No usage data for this Pokémon: set its build by hand.</p>
      )}

      <div className="calc-row">
        <label className="calc-field">
          <span>Ability</span>
          <select value={set.ability} onChange={e => update({ability: e.target.value})}>
            {abilities.map(a => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="calc-field">
          <span>Nature</span>
          <select value={set.nature} onChange={e => update({nature: e.target.value})}>
            {NATURE_NAMES.map(n => (
              <option key={n} value={n}>
                {n}
                {NATURES[n] ? ` (+${STAT_LABELS[NATURES[n][0]]} −${STAT_LABELS[NATURES[n][1]]})` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="calc-field">
        <span>Item</span>
        <span className="calc-item">
          <ItemIcon item={set.item} items={tables.items} />
          <input list={itemsId} value={set.item} placeholder="No item" onChange={e => update({item: e.target.value})} />
        </span>
        <datalist id={itemsId}>
          {itemNames.map(n => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </label>

      <table className="calc-stats">
        <thead>
          <tr>
            <th />
            <th className="num">Base</th>
            <th className="num">Points</th>
            <th className="num">Stat</th>
            <th className="num">Boost</th>
          </tr>
        </thead>
        <tbody>
          {STATS.map(s => (
            <tr key={s}>
              <th scope="row">{STAT_LABELS[s]}</th>
              <td className="num muted">{species.baseStats[s]}</td>
              <td className="num">
                <input
                  type="number"
                  min={0}
                  max={32}
                  value={set.sp[s]}
                  aria-label={`${STAT_LABELS[s]} stat points`}
                  onChange={e => update({sp: {...set.sp, [s]: Math.max(0, Math.min(32, Number(e.target.value) || 0))}})}
                />
              </td>
              <td className="num strong">{stats[s]}</td>
              <td className="num">
                {s !== 'hp' && (
                  <select
                    value={set.boosts[s as BoostStat]}
                    aria-label={`${STAT_LABELS[s]} boost`}
                    onChange={e => update({boosts: {...set.boosts, [s]: Number(e.target.value)}})}
                  >
                    {BOOSTS.map(b => (
                      <option key={b} value={b}>
                        {b > 0 ? `+${b}` : b}
                      </option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {problems.length > 0 && <p className="calc-warning small">{problems.join('; ')}</p>}

      <div className="calc-moves">
        <span className="calc-label">Moves</span>
        {set.moves.map((m, i) => (
          <input
            key={i}
            list={movesId}
            value={m}
            placeholder={`Move ${i + 1}`}
            aria-label={`Move ${i + 1}`}
            onChange={e => update({moves: set.moves.map((x, j) => (j === i ? e.target.value : x))})}
          />
        ))}
        <datalist id={movesId}>
          {[...ownMoves, ...moveNames.filter(n => !ownMoves.includes(n))].map(n => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>

      <div className="calc-toggles">
        <label className="calc-field calc-hp">
          <span>HP %</span>
          <input type="number" min={1} max={100} value={set.hp} onChange={e => update({hp: Math.max(1, Math.min(100, Number(e.target.value) || 100))})} />
        </label>
        <label className="check">
          <input type="checkbox" checked={set.burned} onChange={e => update({burned: e.target.checked})} /> Burned
        </label>
        <label className="check">
          <input type="checkbox" checked={set.crit} onChange={e => update({crit: e.target.checked})} /> Critical hits
        </label>
        <button
          className="chip"
          onClick={() => update({boosts: {...set.boosts, atk: Math.max(-6, set.boosts.atk - 1)}})}
          title="Lower Attack by one stage"
        >
          Intimidated (−1 Atk)
        </button>
        {BOOST_STATS.some(s => set.boosts[s] !== 0) && (
          <button className="link" onClick={() => update({boosts: {atk: 0, def: 0, spa: 0, spd: 0, spe: 0}})}>
            Reset boosts
          </button>
        )}
      </div>
    </section>
  );
}
