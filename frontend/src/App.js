import './styles/global.css';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { supabase, isRecoveryUrl, recoveryTokenHash } from './lib/supabase';
import Navigation from './components/Navigation';
import Login from './pages/Login';
import SetNewPassword from './pages/SetNewPassword';
import Onboarding from './pages/Onboarding';
import {
  Search, Bell,
  LayoutDashboard, ClipboardList, Palmtree, Calendar,
  FlaskConical, ShieldCheck, BookOpen, DollarSign, Scale, Terminal, Users,
} from 'lucide-react';

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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBell, setShowBell] = useState(false);
  const errorTimeoutRef = useRef(null);
  const bellRef = useRef(null);
  const searchInputRef = useRef(null);
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

  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [showSearch]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); setShowBell(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(v => !v); setSearchQuery(''); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false);
    }
    if (showBell) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showBell]);

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

  const avatarInitials = (profile?.full_name || '?')
    .split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const ALL_PAGES = [
    { id: 'dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
    { id: 'tasks2',     label: 'Tasks',               icon: ClipboardList },
    { id: 'vacation',   label: 'Time Off',            icon: Palmtree },
    { id: 'meetings',   label: 'Team Meetings',       icon: Calendar },
    { id: 'inventory',  label: 'Sample Inventory',    icon: FlaskConical },
    { id: 'compliance', label: 'Compliance',          icon: ShieldCheck },
    { id: 'policies',   label: 'Lab Policies & SOPs', icon: BookOpen },
    { id: 'finance',    label: 'Finance',             icon: DollarSign, requiresFinance: true },
    { id: 'legal',      label: 'Legal Documents',     icon: Scale, managerOnly: true },
    { id: 'tips',       label: 'Computational Tips',  icon: Terminal },
    { id: 'contacts',   label: 'Contacts',            icon: Users, contactsOnly: true },
  ].filter(p =>
    (!p.managerOnly && !p.contactsOnly && !p.requiresFinance) ||
    (p.managerOnly && canManage) ||
    (p.requiresFinance && permissions.can_view_finance) ||
    (p.contactsOnly && (permissions.can_view_contacts || canManage))
  );

  const searchResults = searchQuery.trim()
    ? ALL_PAGES.filter(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : ALL_PAGES;

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

      {/* Search overlay */}
      {showSearch && (
        <div
          onClick={() => { setShowSearch(false); setSearchQuery(''); }}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 130 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-primary)', borderRadius: 14, width: 480, boxShadow: '0 12px 40px rgba(0,0,0,0.22)', overflow: 'hidden', animation: 'fadeIn 0.12s ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search pages…"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-primary)', background: 'transparent' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', fontFamily: 'monospace' }}>esc</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '6px 0' }}>
              {searchResults.length === 0 ? (
                <p style={{ padding: '12px 18px', fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No pages found.</p>
              ) : searchResults.map(p => {
                const Icon = p.icon;
                const active = currentPage === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setCurrentPage(p.id); setShowSearch(false); setSearchQuery(''); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', border: 'none', background: active ? 'var(--purple-faint)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: active ? 'var(--purple-primary)' : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} color={active ? 'white' : 'var(--text-muted)'} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? 'var(--purple-primary)' : 'var(--text-primary)' }}>{p.label}</span>
                    {active && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--purple-primary)', fontWeight: 600 }}>Current</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ padding: '8px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>↑↓ navigate</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>↵ open</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>esc close</span>
            </div>
          </div>
        </div>
      )}

      {/* Top header bar */}
      <header style={{
        position: 'fixed', top: 0,
        left: navCollapsed ? '64px' : '240px',
        right: 0, height: 56,
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 32px', zIndex: 90,
        boxShadow: 'var(--shadow-sm)',
        transition: 'left 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            title="Search (⌘K)"
            onClick={() => { setShowSearch(v => !v); setSearchQuery(''); }}
            style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: showSearch ? 'var(--purple-faint)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: showSearch ? 'var(--purple-primary)' : 'var(--text-muted)' }}
            onMouseEnter={e => { if (!showSearch) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            onMouseLeave={e => { if (!showSearch) e.currentTarget.style.background = 'transparent'; }}
          >
            <Search size={17} />
          </button>

          {/* Bell with dropdown */}
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button
              title="Notifications"
              onClick={() => setShowBell(v => !v)}
              style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: showBell ? 'var(--purple-faint)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: showBell ? 'var(--purple-primary)' : 'var(--text-muted)' }}
              onMouseEnter={e => { if (!showBell) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={e => { if (!showBell) e.currentTarget.style.background = 'transparent'; }}
            >
              <Bell size={17} />
            </button>
            {showBell && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 280, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', zIndex: 200, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</span>
                </div>
                <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                  <Bell size={28} color="var(--border)" style={{ marginBottom: 10 }} />
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No new notifications</p>
                </div>
              </div>
            )}
          </div>

          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--purple-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8, flexShrink: 0 }}>
            <span style={{ color: 'white', fontSize: 12, fontWeight: 700, lineHeight: 1, letterSpacing: '0.02em' }}>{avatarInitials}</span>
          </div>
        </div>
      </header>

      <main style={{ marginLeft: navCollapsed ? '64px' : '240px', flex: 1, padding: '32px', paddingTop: 'calc(56px + 28px)', maxWidth: `calc(100vw - ${navCollapsed ? '64px' : '240px'})`, transition: 'margin-left 0.2s ease, max-width 0.2s ease' }}>
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
