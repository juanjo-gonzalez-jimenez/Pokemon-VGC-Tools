import type {Lineup} from '../../lib/matchup';
import type {TeamMember} from '../../lib/paste';
import {pct} from '../CoverageSummary';
import {Panel} from '../Panel';
import {PokemonIcon} from '../Sprite';

interface Props {
  lineups: Lineup[];
  iconOf: (member: TeamMember) => number | undefined;
  note?: string;
}

export function Lineups({lineups, iconOf, note}: Props) {
  // A stone holder that doesn't Mega Evolve shows as its base form, whatever name was pasted.
  const nameOf = (m: TeamMember) => (!m.isMega && /-Mega(-|$)/.test(m.label) ? m.species.name : m.label);
  const members = (list: TeamMember[], mega: TeamMember | null) =>
    list.map((m, i) => (
      <span key={i} className="lineup-member">
        <PokemonIcon icon={iconOf(m)} />
        {nameOf(m)}
        {m === mega && <span className="tag">Mega</span>}
      </span>
    ));

  return (
    <Panel id="lineups" title="Suggested line-ups" note={note}>
      <ol className="lineups">
        {lineups.map((l, i) => (
          <li key={i} className={`lineup${i === 0 ? ' best' : ''}`}>
            <header>
              <strong>{i === 0 ? 'Best pick' : `Option ${i + 1}`}</strong>
              <div className="severity fit" title={`Score ${pct(Math.min(1, l.score), 0)}`}>
                <div style={{width: pct(Math.max(0, Math.min(1, l.score)), 0)}} />
              </div>
            </header>
            <dl>
              <dt>Lead</dt>
              <dd>{members(l.leads, l.mega)}</dd>
              {l.back.length > 0 && (
                <>
                  <dt>Back</dt>
                  <dd>{members(l.back, l.mega)}</dd>
                </>
              )}
            </dl>
            <ul className="reasons">
              {l.reasons.map((r, k) => (
                <li key={k}>{r}</li>
              ))}
              {l.warnings.map((w, k) => (
                <li key={`w${k}`} className="warning">
                  {w}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="muted small">
        Built from estimated damage (who KOs whom first, priority included) plus roles (Fake Out, Intimidate, speed
        control, spread moves). Estimates ignore stat boosts, crits and partner support, so treat this as a starting
        point, not the answer.
      </p>
    </Panel>
  );
}
