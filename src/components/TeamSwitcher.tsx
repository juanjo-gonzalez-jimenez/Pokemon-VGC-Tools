import {useEffect, useState} from 'react';
import {useTeamStore} from '../hooks/useSavedTeam';
import {
  activeTeam,
  addTeam,
  decodeShare,
  duplicate,
  encodeShare,
  importTeam,
  MAX_NAME,
  nameTaken,
  nextName,
  removeActive,
  rename,
  select,
  SHARE_PREFIX,
} from '../lib/teams';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The active team's name. Typing edits a draft; it is saved only while it's non-blank and no
 * other team has it, otherwise a red message says why (and leaving the box restores the name).
 */
function NameField() {
  const [store, update] = useTeamStore();
  const current = activeTeam(store);
  const [draft, setDraft] = useState(current.name);
  const problem = !draft.trim() ? 'The team needs a name.' : nameTaken(store, draft, current.id) ? 'Name already in use.' : '';
  return (
    <label className="team-switcher-name">
      {/* The message takes the counter's place, so nothing around it moves. */}
      <span className="team-switcher-head small">
        <span className="muted">Name</span>
        {problem ? (
          <span className="field-error" role="alert">
            {problem}
          </span>
        ) : (
          <span className="muted">
            {draft.length}/{MAX_NAME}
          </span>
        )}
      </span>
      <input
        value={draft}
        maxLength={MAX_NAME}
        aria-label="Team name"
        aria-invalid={Boolean(problem)}
        className={problem ? 'invalid' : undefined}
        onChange={e => {
          setDraft(e.target.value);
          update(s => rename(s, e.target.value));
        }}
        onBlur={() => problem && setDraft(current.name)}
      />
    </label>
  );
}

/** Pick, name, add, copy and share saved teams. Also opens `#/team/import/<code>` links. */
export function TeamSwitcher() {
  const [store, update] = useTeamStore();
  const current = activeTeam(store);
  const [status, setStatus] = useState('');

  // A shared link: add the team (or switch to it if it's already saved), then tidy the address.
  useEffect(() => {
    const open = () => {
      if (!window.location.hash.startsWith(SHARE_PREFIX)) return;
      const text = decodeShare(window.location.hash.slice(SHARE_PREFIX.length));
      if (text) {
        update(s => importTeam(s, text, nextName(s, 'Shared team')));
        setStatus('Shared team opened.');
      } else setStatus('That share link is broken.');
      history.replaceState(null, '', '#/team');
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [update]);

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(s => (s === message ? '' : s)), 2500);
  };
  const shareLink = () => `${window.location.origin}${window.location.pathname}${SHARE_PREFIX}${encodeShare(current.text)}`;

  return (
    <div className="team-switcher">
      <label className="team-switcher-pick">
        <span className="team-switcher-head small">
          <span className="muted">Team</span>
          <span className="muted">
            {store.teams.length} saved
          </span>
        </span>
        <select value={store.active} onChange={e => update(s => select(s, e.target.value))} aria-label="Saved team">
          {store.teams.map(t => (
            <option key={t.id} value={t.id}>
              {t.name || 'Untitled'}
            </option>
          ))}
        </select>
      </label>
      <NameField key={current.id} />
      <div className="team-switcher-actions">
        <button className="link" onClick={() => update(s => addTeam(s))}>
          New
        </button>
        <button className="link" onClick={() => update(duplicate)}>
          Duplicate
        </button>
        <button
          className="link"
          disabled={!current.text.trim()}
          onClick={async () => flash((await copy(shareLink())) ? 'Share link copied.' : 'Copying failed.')}
        >
          Copy share link
        </button>
        <button
          className="link"
          disabled={!current.text.trim()}
          onClick={async () => flash((await copy(current.text)) ? 'Showdown text copied.' : 'Copying failed.')}
        >
          Copy text
        </button>
        <button
          className="link danger"
          onClick={() => {
            if (!current.text.trim() || window.confirm(`Delete “${current.name || 'Untitled'}”?`)) update(removeActive);
          }}
        >
          Delete
        </button>
      </div>
      {status && (
        <p className="muted small team-switcher-status" role="status">
          {status}
        </p>
      )}
    </div>
  );
}

/** Just the saved-team dropdown, for tabs that use the team (Matchup). */
export function TeamSelect() {
  const [store, update] = useTeamStore();
  if (store.teams.length < 2) return null;
  return (
    <select className="team-select" value={store.active} onChange={e => update(s => select(s, e.target.value))} aria-label="Saved team">
      {store.teams.map(t => (
        <option key={t.id} value={t.id}>
          {t.name || 'Untitled'}
        </option>
      ))}
    </select>
  );
}
