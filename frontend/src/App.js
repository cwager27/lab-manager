import './styles/global.css';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Navigation from './components/Navigation';
import Tasks from './pages/Tasks';
import VacationLogs from './pages/VacationLogs';
import LabMeetings from './pages/LabMeetings';
import Finance from './pages/Finance';
import SampleInventory from './pages/SampleInventory';
import LabContacts from './pages/LabContacts';
import Compliance from './pages/Compliance';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

export default function App() {
  const [currentPage, setCurrentPage] = useState('responsibilities');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single();
        setProfile(prof);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single();
        setProfile(prof);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin(user, profile) {
    setUser(user);
    setProfile(profile);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  const userRole = profile?.role || 'member';
  const canManage = userRole === 'admin' || userRole === 'pm';
  const permissions = {
    can_assign_tasks: profile?.can_assign_tasks,
    can_approve_sporadic: profile?.can_approve_sporadic,
    can_edit_meetings: profile?.can_edit_meetings,
    can_view_finance: profile?.can_view_finance,
    can_edit_samples: profile?.can_edit_samples,
    can_view_contacts: profile?.can_view_contacts,
    can_add_members: profile?.can_add_members,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      <Navigation
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        userRole={userRole}
        profile={profile}
        onLogout={handleLogout}
        canManage={canManage}
        permissions={permissions}
      />
      <main style={{ marginLeft: '240px', flex: 1, padding: '32px', maxWidth: 'calc(100vw - 240px)' }}>
        {currentPage === 'dashboard' && <Dashboard profile={profile} />}
        {currentPage === 'tasks' && <Tasks userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'vacation' && <VacationLogs userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'meetings' && <LabMeetings userRole={userRole} userId={user.id} profile={profile} permissions={permissions} />}
        {currentPage === 'finance' && permissions.can_view_finance && <Finance userRole={userRole} />}
        {currentPage === 'inventory' && <SampleInventory userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'compliance' && <Compliance userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'contacts' && (permissions.can_view_contacts || userRole === 'admin' || userRole === 'pm') && <LabContacts userRole={userRole} userId={user.id} profile={profile} permissions={permissions} />}
        {currentPage === 'contacts' && !permissions.can_view_contacts && userRole !== 'admin' && userRole !== 'pm' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '15px' }}>
            You don't have permission to view the contact directory.
          </div>
        )}
        {!['dashboard', 'tasks', 'vacation', 'meetings', 'finance', 'inventory', 'compliance', 'contacts'].includes(currentPage) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '15px' }}>
            This system is coming soon.
          </div>
        )}
      </main>
    </div>
  );
}
