import {useRef, useState} from 'react';
import {usePersistentState} from '../hooks/usePersistentState';
import type {TeamMember} from '../lib/paste';
import {oneOf, readStored, writeStored} from '../lib/storage';
import {
  DIVISIONS,
  EMPTY_PLAYER,
  LABELS,
  missingDetails,
  parsePlayer,
  sheetPokemon,
  teamListFileName,
  type LocalNames,
  type PlayerInfo,
  type SheetLang,
} from '../lib/teamlist';
import {MAX_NAME} from '../lib/teams';
import {Icon} from './Icon';

const PLAYER_KEY = 'vgc-tools:player';
const LANGS: SheetLang[] = ['es', 'en'];
const TEXT_FIELDS: (keyof PlayerInfo)[] = ['name', 'trainer', 'switchProfile', 'battleTeam', 'playerId', 'supportId'];

const COPY = {
  es: {intro: 'Se descarga un PDF con la hoja para el personal del torneo y la hoja de equipo abierta.', choose: 'Elige…', stays: 'Tus datos se quedan en este navegador.', download: 'Descargar', cancel: 'Cancelar', making: 'Creando PDF…', blank: 'Quedarán en blanco en la hoja:'},
  en: {intro: 'Downloads one PDF with the sheet for tournament staff and the open team sheet.', choose: 'Choose…', stays: 'Your details stay in this browser.', download: 'Download', cancel: 'Cancel', making: 'Making PDF…', blank: 'These will be blank on the sheet:'},
};

/** Team tab button that downloads the team list PDF (staff page + open team sheet) in Spanish or English. */
export function TeamListDownload({team, teamName}: {team: TeamMember[]; teamName: string}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [lang, setLang] = usePersistentState<SheetLang>('vgc-tools:team-list-lang', 'es', oneOf(LANGS));
  const [player, setPlayer] = useState<PlayerInfo>(() => readStored(PLAYER_KEY, EMPTY_PLAYER, parsePlayer));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const L = LABELS[lang];
  const t = COPY[lang];
  const missing = missingDetails(player);

  const update = (patch: Partial<PlayerInfo>) => {
    const next = {...player, ...patch};
    setPlayer(next);
    writeStored(PLAYER_KEY, JSON.stringify(next));
  };

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const names: LocalNames | null = lang === 'es' ? (await import('../data/names-es.json')).default : null;
      const {buildTeamListPdf} = await import('../lib/teamlistPdf');
      const bytes = await buildTeamListPdf(team.map(m => sheetPokemon(m, lang, names)), player, lang);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], {type: 'application/pdf'}));
      const a = document.createElement('a');
      a.href = url;
      a.download = teamListFileName(teamName);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      dialog.current?.close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="primary team-list-button"
        disabled={team.length === 0}
        title={team.length === 0 ? 'Paste a team first' : undefined}
        onClick={() => dialog.current?.showModal()}
      >
        <Icon name="download" /> Download team list
      </button>
      <dialog ref={dialog} className="team-list-dialog" aria-labelledby="team-list-title">
        <form method="dialog" onSubmit={e => e.preventDefault()}>
          <h2 id="team-list-title">In what language do you want to download?</h2>
          <div className="segmented team-list-langs" role="group" aria-label="Language">
            {LANGS.map(l => (
              <button key={l} type="button" className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
          <p className="muted small">{t.intro}</p>
          <div className="team-list-fields">
            {TEXT_FIELDS.map(key => (
              <label key={key}>
                <span>{L.player[key]}</span>
                <input type="text" value={player[key]} maxLength={MAX_NAME} onChange={e => update({[key]: e.target.value})} />
              </label>
            ))}
            <label>
              <span>{L.player.birthDate}</span>
              <input type="date" value={player.birthDate} onChange={e => update({birthDate: e.target.value})} />
            </label>
            <label>
              <span>{L.player.division}</span>
              <select value={player.division} onChange={e => update({division: e.target.value as PlayerInfo['division']})}>
                <option value="">{t.choose}</option>
                {DIVISIONS.map(d => (
                  <option key={d} value={d}>
                    {L.divisions[d]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">{t.stays}</p>
          {missing.length > 0 && (
            <p className="field-error small">
              {t.blank} {missing.map(k => L.player[k]).join(', ')}
            </p>
          )}
          {error && (
            <p className="field-error small" role="alert">
              {error}
            </p>
          )}
          <div className="team-list-actions">
            <button type="button" className="chip" onClick={() => dialog.current?.close()}>
              {t.cancel}
            </button>
            <button type="button" className="primary" disabled={busy} onClick={download}>
              <Icon name="download" /> {busy ? t.making : t.download}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
