import {
  ClipboardList, Calendar, FlaskConical,
  Users, ShieldCheck, Palmtree,
  LayoutDashboard, LogOut, DollarSign,
} from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Supervisor',
  pm: 'Program Manager',
  member: 'Lab Member',
  intern: 'Intern'
};

export default function Navigation({ currentPage, setCurrentPage, userRole, profile, onLogout, canManage, permissions }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, always: true },
    { id: 'tasks2', label: 'Tasks', icon: ClipboardList, always: true },
    { id: 'vacation', label: 'Time Away Requests', icon: Palmtree, always: true },
    { id: 'meetings', label: 'Team Meetings', icon: Calendar, always: true },
    { id: 'finance', label: 'Finance', icon: DollarSign, always: true },
    { id: 'inventory', label: 'Sample Inventory', icon: FlaskConical, always: true },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck, always: true },
    { id: 'contacts', label: 'Contacts', icon: Users, contactsOnly: true },
  ].filter(item => item.always || (item.managerOnly && canManage) || (item.contactsOnly && (permissions?.can_view_contacts || canManage)));

  return (
    <nav style={{
      width: '240px', minHeight: '100vh',
      background: 'var(--bg-primary)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, bottom: 0,
      zIndex: 100, boxShadow: 'var(--shadow-md)'
    }}>
      <div style={{
        padding: '24px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <div style={{
          width: '36px', height: '36px', background: 'var(--purple-primary)',
          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <FlaskConical size={20} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--purple-primary)', letterSpacing: '0.05em' }}>PETLJAK</div>
          <div style={{ fontWeight: 400, fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>LAB</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button key={item.id} onClick={() => setCurrentPage(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 20px',
              background: active ? 'var(--purple-faint)' : 'transparent',
              border: 'none',
              borderLeft: active ? '3px solid var(--purple-primary)' : '3px solid transparent',
              color: active ? 'var(--purple-primary)' : 'var(--text-secondary)',
              fontWeight: active ? 600 : 400, fontSize: '13px', textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.background = 'var(--purple-faint)';
                e.currentTarget.style.color = 'var(--purple-primary)';
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div style={{
        padding: '16px 20px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile?.full_name || profile?.email || 'Lab Member'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--purple-primary)', fontWeight: 500 }}>
            {ROLE_LABELS[userRole] || 'Lab Member'}
          </div>
        </div>
        <button onClick={onLogout} title="Sign out" style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          padding: '6px', borderRadius: 'var(--radius-sm)',
          display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer'
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}
