import { 
  ClipboardList, Calendar, FlaskConical, 
  Users, ShieldCheck, Palmtree, 
  LayoutDashboard, LogOut, ChevronRight
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'responsibilities', label: 'Lab Responsibilities', icon: ClipboardList },
  { id: 'sporadic', label: 'Sporadic Tasks', icon: ChevronRight },
  { id: 'vacation', label: 'Vacation Logs', icon: Palmtree },
  { id: 'meetings', label: 'Lab Meetings', icon: Calendar },
  { id: 'finance', label: 'Finance', icon: FlaskConical },
  { id: 'inventory', label: 'Sample Inventory', icon: FlaskConical },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'contacts', label: 'Lab Contacts', icon: Users },
];

export default function Navigation({ currentPage, setCurrentPage, userRole }) {
  return (
    <nav style={{
      width: '240px',
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-md)'
    }}>
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          background: 'var(--purple-primary)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
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
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                background: active ? 'var(--purple-faint)' : 'transparent',
                border: 'none',
                borderLeft: active ? '3px solid var(--purple-primary)' : '3px solid transparent',
                color: active ? 'var(--purple-primary)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400,
                fontSize: '13px',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {userRole === 'admin' ? 'Supervisor' : userRole === 'pm' ? 'Program Manager' : 'Lab Member'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Petljak Lab</div>
        </div>
        <button style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}
