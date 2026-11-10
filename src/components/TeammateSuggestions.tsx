import {MAX_TEAM_SIZE} from '../lib/paste';
import type {TeammateSuggestion} from '../lib/teammates';
import {pct} from './CoverageSummary';
import {PokemonLink} from './PokemonLink';
import {TypeBadge} from './TypeBadge';
import {Panel} from './Panel';

interface Props {
  suggestions: TeammateSuggestion[];
  teamSize: number;
}

export function TeammateSuggestions({suggestions, teamSize}: Props) {
  const full = teamSize >= MAX_TEAM_SIZE;
  return (
    <Panel
      id="teammates"
      title={full ? 'Swap ideas' : 'Teammate suggestions'}
      note={full ? 'your team is full: these would fit if you swap someone out' : 'meta Pokémon that fit this team'}
    >
      <div className="mate-cards">
        {suggestions.map(s => (
          <article key={s.pokemon.id} className="mate-card">
            <header>
              <strong>
                <PokemonLink pokemon={s.pokemon} />
              </strong>
              <span className="muted">{pct(s.pokemon.usage)} usage</span>
            </header>
            <div className="types">
              {(s.pokemon.forms[0]?.types ?? []).map(t => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            <div className="severity fit" title={`Fit ${pct(s.score, 0)}`}>
              <div style={{width: pct(s.score, 0)}} />
            </div>
            <dl>
              <dt>Paired with</dt>
              <dd>
                {s.pairings.length
                  ? s.pairings
                      .slice(0, 3)
                      .map(p => `${p.label} ${pct(p.rate, 0)}`)
                      .join(' · ')
                  : <span className="muted">rarely paired with your team</span>}
              </dd>
              {s.covers.length > 0 && (
                <>
                  <dt>Resists</dt>
                  <dd className="types">
                    {s.covers.map(t => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </dd>
                </>
              )}
              {s.checks.length > 0 && (
                <>
                  <dt>Checks</dt>
                  <dd>{s.checks.join(', ')}</dd>
                </>
              )}
              {s.roles.length > 0 && (
                <>
                  <dt>Adds</dt>
                  <dd>{s.roles.join(', ')}</dd>
                </>
              )}
            </dl>
          </article>
        ))}
      </div>
      <p className="muted small">
        "Paired with X 40%" means 40% of X's teams in the stats also run this Pokémon. The fit score mixes how often
        top players pair it with your team, which of your weak types it resists, which of your biggest threats it beats
        one-on-one with its usual set (estimated damage), and which missing roles its usual set fills.
      </p>
    </Panel>
  );
}
