import {useMemo} from 'react';
import type {MetaPokemon} from '../data/types';
import {metaSpeeds, metaSpeedSummary, theirSpeedIn, type MemberSpeed, type SpeedMode} from '../lib/team';
import {pct} from './CoverageSummary';
import {PokemonLink} from './PokemonLink';
import {Panel} from './Panel';
import {SpeedModeToggle, speedModeNote} from './SpeedModeToggle';

type Row =
  | {kind: 'team'; speed: number; entry: MemberSpeed}
  | {kind: 'meta'; speed: number; summary: ReturnType<typeof metaSpeedSummary>};

const range = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

interface Props {
  speeds: MemberSpeed[];
  roster: MetaPokemon[];
  mode: SpeedMode;
  onModeChange: (mode: SpeedMode) => void;
}

export function SpeedTiers({speeds, roster, mode, onModeChange}: Props) {
  const their = (s: number) => theirSpeedIn(s, mode);
  const trickRoom = mode === 'trickRoom';

  const rows = useMemo(() => {
    const all: Row[] = [
      ...speeds.map(entry => ({kind: 'team' as const, speed: entry.effective, entry})),
      ...roster.map(p => {
        const summary = metaSpeedSummary(p);
        return {kind: 'meta' as const, speed: theirSpeedIn(summary.common, mode), summary};
      }),
    ];
    // Order of action: fastest first, or slowest first under Trick Room. Ties list yours first.
    return all.sort(
      (a, b) => (trickRoom ? a.speed - b.speed : b.speed - a.speed) || (a.kind === 'team' ? -1 : 1),
    );
  }, [speeds, roster, mode, trickRoom]);

  const spreadTitle = (p: MetaPokemon) =>
    metaSpeeds(p)
      .slice(0, 8)
      .map(([s, share]) => `${their(s)}: ${pct(share, 0)}`)
      .join('\n');

  return (
    <Panel id="speed" title="Speed tiers" note={speedModeNote(mode)}>
      <SpeedModeToggle mode={mode} onChange={onModeChange} />
      <div className="speed-summary">
        {[...speeds]
          .sort((a, b) => b.outspeeds - a.outspeeds)
          .map((s, i) => (
            <div key={i} className="stat">
              <div className="stat-value">{pct(s.outspeeds, 0)}</div>
              <div className="stat-label">
                {s.member.label} ({s.effective}) moves first vs
              </div>
            </div>
          ))}
      </div>
      <div className="table-wrap">
        <table className="speed-ladder">
          <thead>
            <tr>
              <th className="num">Speed</th>
              <th>Pokémon</th>
              <th className="num">Range</th>
              <th className="num">With Scarf</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) =>
              r.kind === 'team' ? (
                <tr key={`t${i}`} className="mine">
                  <td className="num">{r.speed}</td>
                  <td>
                    <strong>{r.entry.member.label}</strong> <span className="tag">yours</span>
                  </td>
                  <td className="num" colSpan={2}>
                    moves first vs {pct(r.entry.outspeeds, 0)} of the meta
                  </td>
                </tr>
              ) : (
                <tr key={r.summary.pokemon.id} title={spreadTitle(r.summary.pokemon)}>
                  <td className="num">{r.speed}</td>
                  <td>
                    <PokemonLink pokemon={r.summary.pokemon} />
                  </td>
                  <td className="num muted">{range(their(r.summary.min), their(r.summary.max))}</td>
                  <td className="num muted">
                    {r.summary.scarf >= 0.05 &&
                      `${range(their(r.summary.scarfMin), their(r.summary.scarfMax))} (${pct(r.summary.scarf, 0)})`}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        {trickRoom ? 'Under Trick Room the slowest Pokémon move first, so the ladder is reversed. ' : ''}
        Speed is each meta Pokémon's most common Speed (Choice Scarf sets included). Range is without Scarf; With
        Scarf shows the Scarfed range and how many run it (5%+). Hover a row for the full split.
      </p>
    </Panel>
  );
}
