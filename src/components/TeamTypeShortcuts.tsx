import type {MetaPokemon} from '../data/types';
import {useLookupTables} from '../data/useLookupTables';
import {toID} from '../lib/ids';
import {parseTeam} from '../lib/paste';
import {attackTypes} from '../lib/team';
import type {TypeName} from '../lib/typechart';
import {PokemonIcon} from './Sprite';
import {MAX_TYPES} from './TypePicker';

interface Props {
  /** The saved team paste from the Team tab. */
  teamText: string;
  roster: MetaPokemon[];
  mod: string | undefined;
  onPick: (types: TypeName[]) => void;
}

/** One button per member of the saved team that loads its attacking move types into the picker. */
export function TeamTypeShortcuts({teamText, roster, mod, onPick}: Props) {
  const tables = useLookupTables(mod);
  if (!tables) return null;
  const members = parseTeam(teamText, tables.species, tables.moves).members.filter(m => attackTypes(m).length > 0);
  if (!members.length) return null;
  const icons = new Map(roster.map(p => [p.id, p.icon]));

  return (
    <div className="team-shortcuts">
      <span className="muted">From your team:</span>
      {members.map((m, i) => {
        const icon = icons.get(toID(m.species.name));
        return (
          <button key={i} className="chip" onClick={() => onPick(attackTypes(m).slice(0, MAX_TYPES))}>
            {icon !== undefined && <PokemonIcon icon={icon} />}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
