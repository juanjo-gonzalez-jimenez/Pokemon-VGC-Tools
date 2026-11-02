import type {RoleCheck} from '../lib/roles';
import {Panel} from './Panel';

export function RolesChecklist({roles}: {roles: RoleCheck[]}) {
  return (
    <Panel id="roles" title="Team roles" note="common VGC tools: advice, not rules">
      <ul className="roles">
        {roles.map(r => (
          <li key={r.role} className={r.ok ? 'ok' : 'missing'}>
            <span className="role-icon" aria-hidden>
              {r.ok ? '✓' : '!'}
            </span>
            <strong>{r.role}</strong>
            <span className="muted">
              {r.members.length ? r.members.join(', ') : '—'}
              {!r.ok && <> · {r.hint}</>}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
