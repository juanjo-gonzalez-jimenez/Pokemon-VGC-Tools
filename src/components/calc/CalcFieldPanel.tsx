import type {Field, SideConditions, Terrain, Weather} from '../../lib/damage';

const WEATHERS: Array<[Weather, string]> = [['', 'None'], ['rain', 'Rain'], ['sun', 'Sun'], ['sand', 'Sand'], ['snow', 'Snow']];
const TERRAINS: Array<[Terrain, string]> = [['', 'None'], ['grassy', 'Grassy'], ['electric', 'Electric'], ['psychic', 'Psychic'], ['misty', 'Misty']];
const CONDITIONS: Array<[keyof SideConditions, string]> = [
  ['reflect', 'Reflect'],
  ['lightScreen', 'Light Screen'],
  ['auroraVeil', 'Aurora Veil'],
  ['helpingHand', 'Helping Hand'],
  ['friendGuard', 'Friend Guard'],
];

interface Props {
  field: Field;
  sides: {a: SideConditions; b: SideConditions};
  names: {a: string; b: string};
  singleTarget: boolean;
  onField: (field: Field) => void;
  onSides: (sides: {a: SideConditions; b: SideConditions}) => void;
  onSingleTarget: (single: boolean) => void;
}

/** Weather, terrain and each side's conditions (screens and Friend Guard protect; Helping Hand boosts). */
export function CalcFieldPanel({field, sides, names, singleTarget, onField, onSides, onSingleTarget}: Props) {
  return (
    <section className="panel calc-field-panel">
      <h2>Field</h2>
      <p className="muted small">Doubles, level 50.</p>
      <label className="calc-field">
        <span>Weather</span>
        <select value={field.weather} onChange={e => onField({...field, weather: e.target.value as Weather})}>
          {WEATHERS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="calc-field">
        <span>Terrain</span>
        <select value={field.terrain} onChange={e => onField({...field, terrain: e.target.value as Terrain})}>
          {TERRAINS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {/* Pokémon A's side on the left, B's on the right, matching the panels around it. */}
      <table className="calc-conditions">
        <tbody>
          {CONDITIONS.map(([key, label]) => {
            const box = (side: 'a' | 'b') => (
              <td>
                {/* The label pads the box out to a comfortable tap area. */}
                <label className="cell-check">
                  <input
                    type="checkbox"
                    aria-label={`${label} on ${names[side]}'s side`}
                    checked={Boolean(sides[side][key])}
                    onChange={e => onSides({...sides, [side]: {...sides[side], [key]: e.target.checked}})}
                  />
                </label>
              </td>
            );
            return (
              <tr key={key}>
                {box('a')}
                <th scope="row">{label}</th>
                {box('b')}
              </tr>
            );
          })}
        </tbody>
      </table>
      <label className="check">
        <input type="checkbox" checked={singleTarget} onChange={e => onSingleTarget(e.target.checked)} /> Spread moves hit one target
      </label>
    </section>
  );
}
