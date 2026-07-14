import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Palmtree, Star, ClipboardList, AlertTriangle } from 'lucide-react';


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

function TaskStatusCard({ icon, title, tasks, getTitle, dateKey }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const next14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  const next30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const missed   = tasks.filter(t => t.status !== 'done' && t[dateKey] && t[dateKey] < todayStr);
  const twoWeeks = tasks.filter(t => t.status !== 'done' && t[dateKey] && t[dateKey] >= todayStr && t[dateKey] <= next14);
  const thirty   = tasks.filter(t => t.status !== 'done' && t[dateKey] && t[dateKey] > next14 && t[dateKey] <= next30);
  const isEmpty  = !missed.length && !twoWeeks.length && !thirty.length;

  const renderSection = (label, items, headBg, headColor) => {
    if (!items.length) return null;
    return (
      <div key={label}>
        <div style={{ padding: '5px 14px', background: headBg, display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: headColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.55)', color: headColor, borderRadius: 8, padding: '0 5px', lineHeight: 1.6 }}>{items.length}</span>
        </div>
        {items.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, lineHeight: 1.3 }}>{getTitle(t)}</span>
            {t[dateKey] && (
              <span style={{ fontSize: 10, color: headBg === '#ef4444' ? '#E74C3C' : 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{formatDate(t[dateKey])}</span>
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
        <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Nothing missed or due in the next 30 days.</p>
      ) : (
        <>
          {renderSection('Missed', missed, '#ef4444', '#fff')}
          {renderSection('Upcoming — next 2 weeks', twoWeeks, '#FFFBF0', '#D68910')}
          {renderSection('Upcoming — next 30 days', thirty, 'var(--bg-secondary)', 'var(--text-secondary)')}
        </>
      )}
    </div>
  );
}

function RecurScoreRow({ row }) {
  const { profile, onTime, late, missed, pending } = row;
  const firstName = (profile.full_name || '').split(' ')[0];
  const total = onTime + late + missed + pending;
  const matured = onTime + late + missed;
  if (total === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', width: 72, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstName}</div>
        <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--border)' }} />
        <div style={{ fontSize: 10, color: 'var(--text-muted)', width: 46, textAlign: 'right', flexShrink: 0 }}>—</div>
      </div>
    );
  }
  const pctOnTime = Math.round(onTime / total * 100);
  const pctLate = Math.round(late / total * 100);
  const pctMissed = Math.round(missed / total * 100);
  const pctPending = 100 - pctOnTime - pctLate - pctMissed;
  const onTimePct = matured > 0 ? Math.round(onTime / matured * 100) : null;
  const labelColor = onTimePct === null ? 'var(--text-muted)' : onTimePct >= 70 ? '#27AE60' : onTimePct >= 40 ? '#F39C12' : '#E74C3C';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', width: 72, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstName}</div>
      <div style={{ flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', background: '#E5E5EA' }}>
        {pctOnTime > 0 && <div style={{ width: `${pctOnTime}%`, background: '#27AE60', height: '100%', transition: 'width 0.4s ease' }} />}
        {pctLate > 0 && <div style={{ width: `${pctLate}%`, background: '#F39C12', height: '100%', transition: 'width 0.4s ease' }} />}
        {pctMissed > 0 && <div style={{ width: `${pctMissed}%`, background: '#E74C3C', height: '100%', transition: 'width 0.4s ease' }} />}
        {pctPending > 0 && <div style={{ width: `${pctPending}%`, background: '#D0D0D8', height: '100%', transition: 'width 0.4s ease' }} />}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: labelColor, width: 46, textAlign: 'right', flexShrink: 0 }}>
        {onTimePct !== null ? `${onTimePct}%` : '—'}
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

export default function Dashboard({ profile, userRole, userId }) {
  const canEdit = userRole === 'pm' || userRole === 'admin';
  const isMia = profile?.full_name?.toLowerCase().startsWith('mia');
  const showGrantAlert = isMia || userRole === 'pm';

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
  const [publicTasks, setPublicTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Productivity state
  const [recurPeriod, setRecurPeriod] = useState('current');
  const [recurData, setRecurData] = useState([]);
  const [recurLoading, setRecurLoading] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, [profile]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (teamMembers.length) loadRecurProductivity(recurPeriod); }, [teamMembers, recurPeriod]);

  async function fetchAll() {
    if (!profile?.id) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const next8Weeks = new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sporQuery = canEdit
      ? supabase.from('sporadic_tasks')
          .select('*, assignee:profiles!sporadic_tasks_assigned_to_fkey(id, full_name), assigner:profiles!sporadic_tasks_assigned_by_fkey(full_name)')
          .in('status', ['pending', 'in_progress', 'done']).order('due_date')
      : supabase.from('sporadic_tasks')
          .select('*, assigner:profiles!sporadic_tasks_assigned_by_fkey(full_name)')
          .eq('assigned_to', profile.id).in('status', ['pending', 'in_progress', 'done']).order('due_date');

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
      supabase.from('profiles').select('id, full_name, email, role').order('full_name'),
      // grants (for Mia and PM only)
      showGrantAlert
        ? supabase.from('grants').select('id, name, end_date, total_amount, remaining_balance')
        : Promise.resolve({ data: [] }),
      // public one-off tasks (all statuses so completed ones show too)
      supabase.from('sporadic_tasks')
        .select('*, assignee:profiles!assigned_to(full_name)')
        .eq('show_on_public_dashboard', true)
        .order('status')
        .order('due_date'),
    ];

    const [
      { data: vacData },
      { data: myVacData },
      { data: allMeetingData },
      { data: sporData },
      { data: myRecurData },
      { data: memberData },
      { data: grantData },
      { data: publicTaskData },
    ] = await Promise.all(queries);

    const allVac = vacData || [];
    setOutToday(allVac.filter(r => r.start_date <= today && r.end_date >= today));
    setNextWeekOut(allVac.filter(r => r.start_date > today && r.start_date <= next8Weeks));
    const allMeetings = allMeetingData || [];
    setLabMeetings(allMeetings.filter(m => m.meeting_type !== 'adhoc_meeting').slice(0, 6));
    setAdhocMeetings(allMeetings.filter(m => m.meeting_type === 'adhoc_meeting').slice(0, 6));
    setMyTimeOff(myVacData || []);
    setMyTasks(sporData || []);
    setMyRecurOccs(myRecurData || []);
    setTeamMembers(memberData || []);
    setGrants(grantData || []);
    setPublicTasks(publicTaskData || []);
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

  const classifyAdhocTask = t => t.status === 'done' ? 2 : (t.due_date && t.due_date < today) ? 0 : 1;
  const adhocDisplayTasks = canEdit ? myTasks : publicTasks;
  const sortedAdhocTasks = [...adhocDisplayTasks].sort((a, b) => {
    const d = classifyAdhocTask(a) - classifyAdhocTask(b);
    return d !== 0 ? d : (a.due_date || '').localeCompare(b.due_date || '');
  });

  const alertGrants = grants.filter(g => {
    const pct = g.total_amount && g.remaining_balance ? (g.remaining_balance / g.total_amount) * 100 : null;
    const daysLeft = g.end_date ? Math.ceil((new Date(g.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
    return (pct !== null && pct < 25) || (daysLeft !== null && daysLeft <= 90);
  });

  const STATUS_COLORS = {
    approved: { bg: '#EAF7F0', text: '#27AE60' },
    pending:  { bg: '#FEF9E7', text: '#F39C12' },
    denied:   { bg: '#FDEDEC', text: '#E74C3C' },
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

          {/* ══ PERSONAL DASHBOARD ══ */}
          <div style={{ flex: 1, minWidth: 0, order: 2, background: '#FBF8FF', border: '1px solid #E4D9F5', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '10px', borderLeft: '3px solid #7B3FA0', lineHeight: 1.2, margin: '0 0 16px' }}>Personal Dashboard</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Grant Alerts — Mia and PM only */}
            {showGrantAlert && alertGrants.length > 0 && (
              <div style={{ background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
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
                          {pct !== null && pct < 25 && (
                            <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#FDEDEC', color: '#E74C3C' }}>
                              {pct.toFixed(0)}% remaining
                            </span>
                          )}
                          {daysLeft !== null && daysLeft <= 90 && (
                            <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: urgent ? '#FDEDEC' : '#FEF9E7', color: urgent ? '#E74C3C' : '#F39C12' }}>
                              Expires in {daysLeft}d
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recurring task status */}
            <TaskStatusCard
              icon={<ClipboardList size={13} color="var(--purple-primary)" />}
              title="Recurrent task status"
              tasks={myRecurOccs}
              getTitle={t => t.task_def?.title || 'Task'}
              dateKey="due_date"
            />

            {/* Ad hoc task status */}
            <TaskStatusCard
              icon={<ClipboardList size={13} color="#27AE60" />}
              title="Ad hoc task status"
              tasks={myPersonalAdhocTasks}
              getTitle={t => t.title}
              dateKey="due_date"
            />

            {/* All requests */}
            <Card icon={<Palmtree size={13} color="#F39C12" />} title="All requests">
              {myTimeOff.length === 0 ? (
                <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No requests.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {myTimeOff.map((r, i) => {
                    const s = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                    const hasOverlap = vacRequestOverlapIds.has(r.id);
                    const label = showGrantAlert
                      ? (r.requester?.full_name || 'Unknown')
                      : r.leave_type;
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', background: hasOverlap ? '#FEF5F5' : undefined }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: hasOverlap ? '#E74C3C' : 'var(--text-primary)' }}>{label}</span>
                          <p style={{ margin: '1px 0 0', fontSize: '11px', color: hasOverlap ? '#E74C3C' : 'var(--text-muted)' }}>
                            {formatDate(r.start_date)}{r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          {hasOverlap && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#E74C3C', background: '#FDEDEC', padding: '1px 5px', borderRadius: 6, border: '1px solid #F1948A' }}>OVERLAP</span>
                          )}
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.text }}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

          </div>
          </div>

          {/* ══ LAB DASHBOARD ══ */}
          <div style={{ flex: 1, minWidth: 0, order: 1, background: '#F0F4FF', border: '1px solid #D8E0F5', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#3B5BDB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px', paddingLeft: '10px', borderLeft: '3px solid #3B5BDB', lineHeight: 1.2, margin: '0 0 16px' }}>Lab Dashboard</h2>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>

              {/* ── LEFT column ── */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Out today */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Palmtree size={13} color="#F39C12" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Out today</span>
                  </div>
                  {outToday.length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Everyone is in today.</p>
                  ) : (
                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {outToday.map(r => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.requester?.full_name}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {formatDate(r.start_date)}{r.start_date !== r.end_date ? `–${formatDate(r.end_date)}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Out next 8 weeks — overlapping periods flagged in red */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Calendar size={13} color="var(--purple-primary)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Out next 8 weeks</span>
                  </div>
                  {nextWeekOut.length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No one out in the next 8 weeks.</p>
                  ) : (
                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {nextWeekOut.map(r => {
                        const hasOverlap = vacOverlapIds.has(r.id);
                        return (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: hasOverlap ? '#E74C3C' : 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.requester?.full_name}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                              {hasOverlap && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#E74C3C', background: '#FDEDEC', padding: '1px 5px', borderRadius: 6, border: '1px solid #F1948A' }}>OVERLAP</span>
                              )}
                              <span style={{ fontSize: '11px', color: hasOverlap ? '#E74C3C' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {formatDate(r.start_date)}{r.start_date !== r.end_date ? `–${formatDate(r.end_date)}` : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Upcoming lab meetings */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Calendar size={13} color="var(--purple-primary)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Upcoming lab meetings</span>
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
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {m.presenter?.full_name || m.guest_name || <em>TBD</em>}
                            </div>
                          </div>
                          {m.is_sof && (
                            <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: 700, background: 'var(--purple-faint)', color: 'var(--purple-primary)', flexShrink: 0 }}>SOF</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming ad hoc meetings */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Calendar size={13} color="var(--purple-primary)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Upcoming ad hoc meetings</span>
                  </div>
                  {adhocMeetings.length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>None scheduled.</p>
                  ) : (
                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {adhocMeetings.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {new Date(m.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                              {m.is_sof && <Star size={10} color="#7B3FA0" fill="#7B3FA0" />}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {m.presenter?.full_name || m.guest_name || <em>TBD</em>}
                            </div>
                          </div>
                          {m.is_sof && (
                            <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: 700, background: 'var(--purple-faint)', color: 'var(--purple-primary)', flexShrink: 0 }}>SOF</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* ── RIGHT column ── */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Recurrent lab task productivity */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <ClipboardList size={13} color="var(--purple-primary)" />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Recurrent lab task productivity</span>
                    </div>
                    <PeriodPicker value={recurPeriod} onChange={setRecurPeriod} />
                  </div>
                  <div style={{ padding: '5px 14px', display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[['#27AE60', 'On time'], ['#F39C12', 'Late'], ['#E74C3C', 'Missed'], ['#D0D0D8', 'Pending']].map(([color, label]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>% tasks completed on time</span>
                  </div>
                  {recurLoading ? (
                    <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
                  ) : (
                    <div style={{ padding: '4px 14px 8px' }}>
                      {recurData.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map(row => (
                        <RecurScoreRow key={row.profile.id} row={row} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Ad hoc task productivity */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <ClipboardList size={13} color="#27AE60" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Ad hoc task productivity</span>
                  </div>
                  <div style={{ padding: '5px 14px', display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    {[['#27AE60', 'Completed on time'], ['#F39C12', 'Due'], ['#E74C3C', 'Overdue']].map(([color, label]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                  {sortedAdhocTasks.length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No tasks.</p>
                  ) : (
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {sortedAdhocTasks.map((task, i) => {
                        const cls = classifyAdhocTask(task);
                        const statusColor = cls === 2 ? '#27AE60' : cls === 0 ? '#E74C3C' : '#F39C12';
                        const statusBg = cls === 2 ? '#EAF7F0' : cls === 0 ? '#FDEDEC' : '#FEF9E7';
                        const statusLabel = cls === 2 ? 'Done' : cls === 0 ? 'Overdue' : 'Due';
                        return (
                          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                            {task.assignee?.full_name && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{task.assignee.full_name.split(' ')[0]}</span>
                            )}
                            {task.due_date && (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{formatDate(task.due_date)}</span>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: statusBg, color: statusColor, flexShrink: 0, whiteSpace: 'nowrap' }}>{statusLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
}
