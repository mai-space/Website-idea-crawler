import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store';
import { useAuth } from '@/hooks/useAuth';

const NAV = [
  { path: '/', label: 'Overview', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
  { path: '/briefs', label: 'Briefs', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { path: '/sites', label: 'Sites', icon: 'M2 3h20v14H2z M8 21h8 M12 17v4' },
  { path: '/activity', label: 'Activity', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { path: '/exports', label: 'Exports', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3' },
];

function Icon({ d, active }: { d: string; active: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={active ? 'var(--accent-ink)' : 'currentColor'}
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {d.split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : 'M' + seg} />)}
    </svg>
  );
}

export function Sidebar() {
  const { user, clearAuth } = useAuth();
  const clearStore = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  function handleLogout() {
    clearAuth();
    clearStore();
    navigate('/login');
  }

  const initials = user?.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '??';

  return (
    <aside style={{
      width: 'var(--sidebar-w)', flexShrink: 0, height: '100vh',
      borderRight: '1px solid var(--rule)', background: 'var(--paper)',
      display: 'flex', flexDirection: 'column', position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--rule)' }}>
        <div style={{ width: 26, height: 26, background: 'var(--ink)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--paper)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>SB</span>
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, letterSpacing: '-0.01em' }}>Sitebrief</span>
      </div>

      <nav style={{ padding: '12px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', padding: '10px 12px' }}>
          Workspace
        </div>
        {NAV.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 6,
              textDecoration: 'none', fontSize: 14,
              color: isActive ? 'var(--ink)' : 'var(--ink-2)',
              background: isActive ? 'var(--accent-bg)' : 'transparent',
              fontWeight: isActive ? 500 : 400,
              transition: 'background var(--dur-base)',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon d={icon} active={isActive} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: 14, borderTop: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--ink)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.role ?? ''}</div>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4, borderRadius: 4, display: 'flex' }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
