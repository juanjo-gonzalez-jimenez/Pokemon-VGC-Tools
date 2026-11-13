import {useEffect, useState} from 'react';
import {limitlessFormat, type TournamentTeam} from '../lib/tournaments';

// Recent tournament teams per Limitless format ("M-C"), one lazy chunk each (Bo1 and Bo3 share it).
const teamLoaders = import.meta.glob<TournamentTeam[]>('./teams/*.json', {import: 'default'});

/** Recent top tournament teams for a regulation, newest first; null while loading, [] when there are none. */
export function useTournamentTeams(regId: string): TournamentTeam[] | null {
  const format = limitlessFormat(regId);
  const [state, setState] = useState<{format: string; teams: TournamentTeam[]} | null>(null);
  const loader = format ? teamLoaders[`./teams/${format}.json`] : undefined;
  useEffect(() => {
    if (!format || !loader) return;
    let live = true;
    loader().then(teams => live && setState({format, teams}));
    return () => {
      live = false;
    };
  }, [format, loader]);
  if (!format || !loader) return [];
  return state?.format === format ? state.teams : null;
}
