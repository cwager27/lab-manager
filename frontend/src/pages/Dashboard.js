import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Palmtree, Star, ClipboardList, AlertTriangle, Users, Mail, Phone, Plus, Pencil, Trash2, X, Check } from 'lucide-react';

const ROLE_LABELS = { admin: 'Supervisor', pm: 'Program Manager', member: 'Lab Member', intern: 'Intern', external: 'NYU Contact' };
const ROLE_COLORS = {
  admin:    { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  pm:       { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  member:   { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  intern:   { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
  external: { bg: '#F2F3F4', text: '#5D6D7E', border: '#CCD1D1' },
};

function getDisplayName(c) {
  if (c.first_name || c.last_name) return [c.first_name, c.last_name].filter(Boolean).join(' ');
  return c.full_name || '';
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

const FREQ_ORDER = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'];
const FREQ_COLORS = {
  daily:    { bg: '#EBF5FB', text: '#2980B9' },
  weekly:   { bg: '#EAF7F0', text: '#27AE60' },
  biweekly: { bg: '#FEF9E7', text: '#F39C12' },
  monthly:  { bg: '#F5EEF8', text: '#7B3FA0' },
  yearly:   { bg: '#FDEDEC', text: '#E74C3C' },
};

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
  const [adminContacts, setAdminContacts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Personal data
  const [myTimeOff, setMyTimeOff] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [taskFreq, setTaskFreq] = useState(null);
  const [grants, setGrants] = useState([]);

  // Admin task management
  const [members, setMembers] = useState([]);
  const [taskDefs, setTaskDefs] = useState([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignType, setAssignType] = useState('oneoff');
  const [assignForm, setAssignForm] = useState({ title: '', assignedTo: '', dueDate: '' });
  const [recurringForm, setRecurringForm] = useState({ taskId: '', assignedTo: '' });
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, [profile]);

  async function fetchAll() {
    if (!profile?.id) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sporQuery = canEdit
      ? supabase.from('sporadic_tasks')
          .select('*, assignee:profiles!sporadic_tasks_assigned_to_fkey(id, full_name), assigner:profiles!sporadic_tasks_assigned_by_fkey(full_name)')
          .in('status', ['pending', 'in_progress']).order('due_date')
      : supabase.from('sporadic_tasks')
          .select('*, assigner:profiles!sporadic_tasks_assigned_by_fkey(full_name)')
          .eq('assigned_to', profile.id).in('status', ['pending', 'in_progress']).order('due_date');

    const queries = [
      // vacation – all approved in next 30 days
      supabase.from('vacation_requests')
        .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name)')
        .eq('status', 'approved').lte('start_date', thirtyDays).gte('end_date', today).order('start_date'),
      // my own vacation requests
      supabase.from('vacation_requests')
        .select('*').eq('requested_by', profile.id).order('start_date', { ascending: false }),
      // meetings
      supabase.from('lab_meetings')
        .select('*, presenter:profiles!lab_meetings_presenter_id_fkey(full_name)')
        .eq('status', 'scheduled').gte('meeting_date', today).order('meeting_date').limit(2),
      supabase.from('adhoc_meetings')
        .select('*, presenter:profiles!adhoc_meetings_presenter_id_fkey(full_name)')
        .eq('status', 'scheduled').gte('meeting_date', today).order('meeting_date').limit(2),
      // tasks
      sporQuery,
      canEdit
        ? supabase.from('task_assignments')
            .select('*, task:tasks_definitions(title, frequency, category), assignee:profiles(id, full_name)')
            .eq('status', 'pending').order('task_id')
        : supabase.from('task_assignments')
            .select('*, task:tasks_definitions(title, frequency, category)')
            .eq('assigned_to', profile.id).eq('status', 'pending'),
      // contacts – always fetch both
      supabase.from('lab_contacts').select('*').eq('status', 'active').order('sort_order').order('last_name').order('first_name'),
      supabase.from('profiles').select('id, full_name, email, role').order('full_name'),
      // admin task mgmt helpers
      canEdit
        ? supabase.from('tasks_definitions').select('id, title, frequency').eq('is_active', true).order('frequency').order('title')
        : Promise.resolve({ data: [] }),
      // grants (for Mia and PM only)
      showGrantAlert
        ? supabase.from('grants').select('id, name, end_date, total_amount, remaining_balance')
        : Promise.resolve({ data: [] }),
    ];

    const [
      { data: vacData },
      { data: myVacData },
      { data: labData },
      { data: adhocData },
      { data: sporData },
      { data: assignData },
      { data: contactData },
      { data: memberData },
      { data: taskDefData },
      { data: grantData },
    ] = await Promise.all(queries);

    const allVac = vacData || [];
    setOutToday(allVac.filter(r => r.start_date <= today && r.end_date >= today));
    setNextWeekOut(allVac.filter(r => r.start_date > today && r.start_date <= nextWeek));
    setLabMeetings(labData || []);
    setAdhocMeetings(adhocData || []);
    setMyTimeOff(myVacData || []);
    setMyTasks(sporData || []);

    const assigns = assignData || [];
    setMyAssignments(assigns);
    const firstFreq = FREQ_ORDER.find(f => assigns.some(a => a.task?.frequency === f));
    setTaskFreq(prev => prev || firstFreq || null);

    // Split contacts: exclude profiles from admin contacts
    const profEmails = new Set((memberData || []).map(m => m.email?.toLowerCase()).filter(Boolean));
    setAdminContacts((contactData || []).filter(c => c.role === 'external'));
    setTeamMembers(memberData || []);
    setMembers(memberData || []);
    setTaskDefs(taskDefData || []);
    setGrants(grantData || []);
    setLoading(false);
  }

  async function handleAssignTask() {
    if (!assignForm.title.trim() || !assignForm.assignedTo || !assignForm.dueDate) return;
    setSaving(true);
    await supabase.from('sporadic_tasks').insert({
      title: assignForm.title.trim(),
      assigned_to: assignForm.assignedTo,
      assigned_by: profile.id,
      due_date: assignForm.dueDate,
      status: 'pending',
    });
    setAssignForm({ title: '', assignedTo: '', dueDate: '' });
    setShowAssignForm(false);
    setSaving(false);
    fetchAll();
  }

  async function handleSaveEdit(taskId) {
    setSaving(true);
    await supabase.from('sporadic_tasks').update({
      title: editForm.title,
      assigned_to: editForm.assignedTo,
      due_date: editForm.dueDate,
    }).eq('id', taskId);
    setEditingTask(null);
    setSaving(false);
    fetchAll();
  }

  async function handleDeleteTask(taskId) {
    await supabase.from('sporadic_tasks').delete().eq('id', taskId);
    fetchAll();
  }

  async function handleAssignRecurring() {
    if (!recurringForm.taskId || !recurringForm.assignedTo) return;
    setSaving(true);
    const { data: existing } = await supabase.from('task_assignments')
      .select('id').eq('task_id', recurringForm.taskId).eq('assigned_to', recurringForm.assignedTo).eq('status', 'pending').maybeSingle();
    if (!existing) {
      await supabase.from('task_assignments').insert({
        task_id: recurringForm.taskId,
        assigned_to: recurringForm.assignedTo,
        status: 'pending',
      });
    }
    setRecurringForm({ taskId: '', assignedTo: '' });
    setShowAssignForm(false);
    setSaving(false);
    fetchAll();
  }

  async function handleReassign(assignmentId) {
    if (!reassignTo) return;
    setSaving(true);
    await supabase.from('task_assignments').update({ assigned_to: reassignTo }).eq('id', assignmentId);
    setEditingAssignment(null);
    setReassignTo('');
    setSaving(false);
    fetchAll();
  }

  const today = new Date().toISOString().split('T')[0];
  const availableFreqs = FREQ_ORDER.filter(f => myAssignments.some(a => a.task?.frequency === f));
  const visibleAssignments = taskFreq
    ? myAssignments.filter(a => a.task?.frequency === taskFreq)
    : myAssignments;

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
          <div style={{ flex: 1, minWidth: 0, order: 2 }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Personal Dashboard</h2>
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

            {/* My Time Off */}
            <Card icon={<Palmtree size={13} color="#F39C12" />} title="My Time Off">
              {myTimeOff.length === 0 ? (
                <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No time off requests yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {myTimeOff.map((r, i) => {
                    const s = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.leave_type}</span>
                          <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {formatDate(r.start_date)}{r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                          </p>
                        </div>
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.text, flexShrink: 0 }}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* My Tasks */}
            <Card
              icon={<ClipboardList size={13} color="var(--purple-primary)" />}
              title={canEdit ? 'Tasks' : 'My Tasks'}
            >
              {/* Header controls */}
              <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {availableFreqs.map(f => {
                  const c = FREQ_COLORS[f];
                  const active = taskFreq === f;
                  const count = myAssignments.filter(a => a.task?.frequency === f).length;
                  return (
                    <button key={f} onClick={() => setTaskFreq(active ? null : f)} style={{
                      padding: '2px 8px', borderRadius: '10px', border: `1px solid ${active ? c.text : 'var(--border)'}`,
                      background: active ? c.bg : 'transparent', color: active ? c.text : 'var(--text-muted)',
                      fontSize: '11px', fontWeight: active ? 600 : 400, cursor: 'pointer',
                    }}>
                      {f.charAt(0).toUpperCase() + f.slice(1)} {count > 1 ? `(${count})` : ''}
                    </button>
                  );
                })}
                {canEdit && (
                  <button onClick={() => { setShowAssignForm(v => !v); setEditingTask(null); }} style={{
                    display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 9px',
                    borderRadius: '10px', border: '1px solid var(--purple-primary)',
                    background: showAssignForm ? 'var(--purple-faint)' : 'transparent',
                    color: 'var(--purple-primary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  }}>
                    <Plus size={11} /> Assign
                  </button>
                )}
              </div>

              {/* Inline assign form */}
              {canEdit && showAssignForm && (
                <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                    {['oneoff', 'recurring'].map(t => (
                      <button key={t} onClick={() => setAssignType(t)} style={{
                        padding: '3px 10px', borderRadius: '10px', border: `1px solid ${assignType === t ? 'var(--purple-primary)' : 'var(--border)'}`,
                        background: assignType === t ? 'var(--purple-faint)' : 'transparent',
                        color: assignType === t ? 'var(--purple-primary)' : 'var(--text-muted)',
                        fontSize: '11px', fontWeight: assignType === t ? 600 : 400, cursor: 'pointer',
                      }}>
                        {t === 'oneoff' ? 'One-off' : 'Recurring'}
                      </button>
                    ))}
                  </div>
                  {assignType === 'oneoff' ? (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input placeholder="Task title" value={assignForm.title} onChange={e => setAssignForm(p => ({ ...p, title: e.target.value }))}
                        style={{ flex: '2 1 150px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                      <select value={assignForm.assignedTo} onChange={e => setAssignForm(p => ({ ...p, assignedTo: e.target.value }))}
                        style={{ flex: '1 1 130px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        <option value="">Assign to…</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                      </select>
                      <input type="date" value={assignForm.dueDate} onChange={e => setAssignForm(p => ({ ...p, dueDate: e.target.value }))}
                        style={{ flex: '1 1 120px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                      <button onClick={handleAssignTask} disabled={saving || !assignForm.title.trim() || !assignForm.assignedTo || !assignForm.dueDate}
                        style={{ padding: '5px 11px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600, opacity: (saving || !assignForm.title.trim() || !assignForm.assignedTo || !assignForm.dueDate) ? 0.5 : 1 }}>Save</button>
                      <button onClick={() => setShowAssignForm(false)} style={{ padding: '5px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}><X size={12} /></button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select value={recurringForm.taskId} onChange={e => setRecurringForm(p => ({ ...p, taskId: e.target.value }))}
                        style={{ flex: '2 1 180px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        <option value="">Select recurring task…</option>
                        {taskDefs.map(t => <option key={t.id} value={t.id}>{t.title} ({t.frequency})</option>)}
                      </select>
                      <select value={recurringForm.assignedTo} onChange={e => setRecurringForm(p => ({ ...p, assignedTo: e.target.value }))}
                        style={{ flex: '1 1 130px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        <option value="">Assign to…</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                      </select>
                      <button onClick={handleAssignRecurring} disabled={saving || !recurringForm.taskId || !recurringForm.assignedTo}
                        style={{ padding: '5px 11px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600, opacity: (saving || !recurringForm.taskId || !recurringForm.assignedTo) ? 0.5 : 1 }}>Assign</button>
                      <button onClick={() => setShowAssignForm(false)} style={{ padding: '5px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}><X size={12} /></button>
                    </div>
                  )}
                </div>
              )}

              {/* Task list */}
              <div style={{ padding: '6px 14px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {myTasks.map(task => {
                  const overdue = task.due_date && task.due_date < today;
                  const isEditing = editingTask === task.id;
                  return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      {isEditing ? (
                        <>
                          <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                            style={{ flex: '2 1 120px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                          <select value={editForm.assignedTo} onChange={e => setEditForm(p => ({ ...p, assignedTo: e.target.value }))}
                            style={{ flex: '1 1 110px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                            {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                          </select>
                          <input type="date" value={editForm.dueDate} onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))}
                            style={{ flex: '0 0 110px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                          <button onClick={() => handleSaveEdit(task.id)} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#27AE60', padding: '2px', display: 'flex' }}><Check size={13} /></button>
                          <button onClick={() => setEditingTask(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex' }}><X size={13} /></button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>{task.title}</span>
                          {canEdit && task.assignee?.full_name && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{task.assignee.full_name}</span>
                          )}
                          <span style={{ fontSize: '11px', color: overdue ? '#E74C3C' : 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{formatDate(task.due_date)}</span>
                          {overdue && <AlertTriangle size={11} color="#E74C3C" style={{ flexShrink: 0 }} />}
                          {canEdit && (
                            <>
                              <button onClick={() => { setEditingTask(task.id); setEditForm({ title: task.title, assignedTo: task.assigned_to, dueDate: task.due_date }); setShowAssignForm(false); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', flexShrink: 0 }}><Pencil size={11} /></button>
                              <button onClick={() => handleDeleteTask(task.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', flexShrink: 0 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#E74C3C'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}><Trash2 size={11} /></button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {myTasks.length > 0 && visibleAssignments.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                )}

                {visibleAssignments.length > 0 && (
                  <>
                    {myTasks.length > 0 && (
                      <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '2px 0 4px' }}>
                        {canEdit ? 'Recurring' : 'Your recurring'}
                      </p>
                    )}
                    {visibleAssignments.map(a => {
                      const overdue = a.cycle_end && a.cycle_end < today;
                      const c = FREQ_COLORS[a.task?.frequency];
                      const isReassigning = editingAssignment === a.id;
                      return (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 0' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>{a.task?.title || 'Task'}</span>
                          {isReassigning ? (
                            <>
                              <select value={reassignTo} onChange={e => setReassignTo(e.target.value)}
                                style={{ flex: '0 0 120px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                              </select>
                              <button onClick={() => handleReassign(a.id)} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#27AE60', padding: '2px', display: 'flex', flexShrink: 0 }}><Check size={13} /></button>
                              <button onClick={() => setEditingAssignment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', flexShrink: 0 }}><X size={13} /></button>
                            </>
                          ) : (
                            <>
                              {canEdit && a.assignee?.full_name && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{a.assignee.full_name}</span>
                              )}
                              {!taskFreq && c && (
                                <span style={{ padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, background: c.bg, color: c.text, flexShrink: 0 }}>{a.task?.frequency}</span>
                              )}
                              {overdue && <AlertTriangle size={11} color="#E74C3C" style={{ flexShrink: 0 }} />}
                              {canEdit && (
                                <button onClick={() => { setEditingAssignment(a.id); setReassignTo(a.assigned_to); setEditingTask(null); setShowAssignForm(false); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', flexShrink: 0 }}><Pencil size={11} /></button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {myTasks.length === 0 && visibleAssignments.length === 0 && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '6px 0', padding: '2px 0' }}>
                    {taskFreq ? `No ${taskFreq} tasks assigned.` : canEdit ? 'No pending tasks.' : 'No tasks assigned to you right now.'}
                  </p>
                )}
              </div>
            </Card>
          </div>
          </div>

          {/* ══ LAB DASHBOARD ══ */}
          <div style={{ flex: 1, minWidth: 0, order: 1 }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Lab Dashboard</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Row: Out today + Next week out + Meetings */}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

              {/* Out of Office Today */}
              <div style={{ flex: '1 1 200px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Palmtree size={13} color="#F39C12" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Out of Office Today</span>
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

              {/* Next Week Out */}
              <div style={{ flex: '1 1 200px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Calendar size={13} color="var(--purple-primary)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Out Next Week</span>
                </div>
                {nextWeekOut.length === 0 ? (
                  <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No one out next week.</p>
                ) : (
                  <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {nextWeekOut.map(r => (
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

              {/* Next Lab Meeting + Next Ad-hoc Meeting */}
              {[
                { label: 'Next Lab Meeting', meetings: labMeetings },
                { label: 'Next Ad-hoc Meeting', meetings: adhocMeetings },
              ].map(({ label, meetings }) => (
                <div key={label} style={{ flex: '1 1 160px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Calendar size={13} color="var(--purple-primary)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
                  </div>
                  {meetings.length === 0 ? (
                    <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>None scheduled.</p>
                  ) : (
                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {meetings.map(m => (
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
              ))}
            </div>

            {/* Admin Contacts (lab_contacts) */}
            {adminContacts.length > 0 && (
              <Card icon={<Users size={13} color="var(--purple-primary)" />} title="Admin Contacts">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {adminContacts.map((contact, i) => {
                    const name = getDisplayName(contact);
                    const colors = ROLE_COLORS[contact.role] || ROLE_COLORS.member;
                    return (
                      <div key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: colors.text }}>{name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                            {contact.title && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{contact.title}</span>}
                          </div>
                          {contact.notes && <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{contact.notes}</p>}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center' }}>
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--purple-primary)', textDecoration: 'none' }}>
                              <Mail size={11} /> {contact.email}
                            </a>
                          )}
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                              <Phone size={11} /> {contact.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

          </div>
          </div>

        </div>
      )}
    </div>
  );
}
