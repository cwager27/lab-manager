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
  const [showAvatar, setShowAvatar] = useState(false);
  const errorTimeoutRef = useRef(null);
  const bellRef = useRef(null);
  const avatarRef = useRef(null);
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
      if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); setShowBell(false); setShowAvatar(false); }
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

  useEffect(() => {
    function handleClick(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setShowAvatar(false);
    }
    if (showAvatar) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAvatar]);

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

  function fuzzyScore(q, entry) {
    const query = q.toLowerCase().trim();
    if (!query) return 0;
    const label = entry.label.toLowerCase();
    const keywords = (entry.keywords || '').toLowerCase();
    const combined = label + ' ' + keywords;
    if (label === query) return 100;
    if (label.startsWith(query)) return 95;
    if (label.includes(query)) return 90;
    if (label.split(/\s+/).some(w => w.startsWith(query))) return 85;
    if (keywords.includes(query)) return 80;
    if (combined.split(/\s+/).some(w => w.startsWith(query))) return 75;
    const queryWords = query.split(/\s+/);
    if (queryWords.every(qw => combined.includes(qw))) return 60;
    if (query.length >= 3) {
      let qi = 0;
      for (let i = 0; i < label.length && qi < query.length; i++) { if (label[i] === query[qi]) qi++; }
      if (qi === query.length) return 40;
      qi = 0;
      for (let i = 0; i < keywords.length && qi < query.length; i++) { if (keywords[i] === query[qi]) qi++; }
      if (qi === query.length) return 30;
    }
    return 0;
  }

  function navigateTo(entry) {
    if (entry.tabKey) {
      const [storageKey, tabValue] = entry.tabKey.split(':');
      try { localStorage.setItem(storageKey, tabValue); } catch {}
    }
    setCurrentPage(entry.pageId);
    setShowSearch(false);
    setSearchQuery('');
  }

  const SEARCH_INDEX = [
    { pageId: 'dashboard',  label: 'Dashboard',          icon: LayoutDashboard, keywords: 'home overview summary lab leadership personal' },
    { pageId: 'tasks2',     label: 'Tasks',               icon: ClipboardList,   keywords: 'todo work checklist recurring' },
    { pageId: 'vacation',   label: 'Time Off',            icon: Palmtree,        keywords: 'vacation leave holiday pto absence request approve time off' },
    { pageId: 'meetings',   label: 'Team Meetings',       icon: Calendar,        keywords: 'meeting lab adhoc conference zoom calendar' },
    { pageId: 'inventory',  label: 'Sample Inventory',    icon: FlaskConical,    keywords: 'sample inventory specimens cells storage biobank' },
    { pageId: 'compliance', label: 'Compliance',          icon: ShieldCheck,     keywords: 'training certificate expire policy regulatory safety irb' },
    { pageId: 'policies',   label: 'Lab Policies & SOPs', icon: BookOpen,        keywords: 'sop standard protocol procedure policy guidelines documentation' },
    ...(permissions.can_view_finance ? [
      { pageId: 'finance', label: 'Finance',               icon: DollarSign, keywords: 'money budget spending purchase cost accounting' },
      { pageId: 'finance', label: 'Orders',                icon: DollarSign, tabKey: 'finance_tab:orders',         parent: 'Finance', keywords: 'order purchase buy procurement' },
      { pageId: 'finance', label: 'Spending Summaries',    icon: DollarSign, tabKey: 'finance_tab:charts',         parent: 'Finance', keywords: 'chart graph spending trends analysis summary budget' },
      { pageId: 'finance', label: 'Annual Summaries',      icon: DollarSign, tabKey: 'finance_tab:annual-summary', parent: 'Finance', keywords: 'annual yearly fiscal year fy summary' },
      { pageId: 'finance', label: 'Smart Summary',         icon: DollarSign, tabKey: 'finance_tab:smart-summary',  parent: 'Finance', keywords: 'smart vendor catalog analysis insight' },
      { pageId: 'finance', label: 'Vendors',               icon: DollarSign, tabKey: 'finance_tab:vendors',        parent: 'Finance', keywords: 'vendor supplier company fisher sigma' },
      { pageId: 'finance', label: 'Grants',                icon: DollarSign, tabKey: 'finance_tab:grants',         parent: 'Finance', keywords: 'grant funding budget balance expire spenddown' },
      { pageId: 'finance', label: 'Standardized Reagents', icon: DollarSign, tabKey: 'finance_tab:reagents',       parent: 'Finance', keywords: 'reagent standard catalog chemical stock' },
    ] : []),
    ...(canManage ? [{ pageId: 'legal', label: 'Legal Documents', icon: Scale, keywords: 'legal contract agreement nda mta document' }] : []),
    { pageId: 'tips', label: 'Computational Tips', icon: Terminal, keywords: 'code script bioinformatics coding programming software cli command' },
    ...((permissions.can_view_contacts || canManage) ? [{ pageId: 'contacts', label: 'Contacts', icon: Users, keywords: 'team members people directory email lab' }] : []),
    { pageId: 'tasks2', label: 'My Tasks',         icon: ClipboardList, tabKey: 'tasks2_tab:my-tasks',     parent: 'Tasks', keywords: 'my task todo due history personal' },
    ...(canManage ? [
      { pageId: 'tasks2', label: 'All Tasks',          icon: ClipboardList, tabKey: 'tasks2_tab:view-all',     parent: 'Tasks', keywords: 'all tasks view everyone overview' },
      { pageId: 'tasks2', label: 'Task Calendar',      icon: Calendar,      tabKey: 'tasks2_tab:calendar',     parent: 'Tasks', keywords: 'calendar schedule dates month week' },
      { pageId: 'tasks2', label: 'Unassigned Tasks',   icon: ClipboardList, tabKey: 'tasks2_tab:unassigned',   parent: 'Tasks', keywords: 'unassigned nobody missing open' },
      { pageId: 'tasks2', label: 'Assign Tasks',       icon: ClipboardList, tabKey: 'tasks2_tab:assigned',     parent: 'Tasks', keywords: 'assign assignment delegate distribute allocate' },
      { pageId: 'tasks2', label: 'Task Productivity',  icon: ClipboardList, tabKey: 'tasks2_tab:productivity', parent: 'Tasks', keywords: 'productivity performance stats metrics progress score' },
      { pageId: 'tasks2', label: 'One-off Tasks',      icon: ClipboardList, tabKey: 'tasks2_tab:oneoff',       parent: 'Tasks', keywords: 'oneoff adhoc sporadic special one time' },
    ] : []),
  ];

  const searchResults = searchQuery.trim()
    ? SEARCH_INDEX
        .map(entry => ({ entry, score: fuzzyScore(searchQuery, entry) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ entry }) => entry)
    : SEARCH_INDEX.filter(e => !e.tabKey);

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
                <p style={{ padding: '12px 18px', fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No results found.</p>
              ) : searchResults.map((entry, i) => {
                const Icon = entry.icon;
                const active = currentPage === entry.pageId && !entry.tabKey;
                return (
                  <button
                    key={`${entry.pageId}-${entry.tabKey || 'page'}-${i}`}
                    onClick={() => navigateTo(entry)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', border: 'none', background: active ? 'var(--purple-faint)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: active ? 'var(--purple-primary)' : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} color={active ? 'white' : 'var(--text-muted)'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {entry.parent && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 1 }}>{entry.parent} →</div>
                      )}
                      <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? 'var(--purple-primary)' : 'var(--text-primary)' }}>{entry.label}</span>
                    </div>
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

          {/* Avatar with logout dropdown */}
          <div ref={avatarRef} style={{ position: 'relative', marginLeft: 8 }}>
            <button
              title="Account"
              onClick={() => setShowAvatar(v => !v)}
              style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--purple-primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, outline: showAvatar ? '2px solid var(--purple-primary)' : 'none', outlineOffset: 2 }}
            >
              <span style={{ color: 'white', fontSize: 12, fontWeight: 700, lineHeight: 1, letterSpacing: '0.02em' }}>{avatarInitials}</span>
            </button>
            {showAvatar && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 200, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', zIndex: 200, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{profile?.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{profile?.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--danger)', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFF0F0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Sign out
                </button>
              </div>
            )}
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
