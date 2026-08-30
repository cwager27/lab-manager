import './styles/global.css';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { supabase, isRecoveryUrl, recoveryTokenHash } from './lib/supabase';
import Navigation from './components/Navigation';
import Login from './pages/Login';
import SetNewPassword from './pages/SetNewPassword';
import Onboarding from './pages/Onboarding';

const Dashboard         = lazy(() => import('./pages/Dashboard'));
const Tasks2            = lazy(() => import('./pages/Tasks2'));
const VacationLogs      = lazy(() => import('./pages/VacationLogs'));
const LabMeetings       = lazy(() => import('./pages/LabMeetings'));
const Finance           = lazy(() => import('./pages/Finance'));
const SampleInventory   = lazy(() => import('./pages/SampleInventory'));
const LabContacts       = lazy(() => import('./pages/LabContacts'));
const Compliance        = lazy(() => import('./pages/Compliance'));
const LabPoliciesSOPs   = lazy(() => import('./pages/LabPoliciesSOPs'));
const ComputationalTips = lazy(() => import('./pages/ComputationalTips'));
const LegalDocuments    = lazy(() => import('./pages/LegalDocuments'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
    Loading…
  </div>
);

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem('nav_collapsed') === 'true'; } catch { return false; }
  });
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showPasswordReset, setShowPasswordReset] = useState(isRecoveryUrl);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  // Always start loading so we never flash Login before the auth state is known
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const errorTimeoutRef = useRef(null);
  // Track recovery mode in a ref so the onAuthStateChange closure always has the latest value
  const inRecoveryRef = useRef(isRecoveryUrl);

  useEffect(() => {
    if (isRecoveryUrl) {
      // Supabase auto-processes both hash-based (#access_token) and code-based (?code=) recovery
      // URLs during createClient init and fires PASSWORD_RECOVERY. We only need to manually
      // handle token_hash (email OTP style). Set a timeout as a fallback for expired links.
      errorTimeoutRef.current = setTimeout(() => {
        setRecoveryError('This reset link has expired or has already been used. Please request a new one.');
        setLoading(false);
      }, 10000);

      if (recoveryTokenHash) {
        supabase.auth.verifyOtp({ token_hash: recoveryTokenHash, type: 'recovery' }).catch(() => {
          clearTimeout(errorTimeoutRef.current);
          setRecoveryError('This reset link has expired or has already been used. Please request a new one.');
          setLoading(false);
        });
      }
      // For ?code= and #access_token cases: createClient already exchanged the token,
      // PASSWORD_RECOVERY will fire in onAuthStateChange below.
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
      // PASSWORD_RECOVERY is the definitive signal from Supabase for all reset link formats
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(errorTimeoutRef.current);
        inRecoveryRef.current = true;
        setShowPasswordReset(true);
        setRecoveryConfirmed(true);
        setLoading(false);
        return;
      }

      // Backup: some Supabase versions fire SIGNED_IN instead of PASSWORD_RECOVERY
      // Only treat it as recovery if we detected a recovery URL on load
      if (inRecoveryRef.current && event === 'SIGNED_IN' && session) {
        clearTimeout(errorTimeoutRef.current);
        setShowPasswordReset(true);
        setRecoveryConfirmed(true);
        setLoading(false);
        return;
      }

      // Normal auth — skip entirely if we're in recovery mode
      if (inRecoveryRef.current) return;

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
    can_edit_sops: profile?.can_edit_sops,
    can_view_confidential: profile?.can_view_confidential,
    can_view_task_tabs: profile?.can_view_task_tabs,
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
        collapsed={navCollapsed}
        onToggleCollapse={() => setNavCollapsed(v => { const next = !v; try { localStorage.setItem('nav_collapsed', next); } catch {} return next; })}
      />
      <main style={{ marginLeft: navCollapsed ? '64px' : '240px', flex: 1, padding: '32px', maxWidth: `calc(100vw - ${navCollapsed ? '64px' : '240px'})`, transition: 'margin-left 0.2s ease, max-width 0.2s ease' }}>
        <Suspense fallback={<PageLoader />}>
        {currentPage === 'dashboard' && <Dashboard profile={profile} userRole={userRole} userId={user.id} setCurrentPage={setCurrentPage} />}
        {currentPage === 'tasks2' && <Tasks2 userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'vacation' && <VacationLogs userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'meetings' && <LabMeetings userRole={userRole} userId={user.id} profile={profile} permissions={permissions} />}
        {currentPage === 'finance' && permissions.can_view_finance && <Finance userRole={userRole} />}
        {currentPage === 'inventory' && <SampleInventory userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'policies' && <LabPoliciesSOPs userRole={userRole} userId={user.id} profile={profile} permissions={permissions} />}
        {currentPage === 'compliance' && <Compliance userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'contacts' && (permissions.can_view_contacts || userRole === 'admin' || userRole === 'pm') && <LabContacts userRole={userRole} userId={user.id} profile={profile} permissions={permissions} />}
        {currentPage === 'contacts' && !permissions.can_view_contacts && userRole !== 'admin' && userRole !== 'pm' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '15px' }}>
            You don't have permission to view the contact directory.
          </div>
        )}
        {currentPage === 'tips' && <ComputationalTips userRole={userRole} userId={user.id} profile={profile} />}
        {currentPage === 'legal' && canManage && <LegalDocuments userRole={userRole} userId={user.id} profile={profile} />}
        {!['dashboard', 'tasks2', 'vacation', 'meetings', 'finance', 'inventory', 'policies', 'compliance', 'contacts', 'tips', 'legal'].includes(currentPage) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '15px' }}>
            This system is coming soon.
          </div>
        )}
        </Suspense>
      </main>
    </div>
  );
}
