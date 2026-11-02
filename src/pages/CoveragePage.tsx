import {useMemo} from 'react';
import {CoverageSummary} from '../components/CoverageSummary';
import {PokemonTable} from '../components/PokemonTable';
import {Suggestions} from '../components/Suggestions';
import {MAX_TYPES, TypePicker} from '../components/TypePicker';
import type {MetaPokemon} from '../data/types';
import {coverRoster} from '../lib/coverage';
import {suggestNext} from '../lib/suggest';
import type {TypeName} from '../lib/typechart';

interface Props {
  roster: MetaPokemon[];
  weighted: boolean;
  types: TypeName[];
  onTypesChange: (types: TypeName[]) => void;
}

export function CoveragePage({roster, weighted, types, onTypesChange}: Props) {
  const coverage = useMemo(() => coverRoster(types, roster, weighted), [types, roster, weighted]);
  const suggestions = useMemo(() => suggestNext(types, roster, weighted), [types, roster, weighted]);

  return (
    <>
      <TypePicker selected={types} onChange={onTypesChange} />
      {types.length === 0 ? (
        <Suggestions suggestions={suggestions} canAdd onAdd={t => onTypesChange([t])} />
      ) : (
        <>
          <CoverageSummary buckets={coverage.buckets} weighted={weighted} />
          <Suggestions
            suggestions={suggestions}
            canAdd={types.length < MAX_TYPES}
            onAdd={t => onTypesChange([...types, t])}
          />
          <PokemonTable results={coverage.results} />
        </>
      )}
    </>
  );
}
