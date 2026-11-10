import {PokemonIcon} from './Sprite';

interface Props {
  /** Anything with a Showdown id and name; the icon shows when the data has one. */
  pokemon: {id: string; name: string; icon?: number};
  /** Text to show instead of the name. */
  label?: string;
}

/** A Pokémon's icon and name, linking to its page on the Pokémon tab. */
export function PokemonLink({pokemon, label}: Props) {
  return (
    <a className="pokemon-link" href={`#/dex/${pokemon.id}`} title={`Open ${pokemon.name} in the Pokémon tab`}>
      <PokemonIcon icon={pokemon.icon} />
      <span>{label ?? pokemon.name}</span>
    </a>
  );
}
