import type {SpeedMode} from '../lib/team';

export const SPEED_MODES: Array<{id: SpeedMode; label: string; note: string}> = [
  {id: 'normal', label: 'Normal', note: 'no speed control'},
  {id: 'myTailwind', label: 'My Tailwind', note: 'your Speed ×2'},
  {id: 'theirTailwind', label: 'Their Tailwind', note: 'opponents’ Speed ×2'},
  {id: 'trickRoom', label: 'Trick Room', note: 'slowest moves first'},
];

export const speedModeNote = (mode: SpeedMode) => SPEED_MODES.find(m => m.id === mode)?.note;

/** Normal / My Tailwind / Their Tailwind / Trick Room switch. */
export function SpeedModeToggle({mode, onChange}: {mode: SpeedMode; onChange: (mode: SpeedMode) => void}) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Speed control">
      {SPEED_MODES.map(m => (
        <button key={m.id} role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => onChange(m.id)}>
          {m.label}
        </button>
      ))}
    </div>
  );
}
