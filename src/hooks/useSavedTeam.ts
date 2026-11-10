import {anyString} from '../lib/storage';
import {usePersistentState} from './usePersistentState';

/** The team paste the user last entered on the Team tab (shared by Coverage and Matchup). */
export function useSavedTeam(): [string, (text: string) => void] {
  return usePersistentState('vgc-tools:team', '', anyString);
}
