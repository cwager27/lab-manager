import './styles/global.css';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Navigation from './components/Navigation';
import Responsibilities from './pages/Responsibilities';
import AssignTasks from './pages/AssignTasks';
import SporadicTasks from './pages/SporadicTasks';
import VacationLogs from './pages/VacationLogs';
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      <Navigation
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        userRole={userRole}
        profile={profile}
        onLogout={handleLogout}
        canManage={canManage}
      />
      <main style={{ marginLeft: '240px', flex: 1, padding: '32px', maxWidth: 'calc(100vw - 240px)' }}>
        {currentPage === 'responsibilities' && <Responsibilities userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'assign' && canManage && <AssignTasks userId={user.id} />}
        {currentPage === 'sporadic' && <SporadicTasks userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'vacation' && <VacationLogs userRole={userRole} userId={user.id} profile={profile} />}
        {!['responsibilities', 'assign', 'sporadic', 'vacation'].includes(currentPage) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '15px' }}>
            This system is coming soon.
          </div>
        )}
      </main>
    </div>
  );
}
