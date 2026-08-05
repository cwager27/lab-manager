import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Palmtree, Star, ClipboardList, AlertTriangle, DollarSign, UserX } from 'lucide-react';


function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}


const PROD_PERIODS = [{ id: 'current', label: 'Currently' }, { id: '30d', label: 'Last 30d' }, { id: 'all', label: 'Since Joining' }];

function PeriodPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {PROD_PERIODS.map(({ id, label }) => (
        <button key={id} onClick={() => onChange(id)}
          style={{ padding: '3px 10px', borderRadius: 12, border: `1.5px solid ${value === id ? 'var(--purple-primary)' : 'var(--border)'}`, background: value === id ? 'var(--purple-primary)' : 'transparent', color: value === id ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function TaskStatusCard({ icon, title, tasks, getTitle, dateKey, upcomingLabel = 'Upcoming — next 30 days' }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const next14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  const isDoneStatus = t => t.status === 'done' || t.status === 'submitted';
  const missed   = tasks.filter(t => !isDoneStatus(t) && t[dateKey] && t[dateKey] < todayStr);
  const twoWeeks = tasks.filter(t => !isDoneStatus(t) && t[dateKey] && t[dateKey] >= todayStr && t[dateKey] <= next14);
  const upcoming = tasks.filter(t => !isDoneStatus(t) && t[dateKey] && t[dateKey] > next14);
  const isEmpty  = !missed.length && !twoWeeks.length && !upcoming.length;

  const renderSection = (label, items, headBg, headColor, isMissed = false) => {
    if (!items.length) return null;
    return (
      <div key={label}>
        <div style={{ padding: '5px 14px', background: isMissed ? '#FEF5F5' : headBg, display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--border)' }}>
          {isMissed && <AlertTriangle size={11} color="#E74C3C" />}
          <span style={{ fontSize: 10, fontWeight: 700, color: isMissed ? '#E74C3C' : headColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        </div>
        {items.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: isMissed ? '1px solid #FCCACA' : '1px solid var(--border)', background: isMissed ? '#FEF5F5' : undefined }}>
            {isMissed && (
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FDEDEC', border: '1.5px solid #E74C3C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#E74C3C', lineHeight: 1 }}>!</span>
              </div>
            )}
            <span style={{ fontSize: 12, color: isMissed ? '#C0392B' : 'var(--text-primary)', fontWeight: isMissed ? 600 : 400, flex: 1, lineHeight: 1.3 }}>{getTitle(t)}</span>
            {t[dateKey] && (
              <span style={{ fontSize: 10, color: isMissed ? '#E74C3C' : 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap', fontWeight: isMissed ? 600 : 400 }}>{formatDate(t[dateKey])}</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {isEmpty ? (
        <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Nothing missed or upcoming.</p>
      ) : (
        <>
          {renderSection('Missed', missed, '#FEF5F5', '#E74C3C', true)}
          {renderSection('Upcoming — next 2 weeks', twoWeeks, '#FFFBF0', '#D68910')}
          {renderSection(upcomingLabel, upcoming, 'var(--bg-secondary)', 'var(--text-secondary)')}
        </>
      )}
    </div>
  );
}

function RecurScoreRow({ row }) {
  const { profile, onTime, late, missed } = row;
  const firstName = (profile.full_name || '').split(' ')[0];
  const matured = onTime + late + missed;
  if (matured === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', width: 72, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstName}</div>
        <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--border)' }} />
        <div style={{ fontSize: 10, color: 'var(--text-muted)', width: 46, textAlign: 'right', flexShrink: 0 }}>—</div>
      </div>
    );
  }
  const pctOnTime = Math.round(onTime / matured * 100);
  const pctLate = Math.round(late / matured * 100);
  const pctMissed = 100 - pctOnTime - pctLate;
  const onTimePct = Math.round(onTime / matured * 100);
  const labelColor = onTimePct >= 70 ? '#27AE60' : onTimePct >= 40 ? '#F39C12' : '#E74C3C';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', width: 72, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstName}</div>
      <div style={{ flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', background: '#E5E5EA' }}>
        {pctOnTime > 0 && <div style={{ width: `${pctOnTime}%`, background: '#27AE60', height: '100%', transition: 'width 0.4s ease' }} />}
        {pctLate > 0 && <div style={{ width: `${pctLate}%`, background: '#F39C12', height: '100%', transition: 'width 0.4s ease' }} />}
        {pctMissed > 0 && <div style={{ width: `${pctMissed}%`, background: '#E74C3C', height: '100%', transition: 'width 0.4s ease' }} />}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: labelColor, width: 46, textAlign: 'right', flexShrink: 0 }}>
        {onTimePct}%
      </div>
    </div>
  );
}

function Card({ icon, iconColor, title, children }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
        {icon}
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function Dashboard({ profile, userRole, userId, setCurrentPage }) {
  const canEdit = userRole === 'pm' || userRole === 'admin';
  const isMia = profile?.full_name?.toLowerCase().startsWith('mia');
  const showGrantAlert = isMia || userRole === 'pm';
  const showLabDash = profile?.can_see_lab_dashboard ?? true;
  const showLeadershipDash = (profile?.can_see_leadership_dashboard ?? showGrantAlert) && showGrantAlert;
  const showPersonalDash = profile?.can_see_personal_dashboard ?? true;

  // Lab data
  const [outToday, setOutToday] = useState([]);
  const [nextWeekOut, setNextWeekOut] = useState([]);
  const [labMeetings, setLabMeetings] = useState([]);
  const [adhocMeetings, setAdhocMeetings] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Personal data
  const [myTimeOff, setMyTimeOff] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [myRecurOccs, setMyRecurOccs] = useState([]);
  const [grants, setGrants] = useState([]);
  const [unassignedTasks, setUnassignedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overlapWarning, setOverlapWarning] = useState(null);
  const [expandedUnassignedId, setExpandedUnassignedId] = useState(null);

  // Productivity state
  const [recurPeriod, setRecurPeriod] = useState('current');
  const [recurData, setRecurData] = useState([]);
  const [recurLoading, setRecurLoading] = useState(false);

  const initialRecurLoadedRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, [profile]);
  // Skip the first fire (initial data is bundled into fetchAll); only reload when period changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!teamMembers.length) return; if (!initialRecurLoadedRef.current) { initialRecurLoadedRef.current = true; return; } loadRecurProductivity(recurPeriod); }, [teamMembers, recurPeriod]);

  async function fetchAll() {
    if (!profile?.id) return;
    initialRecurLoadedRef.current = false;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const next8Weeks = new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sporQuery = canEdit
      ? supabase.from('sporadic_tasks')
          .select('*, assignee:profiles!sporadic_tasks_assigned_to_fkey(id, full_name)')
          .or('status.is.null,status.in.(pending,in_progress)').order('due_date')
      : supabase.from('sporadic_tasks')
          .select('*')
          .eq('assigned_to', profile.id).or('status.is.null,status.in.(pending,in_progress)').order('due_date');

    const queries = [
      // vacation – all approved in next 30 days
      supabase.from('vacation_requests')
        .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name)')
        .eq('status', 'approved').lte('start_date', next8Weeks).gte('end_date', today).order('start_date'),
      // all requests: Mia/PM see everyone's, others see only their own (pending+approved only)
      showGrantAlert
        ? supabase.from('vacation_requests')
            .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name)')
            .in('status', ['pending', 'approved'])
            .order('start_date', { ascending: false })
        : supabase.from('vacation_requests')
            .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name)')
            .eq('requested_by', profile.id)
            .in('status', ['pending', 'approved'])
            .order('start_date', { ascending: false }),
      // meetings — both types live in lab_meetings, split by meeting_type
      supabase.from('lab_meetings')
        .select('*, presenter:profiles!lab_meetings_presenter_id_fkey(full_name)')
        .eq('status', 'scheduled').gte('meeting_date', today).order('meeting_date'),
      // tasks
      sporQuery,
      // current user's recurring task occurrences (last 90 days → next 30 days)
      supabase.from('task_occurrences')
        .select('id, due_date, status, completed_at, task_definition_id, task_def:tasks_definitions(title, group_name)')
        .eq('assigned_to', profile.id)
        .gte('due_date', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0])
        .lte('due_date', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
        .order('due_date'),
      supabase.from('profiles').select('id, full_name, email, role, lab_status').order('full_name'),
      // grants (for Mia and PM only)
      showGrantAlert
        ? supabase.from('grants').select('id, name, end_date, total_amount, remaining_balance')
        : Promise.resolve({ data: [] }),
      // unassigned sporadic tasks (for Mia and PM only)
      showGrantAlert
        ? supabase.from('task_occurrences')
            .select('id, due_date, task_def:tasks_definitions(id, title, category, group_name)')
            .is('assigned_to', null)
            .gte('due_date', today)
            .lte('due_date', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
            .order('due_date')
        : Promise.resolve({ data: [] }),
      // recur productivity for initial load (bundled so all cards appear together)
      (() => { const { from, to } = prodDateRange('current'); return supabase.from('task_occurrences').select('id, due_date, status, completed_at, assigned_to').not('assigned_to', 'is', null).gte('due_date', from).lte('due_date', to); })(),
    ];

    const [
      { data: vacData },
      { data: myVacData },
      { data: allMeetingData },
      { data: sporData },
      { data: myRecurData },
      { data: memberData },
      { data: grantData },
      { data: unassignedData },
      { data: initRecurOccData },
    ] = await Promise.all(queries);

    const allVac = vacData || [];
    setOutToday(allVac.filter(r => r.start_date <= today && r.end_date >= today));
    setNextWeekOut(allVac.filter(r => r.start_date > today && r.start_date <= next8Weeks));
    const allMeetings = allMeetingData || [];
    setLabMeetings(allMeetings.filter(m => m.meeting_type !== 'adhoc_meeting').slice(0, 3));
    setAdhocMeetings(allMeetings.filter(m => m.meeting_type === 'adhoc_meeting').slice(0, 6));
    setMyTimeOff((myVacData || []).filter(r => r.end_date >= today));
    setMyTasks(sporData || []);
    setMyRecurOccs(myRecurData || []);
    setTeamMembers(memberData || []);
    setGrants(grantData || []);
    setUnassignedTasks(unassignedData || []);
    const todayForProd = new Date().toISOString().split('T')[0];
    const byPersonInit = {};
    (initRecurOccData || []).forEach(o => { if (!byPersonInit[o.assigned_to]) byPersonInit[o.assigned_to] = []; byPersonInit[o.assigned_to].push(o); });
    setRecurData((memberData || []).map(p => ({ profile: p, ...calcProdScore(byPersonInit[p.id] || [], todayForProd) })));
    setLoading(false);
  }

  function prodDateRange(period) {
    const today = new Date().toISOString().split('T')[0];
    if (period === '30d') return { from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], to: today };
    if (period === 'all') return { from: '2020-01-01', to: '2099-12-31' };
    return { from: '2020-01-01', to: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0] };
  }

  function calcProdScore(occs, todayStr) {
    const onTime  = occs.filter(o => (o.status === 'done' || o.completed_at) && o.completed_at && o.completed_at.slice(0,10) <= o.due_date).length;
    const late    = occs.filter(o => (o.status === 'done' || o.completed_at) && o.completed_at && o.completed_at.slice(0,10) > o.due_date).length;
    const done    = occs.filter(o => o.status === 'done').length;
    const missed  = occs.filter(o => o.status !== 'done' && o.due_date < todayStr).length;
    const pending = occs.filter(o => o.status !== 'done' && o.due_date >= todayStr).length;
    const matured = onTime + late + missed;
    const score   = matured > 0 ? Math.round((onTime + late * 0.5) / matured * 100)
                  : done > 0    ? Math.round(done / (done + missed) * 100)
                  : null;
    return { onTime, late, done, missed, pending, matured, score };
  }

  async function loadRecurProductivity(period) {
    setRecurLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { from, to } = prodDateRange(period);
    const { data } = await supabase
      .from('task_occurrences')
      .select('id, due_date, status, completed_at, assigned_to')
      .not('assigned_to', 'is', null)
      .gte('due_date', from)
      .lte('due_date', to);
    const byPerson = {};
    (data || []).forEach(o => { if (!byPerson[o.assigned_to]) byPerson[o.assigned_to] = []; byPerson[o.assigned_to].push(o); });
    setRecurData(teamMembers.map(p => ({ profile: p, ...calcProdScore(byPerson[p.id] || [], today) })));
    setRecurLoading(false);
  }

  const today = new Date().toISOString().split('T')[0];
  const myPersonalAdhocTasks = myTasks.filter(t => t.assigned_to === profile?.id);

  const vacOverlapIds = (() => {
    const all = [...outToday, ...nextWeekOut];
    const ids = new Set();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (a.start_date <= b.end_date && b.start_date <= a.end_date) { ids.add(a.id); ids.add(b.id); }
      }
    }
    return ids;
  })();

  const tripleVacOverlapInfo = (() => {
    const all = [...outToday, ...nextWeekOut];
    const seen = new Set();
    const deduped = all.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
    const result = {};
    deduped.forEach(r => {
      const others = deduped.filter(o => o.id !== r.id && o.start_date <= r.end_date && r.start_date <= o.end_date);
      if (others.length >= 2) {
        result[r.id] = others.map(o => ({
          name: o.requester?.full_name || 'Unknown',
          start: o.start_date > r.start_date ? o.start_date : r.start_date,
          end: o.end_date < r.end_date ? o.end_date : r.end_date,
        }));
      }
    });
    return result;
  })();

  const vacRequestOverlapIds = showGrantAlert ? (() => {
    const ids = new Set();
    for (let i = 0; i < myTimeOff.length; i++) {
      for (let j = i + 1; j < myTimeOff.length; j++) {
        const a = myTimeOff[i], b = myTimeOff[j];
        if (a.start_date <= b.end_date && b.start_date <= a.end_date) { ids.add(a.id); ids.add(b.id); }
      }
    }
    return ids;
  })() : new Set();

  // 3+ member overlap info for the "My time off" requests card
  const tripleVacRequestOverlapInfo = showGrantAlert ? (() => {
    const result = {};
    myTimeOff.forEach(r => {
      const others = myTimeOff.filter(o => o.id !== r.id && o.start_date <= r.end_date && r.start_date <= o.end_date);
      if (others.length >= 2) {
        result[r.id] = others.map(o => ({
          name: o.requester?.full_name || 'Unknown',
          start: o.start_date > r.start_date ? o.start_date : r.start_date,
          end: o.end_date < r.end_date ? o.end_date : r.end_date,
        }));
      }
    });
    return result;
  })() : {};

  // 0=overdue, 1=upcoming with date, 2=no due date (assigned), 3=done
  const classifyAdhocTask = t => (t.status === 'done' || t.status === 'submitted') ? 3 : (t.due_date && t.due_date < today) ? 0 : t.due_date ? 1 : 2;
  const adhocDisplayTasks = canEdit ? myTasks : myPersonalAdhocTasks;
  const sortedAdhocTasks = [...adhocDisplayTasks].sort((a, b) => {
    const d = classifyAdhocTask(a) - classifyAdhocTask(b);
    if (d !== 0) return d;
    if (!a.due_date && !b.due_date) return (a.created_at || '').localeCompare(b.created_at || '');
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const alertGrants = grants.filter(g => {
    const pct = g.total_amount && g.remaining_balance ? (g.remaining_balance / g.total_amount) * 100 : null;
    const daysLeft = g.end_date ? Math.ceil((new Date(g.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
    return (pct !== null && pct < 25) || (daysLeft !== null && daysLeft <= 90);
  });

  const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const next30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const unassigned7 = unassignedTasks.filter(t => t.due_date && t.due_date <= next7);
  const unassigned30 = unassignedTasks.filter(t => t.due_date && t.due_date <= next30);

  const STATUS_COLORS = {
    approved: { bg: '#EAF7F0', text: '#27AE60' },
    pending:  { bg: '#FEF9E7', text: '#F39C12' },
    denied:   { bg: '#FDEDEC', text: '#E74C3C' },
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.25s ease both' }}>

          {/* ══ LAB DASHBOARD ══ */}
          {showLabDash && <div style={{ background: '#F0F4FF', border: '1px solid #D8E0F5', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#3B5BDB', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '10px', borderLeft: '3px solid #3B5BDB', lineHeight: 1.2, margin: '0 0 16px' }}>Lab Dashboard</h2>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>

              {/* Col 1 — Recurrent lab task productivity */}
              <div style={{ flex: '26 1 0', minWidth: 0 }}>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <ClipboardList size={13} color="var(--text-primary)" />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Recurrent lab task productivity</span>
                    </div>
                    <PeriodPicker value={recurPeriod} onChange={setRecurPeriod} />
                  </div>
                  <div style={{ padding: '5px 14px', display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[['#27AE60', 'On time'], ['#F39C12', 'Late'], ['#E74C3C', 'Missed']].map(([color, label]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>% on time</span>
                  </div>
                  {recurLoading ? (
                    <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
                  ) : (
                    <div style={{ padding: '4px 14px 8px' }}>
                      {recurData.filter(row => !row.profile?.full_name?.toLowerCase().startsWith('mia')).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map(row => (
                        <RecurScoreRow key={row.profile.id} row={row} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Col 2 — Ad hoc task productivity */}
              <div style={{ flex: '35 1 0', minWidth: 0 }}>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <ClipboardList size={13} color="#27AE60" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Ad hoc task productivity</span>
                  </div>
                  {sortedAdhocTasks.filter(t => t.status !== 'done' && t.status !== 'submitted').length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No upcoming or overdue tasks.</p>
                  ) : (
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {sortedAdhocTasks.filter(t => t.status !== 'done' && t.status !== 'submitted').map((task, i) => {
                        const cls = classifyAdhocTask(task);
                        const noDate = cls === 2;
                        const statusColor = cls === 0 ? '#E74C3C' : noDate ? 'var(--text-primary)' : '#F39C12';
                        const statusBg   = cls === 0 ? '#FDEDEC' : noDate ? 'var(--purple-faint)' : '#FEF9E7';
                        const statusLabel = cls === 0 ? 'Overdue' : noDate ? 'Assigned' : 'Upcoming';
                        const dateStr = noDate
                          ? (task.created_at ? formatDate(task.created_at.slice(0, 10)) : null)
                          : task.due_date ? formatDate(task.due_date) : null;
                        const isOverdue = cls === 0;
                        return (
                          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: i > 0 ? (isOverdue ? '1px solid #FCCACA' : '1px solid var(--border)') : 'none', background: isOverdue ? '#FEF5F5' : undefined }}>
                            {isOverdue ? (
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FDEDEC', border: '1.5px solid #E74C3C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 900, color: '#E74C3C', lineHeight: 1 }}>!</span>
                              </div>
                            ) : (
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: 12, color: isOverdue ? '#C0392B' : 'var(--text-primary)', fontWeight: isOverdue ? 600 : 400, flex: 1, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                            {task.assignee?.full_name && (
                              <span style={{ fontSize: 11, color: isOverdue ? '#E74C3C' : 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{task.assignee.full_name.split(' ')[0]}</span>
                            )}
                            {dateStr && (
                              <span style={{ fontSize: 10, color: isOverdue ? '#E74C3C' : 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap', fontWeight: isOverdue ? 600 : 400 }}>{dateStr}</span>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: statusBg, color: statusColor, flexShrink: 0, whiteSpace: 'nowrap' }}>{statusLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Col 3 — Out today + Out 8 weeks stacked */}
              <div style={{ flex: '24 1 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Out today */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Palmtree size={13} color="#F39C12" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Out today</span>
                  </div>
                  {outToday.length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Everyone in.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {outToday.map((r, i) => {
                        const hasOverlap = vacOverlapIds.has(r.id);
                        const tripleInfo = tripleVacOverlapInfo[r.id];
                        const warningOpen = overlapWarning === `vac_${r.id}`;
                        const s = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                        return (
                          <div key={r.id} style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', background: hasOverlap ? '#FEF5F5' : undefined }}>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: hasOverlap ? '#E74C3C' : 'var(--text-primary)' }}>{r.requester?.full_name}</span>
                                <p style={{ margin: '1px 0 0', fontSize: '11px', color: hasOverlap ? '#E74C3C' : 'var(--text-muted)' }}>
                                  {formatDate(r.start_date)}{r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                                </p>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                                {tripleInfo ? (
                                  <button onClick={() => setOverlapWarning(warningOpen ? null : `vac_${r.id}`)}
                                    title="3+ members overlapping — click for details"
                                    style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 7px', fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 6, cursor: 'pointer' }}>
                                    ⚠ {tripleInfo.length + 1} overlap
                                  </button>
                                ) : hasOverlap ? (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: '#E74C3C', background: '#FDEDEC', padding: '1px 5px', borderRadius: 6, border: '1px solid #F1948A' }}>OVERLAP</span>
                                ) : null}
                                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.text }}>
                                  {r.status === 'pending' ? 'Pending' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                                </span>
                              </div>
                            </div>
                            {warningOpen && tripleInfo && (
                              <div style={{ position: 'absolute', right: 14, top: '100%', marginTop: 4, zIndex: 50, background: 'white', border: '1px solid #F59E0B', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '10px 14px', minWidth: 230 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠ Overlapping with {r.requester?.full_name}</div>
                                {tripleInfo.map((o, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderTop: idx > 0 ? '1px solid #FEF3C7' : 'none' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{o.name}</span>
                                    <span style={{ fontSize: 11, color: '#92400E', whiteSpace: 'nowrap' }}>{formatDate(o.start)}–{formatDate(o.end)}</span>
                                  </div>
                                ))}
                                <button onClick={() => setOverlapWarning(null)} style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Dismiss</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Out next 8 weeks */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Calendar size={13} color="var(--text-primary)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Out — next 8 weeks</span>
                  </div>
                  {nextWeekOut.length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>None scheduled.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {nextWeekOut.map((r, i) => {
                        const hasOverlap = vacOverlapIds.has(r.id);
                        const tripleInfo = tripleVacOverlapInfo[r.id];
                        const warningOpen = overlapWarning === `vac_${r.id}`;
                        const openUpward = i >= Math.ceil(nextWeekOut.length / 2);
                        const s = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                        return (
                          <div key={r.id} style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', background: hasOverlap ? '#FEF5F5' : undefined }}>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: hasOverlap ? '#E74C3C' : 'var(--text-primary)' }}>{r.requester?.full_name}</span>
                                <p style={{ margin: '1px 0 0', fontSize: '11px', color: hasOverlap ? '#E74C3C' : 'var(--text-muted)' }}>
                                  {formatDate(r.start_date)}{r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                                </p>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                                {tripleInfo ? (
                                  <button onClick={() => setOverlapWarning(warningOpen ? null : `vac_${r.id}`)}
                                    title="3+ members overlapping — click for details"
                                    style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 7px', fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 6, cursor: 'pointer' }}>
                                    ⚠ {tripleInfo.length + 1} overlap
                                  </button>
                                ) : hasOverlap ? (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: '#E74C3C', background: '#FDEDEC', padding: '1px 5px', borderRadius: 6, border: '1px solid #F1948A' }}>OVERLAP</span>
                                ) : null}
                                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.text }}>
                                  {r.status === 'pending' ? 'Pending' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                                </span>
                              </div>
                            </div>
                            {warningOpen && tripleInfo && (
                              <div style={{ position: 'absolute', right: 14, ...(openUpward ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }), zIndex: 50, background: 'white', border: '1px solid #F59E0B', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '10px 14px', minWidth: 230 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠ Overlapping with {r.requester?.full_name}</div>
                                {tripleInfo.map((o, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderTop: idx > 0 ? '1px solid #FEF3C7' : 'none' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{o.name}</span>
                                    <span style={{ fontSize: 11, color: '#92400E', whiteSpace: 'nowrap' }}>{formatDate(o.start)}–{formatDate(o.end)}</span>
                                  </div>
                                ))}
                                <button onClick={() => setOverlapWarning(null)} style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Dismiss</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Col 4 — Lab meetings + Ad hoc meetings stacked */}
              <div style={{ flex: '20 1 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Calendar size={13} color="var(--text-primary)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Lab meetings</span>
                  </div>
                  {labMeetings.length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>None scheduled.</p>
                  ) : (
                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {labMeetings.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {new Date(m.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                              {m.is_sof && <Star size={10} color="#7B3FA0" fill="#7B3FA0" />}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{m.presenter?.full_name || m.guest_name || <em>TBD</em>}</div>
                          </div>
                          {m.is_sof && <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: 700, background: 'var(--purple-faint)', color: 'var(--text-primary)', flexShrink: 0 }}>SOF</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Calendar size={13} color="var(--text-primary)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Ad hoc meetings</span>
                  </div>
                  {adhocMeetings.length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>None scheduled.</p>
                  ) : (
                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {adhocMeetings.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {new Date(m.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{m.presenter?.full_name || m.guest_name || m.notes || <em>TBD</em>}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>}

          {/* ══ LEADERSHIP DASHBOARD ══ */}
          {showLeadershipDash && (
            <div style={{ background: '#F5FFF8', border: '1px solid #C8EDD8', borderRadius: '16px', padding: '20px' }}>
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#1A7F4B', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '10px', borderLeft: '3px solid #1A7F4B', lineHeight: 1.2, margin: '0 0 16px' }}>Leadership Dashboard</h2>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>

                {/* Grants */}
                <div style={{ flex: '3 1 0', minWidth: 0 }}>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
                      <DollarSign size={13} color="#1A7F4B" />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Grants</span>
                    </div>
                    {grants.length === 0 ? (
                      <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No grants on file.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Header row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px 100px', gap: 8, padding: '6px 14px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                          {['Grant', 'Balance', 'Remaining', 'Expires'].map(h => (
                            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                          ))}
                        </div>
                        {grants.map((g, i) => {
                          const pct = g.total_amount && g.remaining_balance != null ? (g.remaining_balance / g.total_amount) * 100 : null;
                          const daysLeft = g.end_date ? Math.ceil((new Date(g.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
                          const lowBalance = pct !== null && pct < 25;
                          const urgent = daysLeft !== null && daysLeft <= 14;
                          const expiringSoon = daysLeft !== null && daysLeft <= 90;
                          const rowAlert = lowBalance || urgent;
                          return (
                            <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px 100px', gap: 8, padding: '9px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', background: rowAlert ? '#FEF5F5' : undefined, alignItems: 'center' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: rowAlert ? '#E74C3C' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                              <div>
                                {pct !== null ? (
                                  <>
                                    <div style={{ height: 6, borderRadius: 3, background: '#E5E5EA', overflow: 'hidden', marginBottom: 3 }}>
                                      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct < 10 ? '#E74C3C' : pct < 25 ? '#F39C12' : '#27AE60', borderRadius: 3, transition: 'width 0.3s ease' }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: lowBalance ? '#E74C3C' : 'var(--text-muted)' }}>
                                      ${g.remaining_balance?.toLocaleString()} / ${g.total_amount?.toLocaleString()}
                                    </span>
                                  </>
                                ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                              </div>
                              <div>
                                {pct !== null ? (
                                  <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: lowBalance ? '#FDEDEC' : '#EAF7F0', color: lowBalance ? '#E74C3C' : '#27AE60' }}>
                                    {pct.toFixed(0)}%
                                  </span>
                                ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                              </div>
                              <div>
                                {daysLeft !== null ? (
                                  <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: urgent ? '#FDEDEC' : expiringSoon ? '#FEF9E7' : 'var(--bg-secondary)', color: urgent ? '#E74C3C' : expiringSoon ? '#F39C12' : 'var(--text-muted)' }}>
                                    {daysLeft < 0 ? 'Expired' : `${daysLeft}d left`}
                                  </span>
                                ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Unassigned tasks */}
                <div style={{ flex: '2 1 0', minWidth: 0 }}>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                    <button
                      onClick={() => { localStorage.setItem('tasks2_tab', 'assigned'); setCurrentPage('tasks2'); }}
                      style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <UserX size={13} color="#E74C3C" />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Unassigned tasks</span>
                      <span style={{ fontSize: 10, color: 'var(--purple-primary)', fontWeight: 600 }}>View →</span>
                    </button>
                    {/* Stat pills */}
                    <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, background: unassigned7.length > 0 ? '#FDEDEC' : '#EAF7F0', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: unassigned7.length > 0 ? '#E74C3C' : '#27AE60' }}>{unassigned7.length}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: unassigned7.length > 0 ? '#E74C3C' : '#27AE60', marginTop: 2 }}>Next 7 days</div>
                      </div>
                      <div style={{ flex: 1, background: unassigned30.length > 0 ? '#FEF9E7' : '#EAF7F0', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: unassigned30.length > 0 ? '#F39C12' : '#27AE60' }}>{unassigned30.length}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: unassigned30.length > 0 ? '#F39C12' : '#27AE60', marginTop: 2 }}>Next 30 days</div>
                      </div>
                    </div>
                    {/* Next 7 days task list */}
                    {unassigned7.length === 0 ? (
                      <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No unassigned tasks in next 7 days.</p>
                    ) : (
                      <>
                        <div style={{ padding: '5px 14px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Next 7 days — click to expand</span>
                        </div>
                        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                          {unassigned7.map((t, i) => {
                            const overdue = t.due_date && t.due_date < today;
                            const isExpanded = expandedUnassignedId === t.id;
                            const activeMembers = teamMembers.filter(m => m.lab_status !== 'alumni');
                            return (
                              <div key={t.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : '1px solid var(--border)', background: overdue ? '#FEF5F5' : undefined }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}>
                                  <button
                                    onClick={() => setExpandedUnassignedId(isExpanded ? null : t.id)}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flex: 1, minWidth: 0, textAlign: 'left' }}
                                    title="Click to view full task"
                                  >
                                    <span style={{ fontSize: 12, color: overdue ? '#C0392B' : 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                      {(() => { const title = t.task_def?.title || '(no title)'; return title.length > 38 ? title.slice(0, 38) + '…' : title; })()}
                                    </span>
                                  </button>
                                  <select
                                    defaultValue=""
                                    onChange={async e => {
                                      if (!e.target.value) return;
                                      await supabase.from('task_occurrences').update({ assigned_to: e.target.value, status: 'assigned' }).eq('id', t.id);
                                      setUnassignedTasks(prev => prev.filter(x => x.id !== t.id));
                                      if (expandedUnassignedId === t.id) setExpandedUnassignedId(null);
                                    }}
                                    style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, padding: '3px 4px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', flexShrink: 0, maxWidth: 110, cursor: 'pointer' }}
                                  >
                                    <option value="">Assign…</option>
                                    {activeMembers.map(m => (
                                      <option key={m.id} value={m.id}>{m.full_name.split(' ')[0]}</option>
                                    ))}
                                  </select>
                                  {t.due_date && (
                                    <span style={{ fontSize: 10, color: overdue ? '#E74C3C' : 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap', fontWeight: overdue ? 600 : 400 }}>{formatDate(t.due_date)}</span>
                                  )}
                                </div>
                                {isExpanded && (
                                  <div style={{ padding: '6px 14px 10px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{t.task_def?.title || '(no title)'}</p>
                                    {t.task_def?.category && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 2px' }}>{t.task_def.category}{t.task_def.group_name ? ` · ${t.task_def.group_name}` : ''}</p>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ══ PERSONAL DASHBOARD ══ */}
          {showPersonalDash && <div style={{ background: '#FBF8FF', border: '1px solid #E4D9F5', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '10px', borderLeft: '3px solid #7B3FA0', lineHeight: 1.2, margin: '0 0 16px' }}>Personal Dashboard</h2>

            {/* Grant Alerts — full width above columns */}
            {showGrantAlert && alertGrants.length > 0 && (
              <div style={{ background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                  <AlertTriangle size={14} color="#F39C12" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#F39C12', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grant Alerts</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {alertGrants.map(g => {
                    const pct = g.total_amount && g.remaining_balance ? (g.remaining_balance / g.total_amount) * 100 : null;
                    const daysLeft = g.end_date ? Math.ceil((new Date(g.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
                    const urgent = daysLeft !== null && daysLeft <= 14;
                    return (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{g.name}</span>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          {pct !== null && pct < 25 && <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#FDEDEC', color: '#E74C3C' }}>{pct.toFixed(0)}% remaining</span>}
                          {daysLeft !== null && daysLeft <= 90 && <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: urgent ? '#FDEDEC' : '#FEF9E7', color: urgent ? '#E74C3C' : '#F39C12' }}>Expires in {daysLeft}d</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>

              {/* Col 1 — Recurring task status */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <TaskStatusCard
                  icon={<ClipboardList size={13} color="var(--text-primary)" />}
                  title="Recurrent task status"
                  tasks={myRecurOccs}
                  getTitle={t => t.task_def?.title || 'Task'}
                  dateKey="due_date"
                />
              </div>

              {/* Col 2 — Ad hoc task status */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <TaskStatusCard
                  icon={<ClipboardList size={13} color="#27AE60" />}
                  title="Ad hoc task status"
                  tasks={myPersonalAdhocTasks}
                  getTitle={t => t.title}
                  dateKey="due_date"
                  upcomingLabel="Upcoming"
                />
              </div>

              {/* Col 3 — My time off */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <Card icon={<Palmtree size={13} color="#F39C12" />} title="My time off">
                  {myTimeOff.length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No time off requests.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {myTimeOff.map((r, i) => {
                        const s = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                        const hasOverlap = vacRequestOverlapIds.has(r.id);
                        const tripleInfo = tripleVacRequestOverlapInfo[r.id];
                        const warningOpen = overlapWarning === `req_${r.id}`;
                        const openUpward = i >= Math.ceil(myTimeOff.length / 2);
                        const label = showGrantAlert ? (r.requester?.full_name || 'Unknown') : r.leave_type;
                        return (
                          <div key={r.id} style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', background: hasOverlap ? '#FEF5F5' : undefined }}>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: hasOverlap ? '#E74C3C' : 'var(--text-primary)' }}>{label}</span>
                                <p style={{ margin: '1px 0 0', fontSize: '11px', color: hasOverlap ? '#E74C3C' : 'var(--text-muted)' }}>
                                  {formatDate(r.start_date)}{r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                                </p>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                                {tripleInfo ? (
                                  <button onClick={() => setOverlapWarning(warningOpen ? null : `req_${r.id}`)}
                                    title="3+ members overlapping — click for details"
                                    style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 7px', fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 6, cursor: 'pointer' }}>
                                    ⚠ {tripleInfo.length + 1} overlap
                                  </button>
                                ) : hasOverlap ? (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: '#E74C3C', background: '#FDEDEC', padding: '1px 5px', borderRadius: 6, border: '1px solid #F1948A' }}>OVERLAP</span>
                                ) : null}
                                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.text }}>
                                  {r.status === 'pending' ? 'Pending approval' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                                </span>
                              </div>
                            </div>
                            {warningOpen && tripleInfo && (
                              <div style={{ position: 'absolute', right: 14, ...(openUpward ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }), zIndex: 50, background: 'white', border: '1px solid #F59E0B', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '10px 14px', minWidth: 230 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠ Overlapping with {label}</div>
                                {tripleInfo.map((o, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderTop: idx > 0 ? '1px solid #FEF3C7' : 'none' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{o.name}</span>
                                    <span style={{ fontSize: 11, color: '#92400E', whiteSpace: 'nowrap' }}>{formatDate(o.start)}–{formatDate(o.end)}</span>
                                  </div>
                                ))}
                                <button onClick={() => setOverlapWarning(null)} style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Dismiss</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>

            </div>
          </div>}

        </div>
      )}
    </div>
  );
}
