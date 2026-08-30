import {
  ClipboardList, Calendar, FlaskConical,
  Users, ShieldCheck, Palmtree,
  LayoutDashboard, LogOut, DollarSign, BookOpen, Terminal, Scale,
} from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Supervisor',
  pm: 'Program Manager',
  member: 'Lab Member',
  intern: 'Intern'
};

export default function Navigation({ currentPage, setCurrentPage, userRole, profile, onLogout, canManage, permissions, collapsed, onToggleCollapse }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, always: true },
    { id: 'tasks2', label: 'Tasks', icon: ClipboardList, always: true },
    { id: 'vacation', label: 'Time Off', icon: Palmtree, always: true },
    { id: 'meetings', label: 'Team Meetings', icon: Calendar, always: true },
    { id: 'inventory', label: 'Sample Inventory', icon: FlaskConical, always: true },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck, always: true },
    { id: 'policies', label: 'Lab Policies & SOPs', icon: BookOpen, always: true },
    { id: 'finance', label: 'Finance', icon: DollarSign, always: true },
    { id: 'legal', label: 'Legal Documents', icon: Scale, managerOnly: true },
    { id: 'tips', label: 'Computational Tips', icon: Terminal, always: true },
    { id: 'contacts', label: 'Contacts', icon: Users, contactsOnly: true },
  ].filter(item => item.always || (item.adminOnly && userRole === 'admin') || (item.managerOnly && canManage) || (item.contactsOnly && (permissions?.can_view_contacts || canManage)));

  const W = collapsed ? 64 : 240;

  return (
    <nav
      style={{
        width: W, minHeight: '100vh',
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', left: 0, top: 0, bottom: 0,
        zIndex: 100, boxShadow: 'var(--shadow-md)',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Right-edge strip — always present, toggles sidebar on click */}
      <div
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 10,
          cursor: collapsed ? 'e-resize' : 'w-resize', zIndex: 10,
        }}
      />

      {/* Header */}
      <div style={{
        padding: collapsed ? '20px 0' : '24px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 12, flexShrink: 0,
      }}>
        <div style={{ width: collapsed ? 32 : 36, height: collapsed ? 32 : 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/dna-logo.jpg" alt="Lab logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--purple-primary)', letterSpacing: '0.05em' }}>PETLJAK</div>
            <div style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>LAB</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '10px 0' : '10px 20px',
                background: active ? 'var(--purple-faint)' : 'transparent',
                border: 'none',
                borderLeft: active ? '3px solid var(--purple-primary)' : '3px solid transparent',
                color: active ? 'var(--purple-primary)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400, fontSize: 13, textAlign: 'left',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap', overflow: 'hidden',
                cursor: 'pointer',
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
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: collapsed ? '16px 0' : '16px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: 8, flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || profile?.email || 'Lab Member'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--purple-primary)', fontWeight: 500 }}>
              {ROLE_LABELS[userRole] || 'Lab Member'}
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          title="Sign out"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 6, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}
