import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { SEED_TASKS } from '../data/seedTasks';
import {
  getMaintCycleKey, getMaintNextDue, getMaintKey,
  isMaintSubDone, isMaintParentDone, isMaintFreqDone,
  EQUIPMENT_MAINTENANCE,
} from '../data/equipmentMaintenance';
import {
  Plus, Send, CheckCircle, XCircle, AlertTriangle,
  Upload, Clock, Search, User, Calendar, ChevronDown, Database
} from 'lucide-react';

const FREQ_COLORS = {
  daily:      { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  weekly:     { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  biweekly:   { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
  monthly:    { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  bimonthly:  { bg: '#FFF0E6', text: '#C0392B', border: '#E59866' },
  quarterly:  { bg: '#FDEBD0', text: '#D35400', border: '#F0B27A' },
  yearly:     { bg: '#FDEDEC', text: '#E74C3C', border: '#F1948A' },
};

const SPORADIC_STATUS = {
  requested:   { bg: '#F5EEF8', text: '#7B3FA0', label: 'Requested' },
  pending:     { bg: '#FEF9E7', text: '#F39C12', label: 'Pending' },
  in_progress: { bg: '#EBF5FB', text: '#2980B9', label: 'In Progress' },
  submitted:   { bg: '#EAF7F0', text: '#27AE60', label: 'Completed' },
  overdue:     { bg: '#FDEDEC', text: '#E74C3C', label: 'Overdue' },
  denied:      { bg: '#FDEDEC', text: '#E74C3C', label: 'Denied' },
};

const ALL_FREQS = ['daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'yearly'];

const EMPTY_RECURRING = { title: '', category: 'MISC', frequency: 'daily', response_type: 'yes_no', sop_trigger: false, conditional_text: '', group_name: '', sort_order: 0 };
const EMPTY_SPORADIC = { title: '', description: '', category: 'MISC', assigned_to: '', due_date: '', response_type: 'yes_no' };

function isOverdue(dueDate, status) {
  return status !== 'submitted' && status !== 'denied' && dueDate < new Date().toISOString().split('T')[0];
}

function getCycleEnd(start, frequency) {
  const d = new Date(start);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'biweekly') d.setDate(d.getDate() + 14);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'bimonthly') d.setMonth(d.getMonth() + 2);
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}


export default function Tasks({ userRole, userId, profile }) {
  const canManage = userRole === 'admin' || userRole === 'pm';

  // shared
  const [tab, setTab] = useState('recurring');
  const [members, setMembers] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [loading, setLoading] = useState(true);

  // recurring
  const [recurTasks, setRecurTasks] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [existingResponses, setExistingResponses] = useState({});
  const [responses, setResponses] = useState({});
  const [recurCategory, setRecurCategory] = useState('MISC');
  const [recurFreq, setRecurFreq] = useState('daily');
  const [recurSearch, setRecurSearch] = useState('');
  const [cycleStart, setCycleStart] = useState(new Date().toISOString().split('T')[0]);
  const [assignments, setAssignments] = useState({});   // { [taskId]: [{type,id?,name,email}] }
  const [otherInputs, setOtherInputs] = useState({});   // { [taskId]: {show,name,email} }
  const [vacWarn, setVacWarn] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showRecurForm, setShowRecurForm] = useState(false);
  const [newRecur, setNewRecur] = useState(EMPTY_RECURRING);
  const [sendingAssign, setSendingAssign] = useState(false);
  const [assignSent, setAssignSent] = useState(false);
  const [assignAllOther, setAssignAllOther] = useState({ show: false, name: '', email: '' });
  const [hiddenAssignAll, setHiddenAssignAll] = useState(new Set());
  const [seeding, setSeeding] = useState(false);

  // sporadic
  const [sporTasks, setSporTasks] = useState([]);
  const [sporFilter, setSporFilter] = useState('all');
  const [sporResponses, setSporResponses] = useState({});
  const [showSporForm, setShowSporForm] = useState(false);
  const [newSpor, setNewSpor] = useState(EMPTY_SPORADIC);
  const [labContacts, setLabContacts] = useState([]);

  // equipment maintenance
  const [maintChecks, setMaintChecks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lab_maint_checks') || '{}'); }
    catch { return {}; }
  });
  const [maintCompleted, setMaintCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lab_maint_completed') || '{}'); }
    catch { return {}; }
  });
  const [expandedEquip, setExpandedEquip] = useState(
    () => new Set(EQUIPMENT_MAINTENANCE.map(e => e.id))
  );
  const [expandedFreq, setExpandedFreq] = useState(
    () => new Set(EQUIPMENT_MAINTENANCE.flatMap(e => e.frequencies.map(f => `${e.id}|${f.id}`)))
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [
      { data: taskData },
      { data: assignData },
      { data: respData },
      { data: sporData },
      { data: memberData },
      { data: vacData },
      { data: contactData },
    ] = await Promise.all([
      supabase.from('tasks_definitions').select('*').eq('status', 'published').order('category').order('frequency').order('sort_order'),
      supabase.from('task_assignments').select('*').eq('assigned_to', userId).eq('status', 'pending'),
      supabase.from('task_responses').select('*, assignment:task_assignments(assigned_to, profile:profiles(full_name))').order('responded_at', { ascending: false }),
      (() => {
        let q = supabase.from('sporadic_tasks')
          .select('*, assignee:profiles!sporadic_tasks_assigned_to_fkey(full_name, email), assigner:profiles!sporadic_tasks_assigned_by_fkey(full_name)')
          .order('due_date');
        if (!canManage) q = q.or(`assigned_to.eq.${userId},assigned_by.eq.${userId}`);
        return q;
      })(),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('vacation_requests').select('*').eq('status', 'approved'),
      supabase.from('lab_contacts').select('id, full_name, email, phone, title').order('full_name'),
    ]);

    const respMap = {};
    for (const r of (respData || [])) {
      if (!respMap[r.task_definition_id]) respMap[r.task_definition_id] = r;
    }

    setRecurTasks(taskData || []);
    setMyAssignments(assignData || []);
    setExistingResponses(respMap);
    setSporTasks(sporData || []);
    setMembers(memberData || []);
    setVacations(vacData || []);
    setLabContacts(contactData || []);
    setLoading(false);
  }, [userId, canManage]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    localStorage.setItem('lab_maint_checks', JSON.stringify(maintChecks));
    // auto-record completions
    const updated = { ...maintCompleted };
    let changed = false;
    EQUIPMENT_MAINTENANCE.forEach(equip => {
      equip.frequencies.forEach(freq => {
        const key = `${equip.id}|${freq.id}`;
        const cycleKey = getMaintCycleKey(freq.resetFreq);
        if (updated[key]?.cycleKey === cycleKey) return;
        if (isMaintFreqDone(maintChecks, equip, freq)) {
          updated[key] = { cycleKey, completedAt: new Date().toISOString() };
          changed = true;
        }
      });
    });
    if (changed) {
      setMaintCompleted(updated);
      localStorage.setItem('lab_maint_completed', JSON.stringify(updated));
    }
  }, [maintChecks]); // eslint-disable-line

  function toggleMaintCheck(equipId, freqId, resetFreq, parentId, subId, value) {
    const key = getMaintKey(equipId, freqId, resetFreq, parentId, subId);
    setMaintChecks(p => ({ ...p, [key]: p[key] === value ? null : value }));
  }

  // ── Recurring helpers ──────────────────────────────────────────────

  function getVacConflict(memberId, freq, startDate, endDate) {
    const memberVacs = vacations.filter(v => v.requested_by === memberId);
    for (const vac of memberVacs) {
      const vacStart = new Date(vac.start_date), vacEnd = new Date(vac.end_date);
      const tStart = new Date(startDate), tEnd = new Date(endDate);
      if (vacStart <= tEnd && vacEnd >= tStart) {
        if (freq === 'daily') return { type: 'block', vacStart: vac.start_date, vacEnd: vac.end_date };
        const oStart = vacStart > tStart ? vacStart : tStart;
        const oEnd = vacEnd < tEnd ? vacEnd : tEnd;
        const oDays = Math.ceil((oEnd - oStart) / 86400000) + 1;
        const tDays = Math.ceil((tEnd - tStart) / 86400000) + 1;
        return oDays >= tDays
          ? { type: 'block', vacStart: vac.start_date, vacEnd: vac.end_date }
          : { type: 'warn', vacStart: vac.start_date, vacEnd: vac.end_date };
      }
    }
    return null;
  }

  function addMemberAssignee(taskId, memberId) {
    if (memberId === '__other__') {
      setOtherInputs(p => ({ ...p, [taskId]: { show: true, name: '', email: '' } }));
      return;
    }
    const m = members.find(m => m.id === memberId);
    if (!m) return;
    const task = recurTasks.find(t => t.id === taskId);
    const cycleEnd = getCycleEnd(cycleStart, task?.frequency);
    const conflict = getVacConflict(memberId, task?.frequency, cycleStart, cycleEnd);
    if (conflict?.type === 'block') {
      alert(`${m.full_name} is on vacation ${conflict.vacStart}–${conflict.vacEnd}. Choose someone else.`);
      return;
    }
    if (conflict?.type === 'warn') setVacWarn(p => ({ ...p, [taskId]: conflict }));
    setAssignments(p => {
      const current = p[taskId] || [];
      if (current.some(a => a.id === memberId)) return p;
      return { ...p, [taskId]: [...current, { type: 'member', id: memberId, name: m.full_name, email: m.email }] };
    });
  }

  function addOtherAssignee(taskId) {
    const inp = otherInputs[taskId];
    if (!inp?.name?.trim()) { alert('Please enter a name.'); return; }
    setAssignments(p => {
      const current = p[taskId] || [];
      return { ...p, [taskId]: [...current, { type: 'other', name: inp.name.trim(), email: inp.email?.trim() || '' }] };
    });
    setOtherInputs(p => ({ ...p, [taskId]: { show: false, name: '', email: '' } }));
  }

  function removeAssignee(taskId, index) {
    setAssignments(p => ({ ...p, [taskId]: (p[taskId] || []).filter((_, i) => i !== index) }));
  }

  function assignAllTo(memberId) {
    const m = members.find(m => m.id === memberId);
    if (!m) return;
    const filtered = recurTasks.filter(t => t.frequency === recurFreq && t.category === recurCategory);
    const next = {};
    filtered.forEach(t => { next[t.id] = [{ type: 'member', id: memberId, name: m.full_name, email: m.email }]; });
    setAssignments(p => ({ ...p, ...next }));
  }

  function assignAllToOther() {
    if (!assignAllOther.name.trim()) { alert('Please enter a name.'); return; }
    const filtered = recurTasks.filter(t => t.frequency === recurFreq && t.category === recurCategory);
    const next = {};
    filtered.forEach(t => { next[t.id] = [{ type: 'other', name: assignAllOther.name.trim(), email: assignAllOther.email.trim() }]; });
    setAssignments(p => ({ ...p, ...next }));
    setAssignAllOther({ show: false, name: '', email: '' });
  }

  function handleResponse(taskId, value) {
    setResponses(p => ({ ...p, [taskId]: { ...p[taskId], response: value } }));
  }

  function handleNotes(taskId, value) {
    setResponses(p => ({ ...p, [taskId]: { ...p[taskId], notes: value } }));
  }

  function handleConditionalCheck(taskId, item, checked) {
    setResponses(p => {
      const current = p[taskId]?.conditional_checks || [];
      const updated = checked ? [...current, item] : current.filter(i => i !== item);
      return { ...p, [taskId]: { ...p[taskId], conditional_checks: updated } };
    });
  }

  async function handleSendAssignments() {
    const filtered = recurTasks.filter(t => t.frequency === recurFreq && t.category === recurCategory);
    const toAssign = filtered.filter(t => (assignments[t.id] || []).length > 0);
    if (!toAssign.length) return;
    setSendingAssign(true);
    const cycleEnd = getCycleEnd(cycleStart, recurFreq);
    const emailAssignments = [];
    for (const task of toAssign) {
      for (const assignee of (assignments[task.id] || [])) {
        if (assignee.type === 'member') {
          await supabase.from('task_assignments').insert([{
            task_definition_id: task.id, assigned_to: assignee.id,
            assigned_by: userId, cycle_start: cycleStart, cycle_end: cycleEnd, status: 'pending',
          }]);
        }
        if (assignee.email) {
          emailAssignments.push({ memberId: assignee.id || null, memberEmail: assignee.email, memberName: assignee.name, taskTitle: task.title });
        }
      }
    }
    if (emailAssignments.length > 0) {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/send-assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: emailAssignments, cycleStart, cycleEnd, assignedBy: userId }),
      });
    }
    setAssignSent(true);
    setAssignments({});
    setTimeout(() => setAssignSent(false), 4000);
    setSendingAssign(false);
    fetchAll();
  }

  async function handlePhotoUpload(taskId, file, isSop = false) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `sop-photos/${taskId}/${Date.now()}-${safeName}`;
    const { data, error } = await supabase.storage.from('lab-files').upload(path, file);
    if (error || !data) return;
    const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
    setResponses(p => ({ ...p, [taskId]: { ...p[taskId], [isSop ? 'sop_photo_url' : 'photo_url']: urlData.publicUrl } }));
    if (isSop) {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/sop-alert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskTitle: recurTasks.find(t => t.id === taskId)?.title, photoUrl: urlData.publicUrl, submittedByName: profile?.full_name, submittedByEmail: profile?.email }),
      });
    }
  }

  async function handleSubmitChecklist() {
    const assignment = myAssignments.find(a => visibleRecurTasks.some(t => t.id === a.task_definition_id));
    const responseArray = visibleRecurTasks.map(task => ({
      taskId: task.id, taskTitle: task.title,
      response: responses[task.id]?.response || '',
      notes: responses[task.id]?.notes || '',
      photoUrl: responses[task.id]?.photo_url || '',
      sopPhotoUrl: responses[task.id]?.sop_photo_url || '',
      conditionalResponse: responses[task.id]?.conditional_checks?.length
        ? JSON.stringify(responses[task.id].conditional_checks)
        : null,
    }));
    setSubmitting(true);
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/submit-checklist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: assignment?.id || null, responses: responseArray, submittedBy: userId, submittedByName: profile?.full_name, cycleStart: new Date().toISOString().split('T')[0] }),
    });
    const data = await res.json();
    if (data.success) { setSubmitted(true); setResponses({}); setTimeout(() => setSubmitted(false), 4000); }
    setSubmitting(false);
  }

  async function handleAddRecurring(e) {
    e.preventDefault();
    await supabase.from('tasks_definitions').insert([{ ...newRecur, status: 'published', created_by: userId }]);
    setShowRecurForm(false);
    setNewRecur(EMPTY_RECURRING);
    fetchAll();
  }

  async function handleSaveEdit(taskId) {
    await supabase.from('tasks_definitions').update({ ...editingTask }).eq('id', taskId);
    setEditingId(null); setEditingTask(null);
    fetchAll();
  }

  async function handleDeactivate(taskId) {
    if (window.confirm('Deactivate this task? It will no longer appear in checklists.')) {
      await supabase.from('tasks_definitions').update({ status: 'unpublished' }).eq('id', taskId);
      fetchAll();
    }
  }

  async function handleSeedTasks() {
    if (!window.confirm(`Seed ${SEED_TASKS.length} tasks from the PM project document? Duplicates (same title + category + frequency) will be skipped.`)) return;
    setSeeding(true);
    const { data: existing } = await supabase.from('tasks_definitions').select('title, category, frequency');
    const existingSet = new Set((existing || []).map(t => `${t.title}|${t.category}|${t.frequency}`));
    const toInsert = SEED_TASKS.filter(t => !existingSet.has(`${t.title}|${t.category}|${t.frequency}`));
    if (toInsert.length === 0) {
      alert('All tasks already exist — nothing new to seed.');
      setSeeding(false);
      return;
    }
    for (let i = 0; i < toInsert.length; i += 50) {
      const chunk = toInsert.slice(i, i + 50);
      await supabase.from('tasks_definitions').insert(chunk.map(t => ({ ...t, status: 'published', created_by: userId })));
    }
    alert(`Seeded ${toInsert.length} tasks successfully.`);
    setSeeding(false);
    fetchAll();
  }

  const assignedIds = new Set(myAssignments.map(a => a.task_definition_id));

  const visibleRecurTasks = recurTasks.filter(t =>
    t.frequency === recurFreq && t.category === recurCategory &&
    (recurSearch === '' || t.title.toLowerCase().includes(recurSearch.toLowerCase())) &&
    (canManage || assignedIds.has(t.id))
  );

  // Group by group_name preserving sort_order
  const visibleGroups = (() => {
    const map = new Map();
    for (const task of visibleRecurTasks) {
      const key = task.group_name || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    }
    return [...map.entries()];
  })();

  const completedCount = visibleRecurTasks.filter(t => responses[t.id]?.response).length;
  const assignedCount = visibleRecurTasks.filter(t => (assignments[t.id] || []).length > 0).length;

  // ── Sporadic helpers ────────────────────────────────────────────────

  async function handleCreateSporadic(e) {
    e.preventDefault();
    const status = canManage ? 'pending' : 'requested';
    const { data, error } = await supabase.from('sporadic_tasks')
      .insert([{ ...newSpor, assigned_by: userId, status }])
      .select('*, assignee:profiles!sporadic_tasks_assigned_to_fkey(full_name, email)').single();
    if (!error && data) {
      if (canManage && data.assignee) {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/send-sporadic-assignment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskTitle: data.title, taskDescription: data.description, category: data.category, dueDate: data.due_date, memberEmail: data.assignee.email, memberName: data.assignee.full_name, assignedByName: profile?.full_name }),
        });
      }
      setShowSporForm(false); setNewSpor(EMPTY_SPORADIC); fetchAll();
    }
  }

  async function handleApproveSporadic(task) {
    await supabase.from('sporadic_tasks').update({ status: 'pending' }).eq('id', task.id);
    const member = members.find(m => m.id === task.assigned_to);
    if (member) {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/send-sporadic-assignment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskTitle: task.title, taskDescription: task.description, category: task.category, dueDate: task.due_date, memberEmail: member.email, memberName: member.full_name, assignedByName: profile?.full_name }),
      });
    }
    fetchAll();
  }

  async function handleSporResponse(taskId, value) {
    setSporResponses(p => ({ ...p, [taskId]: { ...p[taskId], response: value } }));
    await supabase.from('sporadic_tasks').update({ status: 'in_progress' }).eq('id', taskId);
  }

  function handleSporNotes(taskId, value) {
    setSporResponses(p => ({ ...p, [taskId]: { ...p[taskId], notes: value } }));
  }

  async function handleSubmitSporadic(task) {
    const response = sporResponses[task.id];
    if (!response?.response) { alert('Please provide a response before submitting.'); return; }
    await supabase.from('sporadic_tasks').update({
      status: 'submitted',
      response: response.response,
      notes: response.notes || null,
      photo_url: response.photo_url || null,
      submitted_at: new Date().toISOString(),
    }).eq('id', task.id);
    await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/sporadic-submitted`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskTitle: task.title, memberName: profile?.full_name, response: response.response, assignedByName: task.assigner?.full_name }),
    });
    fetchAll();
  }

  async function handleSporPhoto(taskId, file) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `sporadic-photos/${taskId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('lab-files').upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
      setSporResponses(p => ({ ...p, [taskId]: { ...p[taskId], photo_url: urlData.publicUrl } }));
    }
  }

  const filteredSpor = sporTasks.filter(t => {
    if (sporFilter === 'requested') return t.status === 'requested';
    if (sporFilter === 'pending') return t.status === 'pending' || t.status === 'in_progress';
    if (sporFilter === 'completed') return t.status === 'submitted';
    if (sporFilter === 'overdue') return isOverdue(t.due_date, t.status);
    return true;
  });

  const overdueCount = sporTasks.filter(t => isOverdue(t.due_date, t.status)).length;
  const requestedCount = sporTasks.filter(t => t.status === 'requested').length;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Tasks</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Lab responsibilities and ad hoc assignments</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {canManage && (
            <button onClick={handleSeedTasks} disabled={seeding}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: seeding ? 'var(--border)' : 'var(--bg-primary)', color: seeding ? 'var(--text-muted)' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px' }}>
              <Database size={14} /> {seeding ? 'Seeding…' : 'Seed Tasks'}
            </button>
          )}
          {canManage && tab !== 'equipment' && (
            <button onClick={() => tab === 'recurring' ? setShowRecurForm(true) : setShowSporForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px' }}>
              <Plus size={16} /> {tab === 'recurring' ? 'Add Task' : 'New Ad hoc'}
            </button>
          )}
          {!canManage && tab === 'one-off' && (
            <button onClick={() => setShowSporForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px' }}>
              <Plus size={16} /> Request Task
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '3px', marginBottom: '20px', width: 'fit-content' }}>
        {[{ id: 'recurring', label: 'Recurrent' }, { id: 'one-off', label: 'Ad hoc Tasks' }, { id: 'equipment', label: 'Equipment' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 18px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: '13px', fontWeight: tab === t.id ? 600 : 400,
            background: tab === t.id ? 'var(--purple-primary)' : 'transparent',
            color: tab === t.id ? 'white' : 'var(--text-secondary)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─── RECURRING TAB ──────────────────────────────────────────── */}
      {tab === 'recurring' && (
        <>
          {submitted && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: '#EAF7F0', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-md)', color: '#27AE60', fontSize: '13px', marginBottom: '16px' }}>
              <CheckCircle size={14} /> Checklist submitted! The PM has been notified.
            </div>
          )}

          {/* Category + Frequency filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {['MISC', 'PM'].map(cat => (
                <button key={cat} onClick={() => setRecurCategory(cat)} style={{ padding: '8px 20px', background: recurCategory === cat ? 'var(--purple-primary)' : 'transparent', color: recurCategory === cat ? 'white' : 'var(--text-secondary)', border: 'none', fontWeight: 500, fontSize: '13px' }}>{cat}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {ALL_FREQS.map(freq => {
                const c = FREQ_COLORS[freq];
                const count = recurTasks.filter(t => t.frequency === freq && t.category === recurCategory && (canManage || assignedIds.has(t.id))).length;
                if (!canManage && count === 0) return null;
                return (
                  <button key={freq} onClick={() => setRecurFreq(freq)} style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${recurFreq === freq ? c.border : 'var(--border)'}`, background: recurFreq === freq ? c.bg : 'var(--bg-primary)', color: recurFreq === freq ? c.text : 'var(--text-secondary)', fontWeight: recurFreq === freq ? 600 : 400, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={12} />
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    <span style={{ background: recurFreq === freq ? c.text : 'var(--border)', color: recurFreq === freq ? 'white' : 'var(--text-muted)', borderRadius: '10px', padding: '0 6px', fontSize: '10px' }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PM controls: cycle date, assign-all, send */}
          {canManage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={13} color="var(--text-muted)" />
                <input type="date" value={cycleStart} onChange={e => setCycleStart(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', outline: 'none' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Assign all <span style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{recurFreq} — {recurCategory}</span> to:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {members.filter(m => !hiddenAssignAll.has(m.id)).map(m => (
                  <div key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <button onClick={() => assignAllTo(m.id)} style={{ padding: '5px 10px', border: 'none', background: 'var(--purple-faint)', color: 'var(--purple-primary)', fontSize: '12px', fontWeight: 500 }}>
                      {m.full_name}
                    </button>
                    <button onClick={() => setHiddenAssignAll(p => new Set([...p, m.id]))} title="Remove from list" style={{ padding: '5px 6px', border: 'none', borderLeft: '1px solid var(--border)', background: 'var(--purple-faint)', color: 'var(--purple-primary)', fontSize: '13px', lineHeight: 1, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
                {/* Re-add hidden members */}
                {hiddenAssignAll.size > 0 && (
                  <select onChange={e => { if (e.target.value) { setHiddenAssignAll(p => { const n = new Set(p); n.delete(e.target.value); return n; }); e.target.value = ''; } }}
                    style={{ padding: '5px 8px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', outline: 'none' }}>
                    <option value="">+ Add member…</option>
                    {members.filter(m => hiddenAssignAll.has(m.id)).map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                )}
                {!assignAllOther.show && (
                  <button onClick={() => setAssignAllOther(p => ({ ...p, show: true }))} style={{ padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500 }}>
                    + Other…
                  </button>
                )}
                {assignAllOther.show && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {labContacts.length > 0 && (
                      <select onChange={e => {
                        const c = labContacts.find(c => String(c.id) === e.target.value);
                        if (c) setAssignAllOther(p => ({ ...p, name: c.full_name || '', email: c.email || '' }));
                        e.target.value = '';
                      }} style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}>
                        <option value="">Select existing contact…</option>
                        {labContacts.map(c => <option key={c.id} value={c.id}>{c.full_name}{c.title ? ` — ${c.title}` : ''}</option>)}
                      </select>
                    )}
                    <input value={assignAllOther.name} onChange={e => setAssignAllOther(p => ({ ...p, name: e.target.value }))} placeholder="Name *" style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', outline: 'none', width: '120px' }} />
                    <input value={assignAllOther.email} onChange={e => setAssignAllOther(p => ({ ...p, email: e.target.value }))} placeholder="Email (optional)" style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', outline: 'none', width: '160px' }} />
                    <button onClick={assignAllToOther} style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '12px', fontWeight: 600 }}>Assign all</button>
                    <button onClick={() => setAssignAllOther({ show: false, name: '', email: '' })} style={{ padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px' }}>Cancel</button>
                  </div>
                )}
              </div>
              <button onClick={handleSendAssignments} disabled={sendingAssign || assignedCount === 0}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: assignSent ? '#27AE60' : assignedCount === 0 ? 'var(--border)' : 'var(--purple-primary)', color: assignedCount === 0 ? 'var(--text-muted)' : 'white', fontWeight: 600, fontSize: '12px' }}>
                {assignSent ? <CheckCircle size={13} /> : <Send size={13} />}
                {assignSent ? 'Sent!' : `Send${assignedCount > 0 ? ` (${assignedCount})` : ''}`}
              </button>
            </div>
          )}

          {/* Search + progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
              <Search size={14} color="var(--text-muted)" />
              <input value={recurSearch} onChange={e => setRecurSearch(e.target.value)} placeholder="Search tasks…" style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <CheckCircle size={13} color="var(--success)" />
              {completedCount} / {visibleRecurTasks.length}
            </div>
          </div>

          {visibleRecurTasks.length > 0 && (
            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(completedCount / visibleRecurTasks.length) * 100}%`, background: 'var(--purple-primary)', transition: 'width 0.3s' }} />
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading…</div>
          ) : visibleRecurTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
              {assignedIds.size === 0 && !canManage ? 'No tasks assigned to you in this section yet.' : 'No tasks found.'}
            </div>
          ) : (
            <>
              {visibleGroups.map(([groupName, tasks]) => {
                const fc = FREQ_COLORS[recurFreq] || FREQ_COLORS.monthly;
                const gateTask = tasks.find(t => t.conditional_text === 'on_yes');
                const gateIdx = gateTask ? tasks.indexOf(gateTask) : -1;
                const gateResp = gateTask ? responses[gateTask.id]?.response : null;
                return (
                <div key={groupName || 'ungrouped'} style={{ marginBottom: '12px' }}>
                  {groupName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0 8px', borderBottom: `2px solid ${fc.border}`, marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: fc.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{groupName}</span>
                      <span style={{ fontSize: '10px', color: fc.text, background: fc.bg, border: `1px solid ${fc.border}`, padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {tasks.map((task, taskIdx) => {
                    if (gateTask && taskIdx > gateIdx && gateResp !== 'yes') return null;
                    const resp = responses[task.id];
                    const isNo = resp?.response === 'no';
                    const done = resp?.response === 'yes' || resp?.response === 'checked';
                    const isEdit = editingId === task.id;

                    if (task.response_type === 'placeholder') {
                      return (
                        <div key={task.id} style={{ padding: '8px 14px', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                          Tasks to be defined.
                        </div>
                      );
                    }

                    return (
                      <div key={task.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '6px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px' }}>
                          {/* Response buttons */}
                          <div style={{ display: 'flex', gap: '5px', flexShrink: 0, marginTop: '2px' }}>
                            {(task.response_type === 'yes_no' || task.response_type === 'yes_no_na') ? (
                              <>
                                <button onClick={() => handleResponse(task.id, 'yes')} title="Yes" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid', borderColor: resp?.response === 'yes' ? 'var(--success)' : 'var(--border)', background: resp?.response === 'yes' ? 'var(--success)' : 'transparent', color: resp?.response === 'yes' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={13} /></button>
                                <button onClick={() => handleResponse(task.id, 'no')} title="No" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid', borderColor: resp?.response === 'no' ? 'var(--danger)' : 'var(--border)', background: resp?.response === 'no' ? 'var(--danger)' : 'transparent', color: resp?.response === 'no' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><XCircle size={13} /></button>
                                {task.response_type === 'yes_no_na' && <button onClick={() => handleResponse(task.id, 'na')} style={{ padding: '0 7px', height: '26px', borderRadius: '13px', border: '2px solid', borderColor: resp?.response === 'na' ? 'var(--text-muted)' : 'var(--border)', background: resp?.response === 'na' ? 'var(--text-muted)' : 'transparent', color: resp?.response === 'na' ? 'white' : 'var(--text-muted)', fontSize: '10px', fontWeight: 600 }}>N/A</button>}
                              </>
                            ) : task.response_type === 'checkbox' ? (
                              <button onClick={() => handleResponse(task.id, resp?.response === 'checked' ? '' : 'checked')} style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', border: '2px solid', borderColor: resp?.response === 'checked' ? 'var(--purple-primary)' : 'var(--border)', background: resp?.response === 'checked' ? 'var(--purple-primary)' : 'transparent', color: resp?.response === 'checked' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={13} /></button>
                            ) : (
                              <label style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <Upload size={13} />
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhotoUpload(task.id, e.target.files[0])} />
                              </label>
                            )}
                          </div>

                          {/* Title + meta + notes */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '13px', color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, margin: 0 }}>{task.title}</p>
                            {task.sop_trigger && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '3px', padding: '2px 7px', background: '#FEF0F0', color: 'var(--danger)', borderRadius: '12px', fontSize: '10px', fontWeight: 600 }}><AlertTriangle size={9} /> SOP</span>}
                            {existingResponses[task.id] && (
                              <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span style={{ color: 'var(--success)' }}>✓</span> Done by {existingResponses[task.id].assignment?.profile?.full_name || '?'} on {new Date(existingResponses[task.id].responded_at).toLocaleDateString()}
                              </div>
                            )}
                            {resp?.response && (
                              <textarea
                                value={resp?.notes || ''}
                                onChange={e => handleNotes(task.id, e.target.value)}
                                placeholder="Notes (optional)"
                                rows={1}
                                style={{ width: '100%', marginTop: '6px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', fontFamily: 'inherit' }}
                              />
                            )}
                          </div>

                          {/* PM: multi-assignee widget */}
                          {canManage && !isEdit && (
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              <button onClick={() => { setEditingId(task.id); setEditingTask({ ...task }); }} style={{ padding: '3px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}>Edit</button>
                              <button onClick={() => handleDeactivate(task.id)} style={{ padding: '3px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)' }}>Deactivate</button>
                            </div>
                          )}
                        </div>

                        {/* Assignees row — always visible to PM/admin */}
                        {canManage && !isEdit && (
                          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, paddingTop: '4px', flexShrink: 0 }}>Assignees:</span>
                            {/* Current tags */}
                            {(assignments[task.id] || []).map((a, i) => (
                              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px 2px 10px', background: 'var(--purple-faint)', border: '1px solid var(--purple-border)', borderRadius: '12px', fontSize: '11px', color: 'var(--purple-primary)' }}>
                                {a.name}{a.type === 'other' ? ' (ext)' : ''}
                                <button onClick={() => removeAssignee(task.id, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple-primary)', padding: '0 0 0 2px', fontSize: '14px', lineHeight: 1 }}>×</button>
                              </div>
                            ))}
                            {/* Add dropdown */}
                            <div style={{ position: 'relative' }}>
                              <select value="" onChange={e => { addMemberAssignee(task.id, e.target.value); e.target.value = ''; }}
                                style={{ padding: '3px 24px 3px 8px', border: '1px dashed var(--border)', borderRadius: '12px', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                                <option value="">+ Add person…</option>
                                {members.filter(m => !(assignments[task.id] || []).some(a => a.id === m.id)).map(m => (
                                  <option key={m.id} value={m.id}>{m.full_name}</option>
                                ))}
                                <option value="__other__">Other (name & email)…</option>
                              </select>
                              <ChevronDown size={11} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                            </div>
                            {/* Other inline form */}
                            {otherInputs[task.id]?.show && (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {labContacts.length > 0 && (
                                  <select onChange={e => {
                                    const c = labContacts.find(c => String(c.id) === e.target.value);
                                    if (c) setOtherInputs(p => ({ ...p, [task.id]: { ...p[task.id], name: c.full_name || '', email: c.email || '' } }));
                                    e.target.value = '';
                                  }} style={{ padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '11px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}>
                                    <option value="">Select existing contact…</option>
                                    {labContacts.map(c => <option key={c.id} value={c.id}>{c.full_name}{c.title ? ` — ${c.title}` : ''}</option>)}
                                  </select>
                                )}
                                <input value={otherInputs[task.id]?.name || ''} onChange={e => setOtherInputs(p => ({ ...p, [task.id]: { ...p[task.id], name: e.target.value } }))} placeholder="Name *" style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '11px', outline: 'none', width: '110px' }} />
                                <input value={otherInputs[task.id]?.email || ''} onChange={e => setOtherInputs(p => ({ ...p, [task.id]: { ...p[task.id], email: e.target.value } }))} placeholder="Email (optional)" style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '11px', outline: 'none', width: '150px' }} />
                                <button onClick={() => addOtherAssignee(task.id)} style={{ padding: '3px 10px', fontSize: '11px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600 }}>Add</button>
                                <button onClick={() => setOtherInputs(p => ({ ...p, [task.id]: { show: false } }))} style={{ padding: '3px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}>Cancel</button>
                              </div>
                            )}
                            {vacWarn[task.id] && <span style={{ fontSize: '10px', color: '#F39C12', paddingTop: '4px' }}>⚠ On vacation {vacWarn[task.id].vacStart}–{vacWarn[task.id].vacEnd}</span>}
                          </div>
                        )}

                        {/* Inline edit */}
                        {isEdit && editingTask && (
                          <div style={{ margin: '0 14px 12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--purple-border)' }}>
                            <textarea value={editingTask.title} onChange={e => setEditingTask(p => ({ ...p, title: e.target.value }))} rows={2} style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                              {[
                                { key: 'category', opts: ['MISC', 'PM'] },
                                { key: 'frequency', opts: ALL_FREQS },
                                { key: 'response_type', opts: ['yes_no', 'yes_no_na', 'checkbox', 'photo'] },
                              ].map(({ key, opts }) => (
                                <select key={key} value={editingTask[key]} onChange={e => setEditingTask(p => ({ ...p, [key]: e.target.value }))}
                                  style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ))}
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                <input type="checkbox" checked={editingTask.sop_trigger} onChange={e => setEditingTask(p => ({ ...p, sop_trigger: e.target.checked }))} /> SOP
                              </label>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                              <input value={editingTask.group_name || ''} onChange={e => setEditingTask(p => ({ ...p, group_name: e.target.value }))} placeholder="Section / Audit Area" style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', outline: 'none' }} />
                              <input type="number" value={editingTask.sort_order || 0} onChange={e => setEditingTask(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} placeholder="Order" style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleSaveEdit(task.id)} style={{ padding: '5px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '12px', fontWeight: 600 }}>Save</button>
                              <button onClick={() => { setEditingId(null); setEditingTask(null); }} style={{ padding: '5px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px' }}>Cancel</button>
                            </div>
                          </div>
                        )}

                        {/* SOP conditional panel */}
                        {isNo && task.sop_trigger && task.conditional_text && (
                          <div style={{ padding: '10px 14px', background: '#FEF0F0', borderTop: '1px solid #FADBD8' }}>
                            <p style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 500, marginBottom: '8px' }}><AlertTriangle size={11} style={{ marginRight: '5px', verticalAlign: 'middle' }} />{task.conditional_text}</p>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'white', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer' }}>
                              <Upload size={11} /> Upload Photo
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhotoUpload(task.id, e.target.files[0], true)} />
                            </label>
                            {resp?.sop_photo_url && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--success)' }}>Photo uploaded</span>}
                          </div>
                        )}
                        {task.sub_items?.length > 0 && (() => {
                          const subOnYes = task.conditional_text === 'on_yes';
                          const showSub = subOnYes ? resp?.response === 'yes' : resp?.response === 'no';
                          if (!showSub) return null;
                          return (
                            <div style={{ padding: '10px 14px', background: '#FFF8F0', borderTop: '1px solid #FAD7A0' }}>
                              <p style={{ fontSize: '11px', fontWeight: 600, color: '#D35400', marginBottom: '8px' }}>
                                {subOnYes ? 'Confirm all steps were completed:' : 'Check all that apply (at least one required):'}
                              </p>
                              {task.sub_items.map((item, i) => (
                                <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={resp?.conditional_checks?.includes(item) || false}
                                    onChange={e => handleConditionalCheck(task.id, item, e.target.checked)}
                                    style={{ marginTop: '2px', accentColor: '#D35400', flexShrink: 0 }}
                                  />
                                  <span style={{ fontSize: '12px', color: '#1A1A2E', lineHeight: 1.4 }}>{item}</span>
                                </label>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              );})}

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleSubmitChecklist} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 22px', background: submitted ? 'var(--success)' : 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '14px' }}>
                  {submitted ? <CheckCircle size={15} /> : <Send size={15} />}
                  {submitting ? 'Submitting…' : submitted ? 'Submitted!' : 'Submit Checklist'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ─── ONE-OFF TAB ─────────────────────────────────────────────── */}
      {tab === 'one-off' && (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Total', value: sporTasks.length, color: 'var(--purple-primary)', bg: 'var(--purple-faint)' },
              { label: 'Pending', value: sporTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length, color: '#2980B9', bg: '#EBF5FB' },
              { label: 'Completed', value: sporTasks.filter(t => t.status === 'submitted').length, color: '#27AE60', bg: '#EAF7F0' },
              { label: 'Overdue', value: overdueCount, color: '#E74C3C', bg: '#FDEDEC' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '12px', color: s.color }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'requested', label: `Requests${requestedCount > 0 ? ` (${requestedCount})` : ''}` },
              { id: 'pending', label: 'Pending' },
              { id: 'completed', label: 'Completed' },
              { id: 'overdue', label: `Overdue${overdueCount > 0 ? ` (${overdueCount})` : ''}` },
            ].map(f => (
              <button key={f.id} onClick={() => setSporFilter(f.id)} style={{ padding: '6px 13px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: sporFilter === f.id ? 'var(--purple-primary)' : 'var(--bg-primary)', color: sporFilter === f.id ? 'white' : 'var(--text-secondary)', fontWeight: sporFilter === f.id ? 600 : 400, fontSize: '12px' }}>{f.label}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading…</div>
          ) : filteredSpor.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>No tasks found.</div>
          ) : filteredSpor.map(task => {
            const overdue = isOverdue(task.due_date, task.status);
            const statusStyle = SPORADIC_STATUS[overdue ? 'overdue' : task.status] || SPORADIC_STATUS.pending;
            const resp = sporResponses[task.id];
            const isAssigned = task.assigned_to === userId;

            return (
              <div key={task.id} style={{ background: 'var(--bg-card)', border: `1px solid ${overdue ? '#FADBD8' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '10px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{task.title}</h3>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text }}>{statusStyle.label}</span>
                    </div>
                    {task.description && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>{task.description}</p>}
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: overdue ? 'var(--danger)' : 'var(--text-muted)' }}><Calendar size={11} /> {task.due_date}</span>
                      {task.assignee && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}><User size={11} /> {task.assignee.full_name}</span>}
                      {task.assigner && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}><Clock size={11} /> {task.assigner.full_name}</span>}
                    </div>
                  </div>
                </div>

                {isAssigned && task.status !== 'submitted' && task.status !== 'requested' && task.status !== 'denied' && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: resp?.response ? '8px' : '0' }}>
                      {(task.response_type === 'yes_no' || task.response_type === 'yes_no_na') ? (
                        <>
                          <button onClick={() => handleSporResponse(task.id, 'yes')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '2px solid', borderColor: resp?.response === 'yes' ? 'var(--success)' : 'var(--border)', background: resp?.response === 'yes' ? 'var(--success)' : 'transparent', color: resp?.response === 'yes' ? 'white' : 'var(--text-muted)', fontSize: '12px' }}><CheckCircle size={13} /> Yes</button>
                          <button onClick={() => handleSporResponse(task.id, 'no')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '2px solid', borderColor: resp?.response === 'no' ? 'var(--danger)' : 'var(--border)', background: resp?.response === 'no' ? 'var(--danger)' : 'transparent', color: resp?.response === 'no' ? 'white' : 'var(--text-muted)', fontSize: '12px' }}><XCircle size={13} /> No</button>
                          {task.response_type === 'yes_no_na' && <button onClick={() => handleSporResponse(task.id, 'na')} style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '2px solid', borderColor: resp?.response === 'na' ? 'var(--text-muted)' : 'var(--border)', background: resp?.response === 'na' ? 'var(--text-muted)' : 'transparent', color: resp?.response === 'na' ? 'white' : 'var(--text-muted)', fontSize: '12px' }}>N/A</button>}
                        </>
                      ) : task.response_type === 'checkbox' ? (
                        <button onClick={() => handleSporResponse(task.id, resp?.response === 'checked' ? '' : 'checked')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '2px solid', borderColor: resp?.response === 'checked' ? 'var(--purple-primary)' : 'var(--border)', background: resp?.response === 'checked' ? 'var(--purple-primary)' : 'transparent', color: resp?.response === 'checked' ? 'white' : 'var(--text-muted)', fontSize: '12px' }}><CheckCircle size={13} /> Mark Complete</button>
                      ) : (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                          <Upload size={13} /> Upload Photo
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleSporPhoto(task.id, e.target.files[0])} />
                        </label>
                      )}
                      {resp?.photo_url && <span style={{ fontSize: '11px', color: 'var(--success)' }}><CheckCircle size={11} style={{ verticalAlign: 'middle' }} /> Photo ready</span>}
                      {resp?.response && (
                        <button onClick={() => handleSubmitSporadic(task)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '12px', fontWeight: 600, marginLeft: 'auto' }}><Send size={13} /> Submit</button>
                      )}
                    </div>
                    {resp?.response && (
                      <textarea
                        value={resp?.notes || ''}
                        onChange={e => handleSporNotes(task.id, e.target.value)}
                        placeholder="Notes (optional)"
                        rows={1}
                        style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', fontFamily: 'inherit' }}
                      />
                    )}
                  </div>
                )}

                {canManage && task.status === 'requested' && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>Requested by {task.assigner?.full_name} · Suggested: {members.find(m => m.id === task.assigned_to)?.full_name || 'none'}</span>
                    <button onClick={() => handleApproveSporadic(task)} style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: '#EAF7F0', color: '#27AE60', fontSize: '12px', fontWeight: 600 }}>Approve</button>
                    <button onClick={async () => { await supabase.from('sporadic_tasks').update({ status: 'denied' }).eq('id', task.id); fetchAll(); }} style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: '#FDEDEC', color: '#E74C3C', fontSize: '12px', fontWeight: 600 }}>Deny</button>
                  </div>
                )}

                {task.status === 'submitted' && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle size={13} color="var(--success)" />
                    <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>Completed — Response: {task.response}</span>
                    {task.notes && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>· {task.notes}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ─── EQUIPMENT MAINTENANCE TAB ──────────────────────────────── */}
      {tab === 'equipment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {EQUIPMENT_MAINTENANCE.map(equip => {
            const equipOpen = expandedEquip.has(equip.id);
            const allFreqDone = equip.frequencies.every(f => isMaintFreqDone(maintChecks, equip, f));
            return (
              <div key={equip.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                {/* Equipment header */}
                <button
                  onClick={() => setExpandedEquip(p => { const n = new Set(p); n.has(equip.id) ? n.delete(equip.id) : n.add(equip.id); return n; })}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: allFreqDone ? '#EAF7F0' : 'var(--bg-secondary)', border: 'none', cursor: 'pointer', borderBottom: equipOpen ? '1px solid var(--border)' : 'none', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: allFreqDone ? '#27AE60' : 'var(--text-primary)' }}>{equip.name}</span>
                    {allFreqDone && <span style={{ fontSize: '11px', fontWeight: 600, color: '#27AE60', background: '#D5F5E3', padding: '2px 8px', borderRadius: '10px' }}>All complete</span>}
                  </div>
                  <ChevronDown size={16} style={{ transform: equipOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)', flexShrink: 0 }} />
                </button>

                {equipOpen && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Equipment-level note */}
                    {equip.note && (
                      <div style={{ padding: '10px 12px', background: '#F8F9FA', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                        {equip.note}
                      </div>
                    )}

                    {/* Frequency groups */}
                    {equip.frequencies.map(freq => {
                      const freqKey = `${equip.id}|${freq.id}`;
                      const freqOpen = expandedFreq.has(freqKey);
                      const freqDone = isMaintFreqDone(maintChecks, equip, freq);
                      const doneParents = freq.parents.filter(p => isMaintParentDone(maintChecks, equip, freq, p)).length;
                      const nextDue = getMaintNextDue(freq.resetFreq);
                      const completedRec = maintCompleted[freqKey];
                      const currentCycle = getMaintCycleKey(freq.resetFreq);
                      const lastDone = completedRec && completedRec.cycleKey !== currentCycle
                        ? new Date(completedRec.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : null;

                      return (
                        <div key={freq.id} style={{ border: `1px solid ${freqDone ? '#A9DFBF' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                          {/* Frequency header */}
                          <button
                            onClick={() => setExpandedFreq(p => { const n = new Set(p); n.has(freqKey) ? n.delete(freqKey) : n.add(freqKey); return n; })}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: freqDone ? '#EAF7F0' : 'var(--bg-secondary)', border: 'none', cursor: 'pointer', borderBottom: freqOpen ? `1px solid ${freqDone ? '#A9DFBF' : 'var(--border)'}` : 'none', textAlign: 'left', gap: '10px' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: freqDone ? '#27AE60' : 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{freq.label}</span>
                              {freq.subtitle && <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>— {freq.subtitle}</span>}
                              {freqDone
                                ? <span style={{ fontSize: '11px', color: '#27AE60', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Complete this cycle</span>
                                : <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{doneParents}/{freq.parents.length} tasks</span>
                              }
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {lastDone && `Last: ${lastDone} · `}Next due: {nextDue}
                              </span>
                              <ChevronDown size={13} style={{ transform: freqOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }} />
                            </div>
                          </button>

                          {freqOpen && (
                            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              {freq.parents.map(parent => {
                                const parentDone = isMaintParentDone(maintChecks, equip, freq, parent);
                                return (
                                  <div key={parent.id}>
                                    {/* Parent task row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${parentDone ? '#27AE60' : 'var(--border)'}`, background: parentDone ? '#27AE60' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {parentDone && <CheckCircle size={11} color="white" />}
                                      </div>
                                      <span style={{ fontSize: '13px', fontWeight: 600, color: parentDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: parentDone ? 'line-through' : 'none', lineHeight: 1.4 }}>{parent.label}</span>
                                    </div>

                                    {/* Sub-items */}
                                    <div style={{ marginLeft: '26px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {parent.subItems.map(sub => {
                                        const key = getMaintKey(equip.id, freq.id, freq.resetFreq, parent.id, sub.id);
                                        const val = maintChecks[key] || null;
                                        const subDone = sub.type === 'yn' ? val === 'Y' : val === 'done';
                                        return (
                                          <div key={sub.id}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                              {sub.type === 'yn' ? (
                                                <div style={{ display: 'flex', gap: '3px', flexShrink: 0, marginTop: '1px' }}>
                                                  <button
                                                    onClick={() => toggleMaintCheck(equip.id, freq.id, freq.resetFreq, parent.id, sub.id, 'Y')}
                                                    style={{ padding: '2px 9px', borderRadius: '4px', border: `1.5px solid ${val === 'Y' ? '#27AE60' : 'var(--border)'}`, background: val === 'Y' ? '#27AE60' : 'transparent', color: val === 'Y' ? 'white' : 'var(--text-muted)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', lineHeight: 1.4 }}>Y</button>
                                                  <button
                                                    onClick={() => toggleMaintCheck(equip.id, freq.id, freq.resetFreq, parent.id, sub.id, 'N')}
                                                    style={{ padding: '2px 9px', borderRadius: '4px', border: `1.5px solid ${val === 'N' ? '#E74C3C' : 'var(--border)'}`, background: val === 'N' ? '#E74C3C' : 'transparent', color: val === 'N' ? 'white' : 'var(--text-muted)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', lineHeight: 1.4 }}>N</button>
                                                </div>
                                              ) : (
                                                <button
                                                  onClick={() => toggleMaintCheck(equip.id, freq.id, freq.resetFreq, parent.id, sub.id, 'done')}
                                                  style={{ width: '22px', height: '22px', borderRadius: 'var(--radius-sm)', border: `1.5px solid ${val === 'done' ? 'var(--purple-primary)' : 'var(--border)'}`, background: val === 'done' ? 'var(--purple-primary)' : 'transparent', color: val === 'done' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: '1px' }}>
                                                  {val === 'done' && <CheckCircle size={12} />}
                                                </button>
                                              )}
                                              <div style={{ minWidth: 0 }}>
                                                <span style={{ fontSize: '13px', color: subDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: subDone ? 'line-through' : 'none', lineHeight: 1.5 }}>{sub.label}</span>
                                                {sub.note && <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '2px 0 0', lineHeight: 1.4 }}>{sub.note}</p>}
                                                {sub.warning && <p style={{ fontSize: '11px', color: '#E67E22', margin: '2px 0 0', lineHeight: 1.4 }}>{sub.warning}</p>}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Parent-level warning */}
                                    {parent.warning && (
                                      <div style={{ marginLeft: '26px', marginTop: '8px', padding: '8px 12px', background: '#FFF8F0', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: '#C0392B', lineHeight: 1.5 }}>
                                        {parent.warning}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── ADD RECURRING MODAL ────────────────────────────────────── */}
      {showRecurForm && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '520px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Recurrent Task</h2>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Description</label>
              <textarea value={newRecur.title} onChange={e => setNewRecur(p => ({ ...p, title: e.target.value }))} rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              {[
                { label: 'Category', key: 'category', opts: ['MISC', 'PM'] },
                { label: 'Frequency', key: 'frequency', opts: ALL_FREQS },
                { label: 'Response', key: 'response_type', opts: ['yes_no', 'yes_no_na', 'checkbox', 'photo'] },
              ].map(({ label, key, opts }) => (
                <div key={key} style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>{label}</label>
                  <select value={newRecur[key]} onChange={e => setNewRecur(p => ({ ...p, [key]: e.target.value }))} style={{ width: '100%', padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Section / Audit Area</label>
                <input value={newRecur.group_name} onChange={e => setNewRecur(p => ({ ...p, group_name: e.target.value }))} placeholder="e.g. Safety Check, Sample Prep…" style={{ width: '100%', padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Tasks with the same section name are grouped together</p>
              </div>
              <div style={{ width: '80px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Order</label>
                <input type="number" value={newRecur.sort_order} onChange={e => setNewRecur(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} style={{ width: '100%', padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <input type="checkbox" id="sop-new" checked={newRecur.sop_trigger} onChange={e => setNewRecur(p => ({ ...p, sop_trigger: e.target.checked }))} style={{ width: '15px', height: '15px', accentColor: 'var(--purple-primary)' }} />
              <label htmlFor="sop-new" style={{ fontSize: '13px', fontWeight: 500 }}>SOP Trigger (requires photo when marked No)</label>
            </div>
            {newRecur.sop_trigger && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Conditional text (shown when marked No)</label>
                <textarea value={newRecur.conditional_text} onChange={e => setNewRecur(p => ({ ...p, conditional_text: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRecurForm(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleAddRecurring} disabled={!newRecur.title} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: newRecur.title ? 'var(--purple-primary)' : 'var(--border)', color: newRecur.title ? 'white' : 'var(--text-muted)', fontWeight: 600 }}>Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD ONE-OFF MODAL ──────────────────────────────────────── */}
      {showSporForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '520px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>{canManage ? 'Create Ad hoc Task' : 'Request a Task'}</h2>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Title</label>
              <input value={newSpor.title} onChange={e => setNewSpor(p => ({ ...p, title: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Description (optional)</label>
              <textarea value={newSpor.description} onChange={e => setNewSpor(p => ({ ...p, description: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>{canManage ? 'Assign to' : 'Suggested assignee'}</label>
                <select value={newSpor.assigned_to} onChange={e => setNewSpor(p => ({ ...p, assigned_to: e.target.value }))} style={{ width: '100%', padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="">Select…</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Due Date</label>
                <input type="date" value={newSpor.due_date} onChange={e => setNewSpor(p => ({ ...p, due_date: e.target.value }))} style={{ width: '100%', padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSporForm(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleCreateSporadic} disabled={!newSpor.title || !newSpor.due_date} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: !newSpor.title || !newSpor.due_date ? 'var(--border)' : 'var(--purple-primary)', color: !newSpor.title || !newSpor.due_date ? 'var(--text-muted)' : 'white', fontWeight: 600 }}>{canManage ? 'Create & Assign' : 'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
