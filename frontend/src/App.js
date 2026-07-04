import './styles/global.css';
import { useState, useEffect, useRef } from 'react';
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
import SetNewPassword from './pages/SetNewPassword';
import Onboarding from './pages/Onboarding';
import Tasks2 from './pages/Tasks2';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  // Detect recovery flow synchronously from the URL before any async work runs.
  // Supabase can produce three formats depending on the email template in use:
  //   1. Old template (implicit):   #access_token=...&type=recovery
  //      Supabase's initialize() auto-processes this and fires PASSWORD_RECOVERY.
  //   2. New template (token-hash): ?token_hash=...&type=recovery
  //      Not auto-processed; verifyOtp() must be called manually.
  //   3. PKCE code (defensive):     ?code=...
  //      Not auto-processed with implicit client; exchangeCodeForSession() must be called.
  const _rHash = new URLSearchParams(window.location.hash.slice(1));
  const _rSearch = new URLSearchParams(window.location.search);
  const isRecoveryUrl =
    (_rHash.get('type') === 'recovery' && !!_rHash.get('access_token')) ||
    (_rSearch.get('type') === 'recovery' && !!_rSearch.get('token_hash')) ||
    !!_rSearch.get('code');

  const [showPasswordReset, setShowPasswordReset] = useState(isRecoveryUrl);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [loading, setLoading] = useState(!isRecoveryUrl);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const errorTimeoutRef = useRef(null);

  useEffect(() => {
    if (isRecoveryUrl) {
      const sp = new URLSearchParams(window.location.search);
      const tokenHash = sp.get('token_hash');
      const code = sp.get('code');

      if (tokenHash) {
        // New email template: ?token_hash=...&type=recovery
        // verifyOtp fires PASSWORD_RECOVERY via onAuthStateChange on success.
        supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).catch(() => {
          setRecoveryError('This reset link has expired or has already been used. Please request a new one.');
        });
      } else if (code) {
        // PKCE: ?code=... — exchangeCodeForSession fires PASSWORD_RECOVERY on success.
        supabase.auth.exchangeCodeForSession(code).catch(() => {
          setRecoveryError('This reset link has expired or has already been used. Please request a new one.');
        });
      } else {
        // Hash-based implicit: initialize() auto-processes and fires PASSWORD_RECOVERY.
        // If the token is expired, initialize() returns early without firing any event,
        // so a fallback timeout surfaces the error after 12s. clearTimeout is called
        // inside the PASSWORD_RECOVERY handler below if the link is actually valid.
        errorTimeoutRef.current = setTimeout(() => {
          setRecoveryError('This reset link has expired or has already been used. Please request a new one.');
        }, 12000);
      }
    } else {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
          setUser(session.user);
          const { data: prof } = await supabase
            .from('profiles').select('*').eq('id', session.user.id).single();
          setProfile(prof);
          await checkOnboarding(session.user.id);
        }
        setLoading(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(errorTimeoutRef.current);
        setShowPasswordReset(true);
        setRecoveryConfirmed(true);
        setLoading(false);
        return;
      }
      if (session) {
        setUser(session.user);
        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single();
        setProfile(prof);
        await checkOnboarding(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setShowOnboarding(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(errorTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkOnboarding(userId) {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/members/onboarding-status?userId=${userId}`);
      const data = await res.json();
      if (!data.complete) setShowOnboarding(true);
    } catch {
      // Non-fatal — if the check fails, don't block the user
    }
  }

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

  if (showPasswordReset) {
    return (
      <SetNewPassword
        recoveryConfirmed={recoveryConfirmed}
        recoveryError={recoveryError}
        onDone={() => {
          setShowPasswordReset(false);
          setRecoveryConfirmed(false);
          setRecoveryError('');
        }}
      />
    );
  }
  if (!user) return <Login onLogin={handleLogin} />;

  if (showOnboarding) {
    return (
      <Onboarding
        userId={user.id}
        profile={profile}
        onComplete={() => setShowOnboarding(false)}
      />
    );
  }

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
        {currentPage === 'dashboard' && <Dashboard profile={profile} userRole={userRole} userId={user.id} />}
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
        {currentPage === 'tasks2' && canManage && <Tasks2 userRole={userRole} userId={user.id} profile={profile} />}
        {!['dashboard', 'tasks', 'vacation', 'meetings', 'finance', 'inventory', 'compliance', 'contacts', 'tasks2'].includes(currentPage) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '15px' }}>
            This system is coming soon.
          </div>
        )}
      </main>
    </div>
  );
}
