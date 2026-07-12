import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fmtName, sortByLast } from '../lib/nameUtils';
import { CheckCircle, XCircle, AlertTriangle, Upload, Clock, Search, ChevronDown, Bell, Trash2, Plus, Check, Globe, Pencil, X } from 'lucide-react';
import {
  getMaintCycleKey, getMaintNextDue, getMaintKey,
  isMaintParentDone, isMaintFreqDone,
  EQUIPMENT_MAINTENANCE,
} from '../data/equipmentMaintenance';

const API = process.env.REACT_APP_BACKEND_URL;

const FREQ_COLORS = {
  daily:     { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  weekly:    { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  biweekly:  { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
  monthly:   { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  quarterly: { bg: '#FDEBD0', text: '#D35400', border: '#F0B27A' },
  yearly:    { bg: '#FDEDEC', text: '#E74C3C', border: '#F1948A' },
};
const ALL_FREQS = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

const FREQ_ORDER = ['yearly', 'quarterly', 'monthly', 'biweekly', 'weekly', 'daily'];
const FREQ_LABEL = { yearly: 'Yearly', quarterly: 'Quarterly', monthly: 'Monthly', biweekly: 'Biweekly', weekly: 'Weekly', daily: 'Daily' };
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const LOOKAHEAD = { daily: 7, weekly: 14, biweekly: 30, monthly: 60, quarterly: 90, yearly: 90 };

// ── Style helpers ─────────────────────────────────────────────────────────────


const btn = (variant = 'primary') => ({
  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: variant === 'outline' ? '1.5px solid var(--purple-primary)' : 'none',
  background: variant === 'primary' ? 'var(--purple-primary)' : variant === 'outline' ? 'transparent' : '#f3f4f6',
  color: variant === 'primary' ? '#fff' : variant === 'outline' ? 'var(--purple-primary)' : 'var(--text-primary)',
});

const card = { background: 'var(--bg-primary)', borderRadius: 12, padding: 24, boxShadow: 'var(--shadow-sm)' };

const linkBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--purple-primary)', fontSize: 13, fontWeight: 600, padding: '2px 6px',
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0]; }

function occStatus(o) {
  if (o.status === 'done') return 'done';
  if (!o.assigned_to) return 'unassigned';
  return o.due_date < today() ? 'late' : 'pending';
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${MONTHS_SHORT[Number(m) - 1]} ${Number(d)}, ${y}`;
}

// ── Range list picker (Year / Quarter / Month / Week) ────────────────────────

function RangeList({ items, value, onChange }) {
  // value = { start: ISO-date-string, end: ISO-date-string }
  function click(item) {
    if (!value?.start) {
      onChange({ start: item.startISO, end: null });
    } else if (item.startISO < value.start) {
      onChange({ start: item.startISO, end: null });
    } else if (!value.end || item.endISO !== value.end) {
      onChange({ start: value.start, end: item.endISO });
    } else {
      onChange({ start: value.start, end: null });
    }
  }

  function inRange(item) {
    if (!value?.start) return false;
    if (!value?.end) return item.startISO === value.start;
    return item.startISO >= value.start && item.endISO <= value.end;
  }

  const selecting = !value?.start ? 'start' : !value?.end ? 'end' : 'done';

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, height: 18 }}>
        {selecting === 'start' && 'Click to set start'}
        {selecting === 'end' && 'Click to set end'}
        {value?.start && (
          <button onClick={() => onChange({ start: null, end: null })} style={{ ...linkBtn, fontSize: 11, marginLeft: 8 }}>
            Reset
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(item => {
          const active = inRange(item);
          const isEdge = (value?.start && item.startISO === value.start) || (value?.end && item.endISO === value.end);
          return (
            <button key={item.key} onClick={() => click(item)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              border: active ? '2px solid var(--purple-primary)' : '1.5px solid var(--border)',
              background: active ? 'rgba(123,63,160,0.1)' : 'var(--bg-primary)',
              fontWeight: isEdge ? 700 : 400,
              color: active ? 'var(--purple-primary)' : 'var(--text-primary)',
            }}>
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Date range inputs (biweekly / daily) ─────────────────────────────────────

function DateRangeInputs({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
      <label style={{ fontSize: 13 }}>
        <span style={{ color: 'var(--text-muted)' }}>Start date</span>
        <input type="date" value={value?.start || ''} style={{ display: 'block', marginTop: 4, padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text-primary)' }}
          onChange={e => onChange({ start: e.target.value, end: value?.end || null })} />
      </label>
      <span style={{ fontSize: 18, color: 'var(--text-muted)', marginBottom: 8 }}>→</span>
      <label style={{ fontSize: 13 }}>
        <span style={{ color: 'var(--text-muted)' }}>End date</span>
        <input type="date" value={value?.end || ''} min={value?.start || ''} style={{ display: 'block', marginTop: 4, padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text-primary)' }}
          onChange={e => onChange({ start: value?.start || null, end: e.target.value })} />
      </label>
    </div>
  );
}

// ── Item generators ───────────────────────────────────────────────────────────

function yearItems() {
  const y = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => ({
    key: String(y + i), label: String(y + i),
    startISO: `${y + i}-01-01`, endISO: `${y + i}-12-31`,
  }));
}

function quarterItems() {
  const y = new Date().getFullYear();
  const items = [];
  for (let yr = y; yr <= y + 1; yr++) {
    for (let q = 1; q <= 4; q++) {
      const sm = (q - 1) * 3 + 1;
      const em = q * 3;
      const ld = new Date(yr, em, 0).getDate();
      items.push({
        key: `${yr}-Q${q}`, label: `Q${q} ${yr}`,
        startISO: `${yr}-${String(sm).padStart(2,'0')}-01`,
        endISO: `${yr}-${String(em).padStart(2,'0')}-${ld}`,
      });
    }
  }
  return items;
}

function monthItems() {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear(); const m = d.getMonth() + 1;
    const ld = new Date(y, m, 0).getDate();
    const iso = `${y}-${String(m).padStart(2,'0')}`;
    return {
      key: iso, label: `${MONTHS_SHORT[m-1]} ${y}`,
      startISO: `${iso}-01`, endISO: `${iso}-${ld}`,
    };
  });
}

function weekItems() {
  const now = new Date();
  const sun = new Date(now); sun.setDate(now.getDate() - now.getDay());
  return Array.from({ length: 26 }, (_, i) => {
    const s = new Date(sun); s.setDate(sun.getDate() + i * 7);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    const startISO = s.toISOString().split('T')[0];
    const endISO = e.toISOString().split('T')[0];
    return { key: startISO, label: `Week of ${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}`, startISO, endISO };
  });
}

function pickerFor(freq, value, onChange) {
  if (freq === 'yearly') return <RangeList items={yearItems()} value={value} onChange={onChange} />;
  if (freq === 'quarterly') return <RangeList items={quarterItems()} value={value} onChange={onChange} />;
  if (freq === 'monthly') return <RangeList items={monthItems()} value={value} onChange={onChange} />;
  if (freq === 'weekly') return <RangeList items={weekItems()} value={value} onChange={onChange} />;
  return <DateRangeInputs value={value} onChange={onChange} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Tasks2({ userRole, userId, profile: myProfile }) {
  const [tab, setTab] = useState('view-all');

  // Shared data
  const [tasks, setTasks] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [expandedCadences, setExpandedCadences] = useState(new Set()); // "CAT-freq"
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [rotateEvery, setRotateEvery] = useState(1);
  const [dateRanges, setDateRanges] = useState({});
  const [freqSubStep, setFreqSubStep] = useState(0);
  const [applyAllAsked, setApplyAllAsked] = useState(false);
  const [occs, setOccs] = useState([]);
  const [occsLoading, setOccsLoading] = useState(false);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);

  // ── SOP exception state (taskId → { note, photo, photoPreview, submitting, submitted }) ──
  const [sopExceptions, setSopExceptions] = useState({});

  // ── View All Tasks state ──────────────────────────────────────────────────
  const [vatTasks, setVatTasks] = useState([]);
  const [vatExisting, setVatExisting] = useState({});
  const [vatResponses, setVatResponses] = useState({});
  const [vatCategory, setVatCategory] = useState('MISC');
  const [vatFreq, setVatFreq] = useState('daily');
  const [vatSearch, setVatSearch] = useState('');
  const [vatLoading, setVatLoading] = useState(false);
  const [vatLoaded, setVatLoaded] = useState(false);
  const [maintChecks, setMaintChecks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lab_maint_checks') || '{}'); } catch { return {}; }
  });
  const [maintCompleted, setMaintCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lab_maint_completed') || '{}'); } catch { return {}; }
  });
  const [vatExpandedEquip, setVatExpandedEquip] = useState(
    () => new Set(EQUIPMENT_MAINTENANCE.map(e => e.id))
  );
  const [vatExpandedFreq, setVatExpandedFreq] = useState(
    () => new Set(EQUIPMENT_MAINTENANCE.flatMap(e => e.frequencies.map(f => `${e.id}|${f.id}`)))
  );

  // ── Assigned Tasks log state ──────────────────────────────────────────────
  const [assignedOccs, setAssignedOccs] = useState([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedFrom, setAssignedFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0];
  });
  const [assignedTo, setAssignedTo] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0];
  });
  const [editingOccId, setEditingOccId] = useState(null);
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [remindingId, setRemindingId] = useState(null);
  const [remindedIds, setRemindedIds] = useState(new Set());

  // ── Performance report state ──────────────────────────────────────────────
  const [reportPeriod, setReportPeriod] = useState('current');
  const [reportRows, setReportRows] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // ── Productivity state ────────────────────────────────────────────────────
  const [prodPeriod, setProdPeriod] = useState('current');
  const [prodRows, setProdRows] = useState([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodSelected, setProdSelected] = useState(new Set());
  const [prodDropdownOpen, setProdDropdownOpen] = useState(false);
  const [prodDetailPerson, setProdDetailPerson] = useState(null);
  const [prodDetailTasks, setProdDetailTasks] = useState([]);
  const [prodDetailLoading, setProdDetailLoading] = useState(false);
  const [prodDetailHistoryPeriod, setProdDetailHistoryPeriod] = useState('all');
  const [prodDetailColorFilter, setProdDetailColorFilter] = useState(new Set());
  const [prodDetail3MoFilter, setProdDetail3MoFilter] = useState(null);

  // ── My Tasks state ────────────────────────────────────────────────────────
  const [myTaskOccs, setMyTaskOccs] = useState([]);
  const [myTaskOneOffs, setMyTaskOneOffs] = useState([]);
  const [myTaskLoading, setMyTaskLoading] = useState(false);
  const [myTaskStatusFilter, setMyTaskStatusFilter] = useState('all');
  const [myTaskResponses, setMyTaskResponses] = useState({});
  const [myTaskNotes, setMyTaskNotes] = useState({});
  // Tracks occurrence IDs already auto-persisted as 'done' to avoid duplicate DB writes
  const persistedCompletionsRef = useRef(new Set());

  // PM reminder counts keyed by occurrence ID, persisted in localStorage
  const [pmReminders, setPmReminders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lab_pm_reminders') || '{}'); } catch { return {}; }
  });

  // ── Calendar state ────────────────────────────────────────────────────────
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calData, setCalData] = useState([]);
  const [calLoading, setCalLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  // ── Unassigned state ──────────────────────────────────────────────────────
  const [unassigned, setUnassigned] = useState([]);
  const unassignedCount = unassigned.length;
  const [uLoading, setULoading] = useState(false);
  const [quickAssign, setQuickAssign] = useState(null);
  const [qaAssignees, setQaAssignees] = useState([]);
  const [qaStart, setQaStart] = useState('');
  const [qaEnd, setQaEnd] = useState('');
  const [qaPreview, setQaPreview] = useState(null);
  const [qaSubmitting, setQaSubmitting] = useState(false);
  const [qaDone, setQaDone] = useState(false);

  // ── Task definition editor state ─────────────────────────────────────────
  const [editingTaskDef, setEditingTaskDef] = useState(null);
  const [taskDefForm, setTaskDefForm] = useState({});
  const [taskDefSaving, setTaskDefSaving] = useState(false);
  const [confirmDeleteDef, setConfirmDeleteDef] = useState(null);

  // ── One-off Tasks state ───────────────────────────────────────────────────
  const [oneOffTasks, setOneOffTasks] = useState([]);
  const [oneOffLoading, setOneOffLoading] = useState(false);
  const [oneOffForm, setOneOffForm] = useState({ title: '', assigneeIds: [], dueDate: '', showOnPublic: false });
  const [oneOffSaving, setOneOffSaving] = useState(false);
  const [oneOffError, setOneOffError] = useState('');
  const [confirmDeleteOneOff, setConfirmDeleteOneOff] = useState(null);

  // ── Load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/tasks2/data`)
      .then(r => r.json())
      .then(d => { setTasks(d.tasks || []); setProfiles(d.profiles || []); setVacations(d.vacations || []); setDataLoading(false); })
      .catch(() => setDataLoading(false));
  }, []);

  useEffect(() => { if (tab === 'calendar') loadCalendar(); }, [tab, calYear, calMonth]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'unassigned') loadUnassigned(); }, [tab]);
  useEffect(() => { if (tab === 'view-all' && !vatLoaded) loadVatData(); }, [tab, vatLoaded]); // eslint-disable-line
  useEffect(() => { if (tab === 'assigned') loadAssignedTasks(assignedFrom, assignedTo); }, [tab, assignedFrom, assignedTo]); // eslint-disable-line
  useEffect(() => { if (tab === 'assigned') loadReport(reportPeriod, assignedFrom, assignedTo); }, [tab, reportPeriod, assignedFrom, assignedTo]); // eslint-disable-line
  useEffect(() => { if (tab === 'productivity') loadProductivity(prodPeriod); }, [tab, prodPeriod, profiles.length]); // eslint-disable-line
  useEffect(() => { if (tab === 'oneoff') loadOneOffTab(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'my-tasks' && userId) { loadMyTasks(); if (!vatLoaded) loadVatData(); } }, [tab, userId]); // eslint-disable-line

  // Auto-persist completed task groups to DB
  useEffect(() => {
    if (!myTaskOccs.length || !vatTasks.length) return;
    const occByDefId = {};
    myTaskOccs.forEach(occ => { if (occ.task_def?.id) occByDefId[occ.task_def.id] = occ; });
    const myDefIds = new Set(Object.keys(occByDefId));
    const myGroupKeys = new Set();
    vatTasks.forEach(t => { if (myDefIds.has(t.id)) myGroupKeys.add(t.group_name || t.title || t.id); });
    const groupMap = new Map();
    vatTasks.forEach(t => {
      const gKey = t.group_name || t.title || t.id;
      if (!myGroupKeys.has(gKey)) return;
      if (!groupMap.has(gKey)) groupMap.set(gKey, { groupName: t.group_name || '', tasks: [] });
      groupMap.get(gKey).tasks.push(t);
    });
    const toUpdate = [];
    groupMap.forEach(group => {
      const isLiveCell = group.groupName === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time';
      let complete = false;
      if (isLiveCell) {
        const lcParent = group.tasks.find(t => t.response_type === 'yes_no');
        const lcResp = lcParent ? vatResponses[lcParent.id]?.response : null;
        if (lcResp === 'no') complete = true;
        else if (lcResp === 'yes') complete = group.tasks.filter(t => t.response_type === 'checkbox').every(t => vatResponses[t.id]?.response === 'checked');
      } else {
        complete = group.tasks.every(t => {
          if (!myDefIds.has(t.id)) return true;
          const r = vatResponses[t.id]?.response;
          if (!r) return false;
          // SOP task marked 'no' requires exception to be submitted first
          if (t.sop_trigger && r === 'no' && !sopExceptions[t.id]?.submitted) return false;
          if (!t.sub_tasks?.length) return true;
          const trigger = t.sub_tasks[0]?.trigger || 'always';
          const triggered = trigger === 'always' || (trigger.startsWith('custom:') ? r === trigger.slice(7) : r === trigger);
          return !triggered || t.sub_tasks.every(st => vatResponses[`${t.id}_sub_${st.id}`]?.response === 'checked');
        });
      }
      if (complete) {
        group.tasks.forEach(t => {
          const occ = occByDefId[t.id];
          if (occ && occ.status !== 'done' && !persistedCompletionsRef.current.has(occ.id)) {
            persistedCompletionsRef.current.add(occ.id);
            toUpdate.push(occ.id);
          }
        });
      }
    });
    if (toUpdate.length > 0) {
      const now = new Date().toISOString();
      toUpdate.forEach(id => supabase.from('task_occurrences').update({ status: 'done', completed_at: now }).eq('id', id));
      setMyTaskOccs(prev => prev.map(occ => toUpdate.includes(occ.id) ? { ...occ, status: 'done', completed_at: now } : occ));
    }
  }, [vatResponses, sopExceptions]); // eslint-disable-line

  useEffect(() => {
    localStorage.setItem('lab_maint_checks', JSON.stringify(maintChecks));
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

  function loadCalendar() {
    setCalLoading(true);
    setSelectedDay(null);
    fetch(`${API}/api/tasks2/calendar?year=${calYear}&month=${calMonth}`)
      .then(r => r.json()).then(d => { setCalData(d); setCalLoading(false); })
      .catch(() => setCalLoading(false));
  }

  function loadUnassigned() {
    setULoading(true);
    fetch(`${API}/api/tasks2/unassigned`)
      .then(r => r.json()).then(d => { setUnassigned(d); setULoading(false); })
      .catch(() => setULoading(false));
  }

  // ── View All Tasks helpers ────────────────────────────────────────────────

  async function loadVatData() {
    setVatLoading(true);
    const [{ data: taskData }, { data: respData }] = await Promise.all([
      supabase.from('tasks_definitions').select('*').eq('status', 'published').order('category').order('frequency').order('sort_order'),
      supabase.from('task_responses').select('*, assignment:task_assignments(assigned_to, profile:profiles(full_name))').order('responded_at', { ascending: false }),
    ]);
    const respMap = {};
    for (const r of (respData || [])) {
      if (!respMap[r.task_definition_id]) respMap[r.task_definition_id] = r;
    }
    setVatTasks(taskData || []);
    setVatExisting(respMap);
    setVatLoading(false);
    setVatLoaded(true);
  }

  function openTaskDefEditor(task, defaults) {
    const src = task || {};
    const opts = src.response_options || [];
    setTaskDefForm({
      title: src.title || '',
      category: src.category || defaults?.category || 'MISC',
      frequency: src.frequency || defaults?.frequency || 'weekly',
      group_name: src.group_name || defaults?.group_name || '',
      newGroupMode: false,
      sort_order: src.sort_order ?? 0,
      sop_trigger: src.sop_trigger || false,
      sop_url: src.conditional_text || '',
      respYes: opts.length ? opts.includes('yes') : (src.response_type === 'yes_no' || src.response_type === 'yes_no_na' || !src.id),
      respNo: opts.length ? opts.includes('no') : (src.response_type === 'yes_no' || src.response_type === 'yes_no_na' || !src.id),
      respNa: opts.length ? opts.includes('na') : src.response_type === 'yes_no_na',
      respFillIn: opts.includes('fill_in'),
      customOptions: opts.filter(o => o.startsWith('custom:')).map(o => o.slice(7)),
      subTasks: (src.sub_tasks || []).map(s => s.title || s),
      subTaskTrigger: src.sub_tasks?.[0]?.trigger || 'always',
    });
    setEditingTaskDef(task || { _new: true, ...defaults });
    setConfirmDeleteDef(null);
  }

  async function handleSaveTaskDef() {
    if (!taskDefForm.title.trim()) return;
    setTaskDefSaving(true);
    const response_options = [
      ...(taskDefForm.respYes ? ['yes'] : []),
      ...(taskDefForm.respNo ? ['no'] : []),
      ...(taskDefForm.respNa ? ['na'] : []),
      ...(taskDefForm.respFillIn ? ['fill_in'] : []),
      ...taskDefForm.customOptions.filter(o => o.trim()).map(o => `custom:${o.trim()}`),
    ];
    const response_type =
      taskDefForm.respYes && taskDefForm.respNo && taskDefForm.respNa ? 'yes_no_na' :
      taskDefForm.respYes && taskDefForm.respNo ? 'yes_no' :
      taskDefForm.respFillIn && !taskDefForm.respYes && !taskDefForm.respNo ? 'text' : 'yes_no';
    const subTasksClean = taskDefForm.subTasks.map(s => s.trim()).filter(Boolean);
    const payload = {
      title: taskDefForm.title.trim(),
      category: taskDefForm.category,
      frequency: taskDefForm.frequency,
      group_name: taskDefForm.group_name.trim() || null,
      sort_order: parseInt(taskDefForm.sort_order) || 0,
      sop_trigger: taskDefForm.sop_trigger,
      conditional_text: taskDefForm.sop_url.trim() || null,
      response_type,
      response_options: response_options.length ? response_options : null,
      sub_tasks: subTasksClean.length ? subTasksClean.map((t, i) => ({ id: i, title: t, trigger: taskDefForm.subTaskTrigger })) : null,
      status: 'published',
    };
    if (editingTaskDef?.id) {
      await supabase.from('tasks_definitions').update(payload).eq('id', editingTaskDef.id);
    } else {
      await supabase.from('tasks_definitions').insert([payload]);
    }
    setTaskDefSaving(false);
    setEditingTaskDef(null);
    setVatLoaded(false);
    loadVatData();
  }

  async function handleDeleteTaskDef(id) {
    await supabase.from('tasks_definitions').update({ status: 'archived' }).eq('id', id);
    setConfirmDeleteDef(null);
    setEditingTaskDef(null);
    setVatLoaded(false);
    loadVatData();
  }

  function renderTaskDefModal() {
    if (!editingTaskDef) return null;
    const f = taskDefForm;
    const tdf = v => setTaskDefForm(p => ({ ...p, ...v }));
    const isNew = !!editingTaskDef._new;
    const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' };
    const toggleBtn = (active, onClick, label) => (
      <button onClick={onClick} style={{ padding: '5px 12px', borderRadius: 10, border: `1.5px solid ${active ? 'var(--purple-primary)' : 'var(--border)'}`, background: active ? 'var(--purple-primary)' : 'transparent', color: active ? 'white' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>{label}</button>
    );
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{isNew ? 'New Task' : 'Edit Task'}</span>
            <button onClick={() => setEditingTaskDef(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Title */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Title *</label>
              <input value={f.title} onChange={e => tdf({ title: e.target.value })} onBlur={e => tdf({ title: e.target.value.trim().replace(/\b\w/g, c => c.toUpperCase()) })} placeholder="Task title…" style={inputStyle} />
            </div>
            {/* Category + Frequency */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Category</label>
                <select value={f.category} onChange={e => tdf({ category: e.target.value })} style={inputStyle}>
                  <option value="MISC">MISC</option>
                  <option value="PM">PM</option>
                  <option value="Equipment">Equipment</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Frequency</label>
                <select value={f.frequency} onChange={e => tdf({ frequency: e.target.value })} style={inputStyle}>
                  {ALL_FREQS.map(fr => <option key={fr} value={fr}>{fr.charAt(0).toUpperCase() + fr.slice(1)}</option>)}
                </select>
              </div>
            </div>
            {/* Group */}
            {(() => {
              const existingGroups = [...new Set(vatTasks.filter(t => t.group_name && t.category === f.category && t.frequency === f.frequency).map(t => t.group_name))].sort();
              const showNewInput = f.newGroupMode;
              const selectVal = showNewInput ? '__new__' : (f.group_name || '');
              return (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Group Name</label>
              <select value={selectVal} onChange={e => {
                if (e.target.value === '__new__') {
                  tdf({ group_name: '', newGroupMode: true });
                } else {
                  tdf({ group_name: e.target.value, newGroupMode: false });
                }
              }} style={inputStyle}>
                <option value="">No group</option>
                {existingGroups.map(g => <option key={g} value={g}>{g}</option>)}
                <option value="__new__">+ Add new group…</option>
              </select>
              {showNewInput && (
                <input
                  value={f.group_name}
                  onChange={e => tdf({ group_name: e.target.value })}
                  onBlur={e => tdf({ group_name: e.target.value.trim().replace(/\b\w/g, c => c.toUpperCase()) })}
                  placeholder="New group name…"
                  autoFocus
                  style={{ ...inputStyle, marginTop: 6 }}
                />
              )}
            </div>
              );
            })()}
            {/* Response Options */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Response Options</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {toggleBtn(f.respYes, () => tdf({ respYes: !f.respYes }), 'Yes')}
                {toggleBtn(f.respNo, () => tdf({ respNo: !f.respNo }), 'No')}
                {toggleBtn(f.respNa, () => tdf({ respNa: !f.respNa }), 'N/A')}
              </div>
              {f.customOptions.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input value={opt} onChange={e => { const a = [...f.customOptions]; a[i] = e.target.value; tdf({ customOptions: a }); }} placeholder={`Custom option ${i + 1}…`} style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => { const a = f.customOptions.filter((_, j) => j !== i); tdf({ customOptions: a }); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 8px', display: 'flex', alignItems: 'center' }}><X size={13} /></button>
                </div>
              ))}
              <button onClick={() => tdf({ customOptions: [...f.customOptions, ''] })} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                <Plus size={12} /> Add another option
              </button>
            </div>
            {/* Sub-tasks */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Sub-tasks</label>
              {f.subTasks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Show sub-tasks when main answer is</span>
                  <select value={f.subTaskTrigger} onChange={e => tdf({ subTaskTrigger: e.target.value })} style={{ ...inputStyle, flex: 1, padding: '4px 8px' }}>
                    <option value="always">Always</option>
                    {f.respYes && <option value="yes">Yes</option>}
                    {f.respNo && <option value="no">No</option>}
                    {f.respNa && <option value="na">N/A</option>}
                    {f.customOptions.filter(o => o.trim()).map(o => (
                      <option key={o} value={`custom:${o.trim()}`}>{o.trim()}</option>
                    ))}
                  </select>
                </div>
              )}
              {f.subTasks.map((st, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input value={st} onChange={e => { const a = [...f.subTasks]; a[i] = e.target.value; tdf({ subTasks: a }); }} placeholder={`Sub-task ${i + 1}…`} style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => tdf({ subTasks: f.subTasks.filter((_, j) => j !== i) })} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 8px', display: 'flex', alignItems: 'center' }}><X size={13} /></button>
                </div>
              ))}
              <button onClick={() => tdf({ subTasks: [...f.subTasks, ''] })} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                <Plus size={12} /> Add sub-task
              </button>
            </div>
            {/* SOP */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>SOP</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                <input type="checkbox" checked={f.sop_trigger} onChange={e => tdf({ sop_trigger: e.target.checked })} style={{ accentColor: 'var(--purple-primary)' }} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>This task has an SOP</span>
              </label>
              {f.sop_trigger && (
                <input value={f.sop_url} onChange={e => tdf({ sop_url: e.target.value })} placeholder="SOP URL or description…" style={inputStyle} />
              )}
            </div>
          </div>
          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)', gap: 10 }}>
            <div>
              {!isNew && (
                confirmDeleteDef === editingTaskDef?.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleDeleteTaskDef(editingTaskDef.id)} style={{ padding: '6px 12px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Confirm Delete</button>
                    <button onClick={() => setConfirmDeleteDef(null)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteDef(editingTaskDef?.id)} style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--danger)', cursor: 'pointer' }}>Archive Task</button>
                )
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditingTaskDef(null)} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={handleSaveTaskDef} disabled={taskDefSaving || !taskDefForm.title.trim()} style={{ padding: '7px 18px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (taskDefSaving || !taskDefForm.title.trim()) ? 0.6 : 1 }}>{taskDefSaving ? 'Saving…' : 'Save Task'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function toggleMaintCheck(equipId, freqId, resetFreq, parentId, subId, value) {
    const key = getMaintKey(equipId, freqId, resetFreq, parentId, subId);
    setMaintChecks(p => ({ ...p, [key]: p[key] === value ? null : value }));
  }

  function handleVatResponse(taskId, value) {
    setVatResponses(p => ({ ...p, [taskId]: { ...p[taskId], response: value } }));
  }

  function handleVatNotes(taskId, value) {
    setVatResponses(p => ({ ...p, [taskId]: { ...p[taskId], notes: value } }));
  }

  function handleSopNote(taskId, note) {
    setSopExceptions(p => ({ ...p, [taskId]: { ...(p[taskId] || {}), note } }));
  }

  function handleSopPhotoSelect(taskId, file) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setSopExceptions(p => ({ ...p, [taskId]: { ...(p[taskId] || {}), photo: file, photoPreview: preview } }));
  }

  async function handleSopSubmit(task) {
    const exc = sopExceptions[task.id] || {};
    if (!exc.note?.trim() && !exc.photo) return;
    setSopExceptions(p => ({ ...p, [task.id]: { ...p[task.id], submitting: true } }));

    let photoUrl = null;
    if (exc.photo) {
      const ext = exc.photo.name?.split('.').pop() || 'jpg';
      const path = `sop-exceptions/${task.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('lab-files').upload(path, exc.photo, { contentType: exc.photo.type, upsert: false });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
        photoUrl = urlData?.publicUrl || null;
      }
    }

    await supabase.from('task_responses').insert([{
      task_definition_id: task.id,
      submitted_by: userId,
      response: 'no',
      notes: exc.note?.trim() || null,
      sop_photo_url: photoUrl,
    }]);

    await fetch(`${API}/api/sop-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskTitle: task.title,
        note: exc.note?.trim() || null,
        photoUrl,
        submittedByName: myProfile?.full_name || 'Lab member',
        submittedByEmail: myProfile?.email || '',
      }),
    }).catch(() => {});

    setSopExceptions(p => ({ ...p, [task.id]: { ...p[task.id], submitting: false, submitted: true, photoUrl } }));
  }

  // ── Wizard helpers ────────────────────────────────────────────────────────

  const orderedFreqs = FREQ_ORDER.filter(f =>
    tasks.some(t => selectedTaskIds.has(t.id) && t.frequency?.toLowerCase() === f)
  );

  // ── Scope tree helpers ────────────────────────────────────────────────────

  const CAT_ORDER = ['MISC', 'PM', 'Equipment'];

  function buildTree() {
    const catFreqs = {};
    tasks.forEach(t => {
      const c = t.category || 'MISC';
      const f = t.frequency?.toLowerCase();
      if (!f) return;
      if (!catFreqs[c]) catFreqs[c] = new Set();
      catFreqs[c].add(f);
    });
    return CAT_ORDER.filter(c => catFreqs[c]).map(c => ({
      cat: c,
      freqs: FREQ_ORDER.filter(f => catFreqs[c].has(f)),
    }));
  }

  function tasksInLeaf(cat, freq) {
    return tasks.filter(t => t.category === cat && t.frequency?.toLowerCase() === freq);
  }

  function selectedInLeaf(cat, freq) {
    return tasksInLeaf(cat, freq).filter(t => selectedTaskIds.has(t.id));
  }

  function catCheckboxState(cat) {
    const all = tasks.filter(t => t.category === cat);
    const sel = all.filter(t => selectedTaskIds.has(t.id));
    if (sel.length === 0) return 'unchecked';
    if (sel.length === all.length) return 'checked';
    return 'indeterminate';
  }

  function getGroupsForLeaf(cat, freq) {
    const groupMap = new Map();
    tasksInLeaf(cat, freq).forEach(t => {
      const key = t.group_name || t.title;
      if (!groupMap.has(key)) groupMap.set(key, { name: key, tasks: [] });
      groupMap.get(key).tasks.push(t);
    });
    return [...groupMap.values()];
  }

  function handleCatRowClick(cat) {
    setExpandedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  }

  function handleCadenceRowClick(cat, freq) {
    const key = `${cat}-${freq}`;
    setExpandedCadences(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function handleGroupRowClick(group) {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(group.name) ? n.delete(group.name) : n.add(group.name); return n; });
  }

  function selectAllCat(cat) {
    const allIds = tasks.filter(t => t.category === cat).map(t => t.id);
    const allSelected = allIds.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => { const n = new Set(prev); allSelected ? allIds.forEach(id => n.delete(id)) : allIds.forEach(id => n.add(id)); return n; });
  }

  function selectAllLeaf(cat, freq) {
    const ids = tasksInLeaf(cat, freq).map(t => t.id);
    const allSelected = ids.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => { const n = new Set(prev); allSelected ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id)); return n; });
  }

  function selectAllGroup(group) {
    const ids = group.tasks.map(t => t.id);
    const allSelected = ids.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => { const n = new Set(prev); allSelected ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id)); return n; });
  }

  function getScopedGroups() {
    const scoped = tasks.filter(t => selectedTaskIds.has(t.id));
    const groupMap = new Map();
    scoped.forEach(t => {
      const key = t.group_name || t.title;
      if (!groupMap.has(key)) groupMap.set(key, { name: key, category: t.category, frequency: t.frequency, tasks: [] });
      groupMap.get(key).tasks.push(t);
    });
    return [...groupMap.values()];
  }

  function toggleGroup(group) {
    const ids = group.tasks.map(t => t.id);
    const allSelected = ids.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  function toggleTask(id) {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function loadOccurrences(rangesOverride) {
    const rangesToUse = rangesOverride || dateRanges;
    const ranges = Object.values(rangesToUse).filter(r => r?.start && r?.end);
    if (!ranges.length || !selectedTaskIds.size) return;
    const start = ranges.map(r => r.start).sort()[0];
    const end = ranges.map(r => r.end).sort().reverse()[0];
    const ids = [...selectedTaskIds].join(',');
    setOccsLoading(true);
    const data = await fetch(`${API}/api/tasks2/occurrences?taskIds=${ids}&start=${start}&end=${end}`)
      .then(r => r.json()).catch(() => []);
    setOccs(data);
    setCheckedIds(new Set(data.map(o => o.id)));
    setOccsLoading(false);
    setStep(5);
  }

  async function loadPreview() {
    if (!checkedIds.size || !assigneeIds.length) return;
    setPreviewLoading(true);
    const data = await fetch(`${API}/api/tasks2/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assigneeIds, rotateEvery,
        occurrenceIds: [...checkedIds],
        taskIds: [...selectedTaskIds],
        dryRun: true,
      }),
    }).then(r => r.json()).catch(() => null);
    setPreview(data?.preview || []);
    setPreviewLoading(false);
    setStep(6);
  }

  async function submitAssignment() {
    setSubmitting(true);
    await fetch(`${API}/api/tasks2/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assigneeIds, rotateEvery,
        occurrenceIds: [...checkedIds],
        taskIds: [...selectedTaskIds],
        dryRun: false,
      }),
    }).catch(() => {});
    setSubmitting(false);
    setSubmitDone(true);
  }

  function resetWizard() {
    setStep(1); setExpandedCats(new Set()); setExpandedCadences(new Set());
    setSelectedTaskIds(new Set()); setExpandedGroups(new Set());
    setAssigneeIds([]); setRotateEvery(1);
    setDateRanges({}); setFreqSubStep(0); setApplyAllAsked(false);
    setOccs([]); setCheckedIds(new Set()); setPreview(null); setSubmitDone(false);
  }

  function hasVacation(profileId) {
    const t = today();
    return vacations.some(v => v.requested_by === profileId && v.end_date >= t);
  }

  function profileName(id) {
    return profiles.find(p => p.id === id)?.full_name || id;
  }

  // ── Assigned Tasks log helpers ────────────────────────────────────────────

  async function loadAssignedTasks(from, to) {
    setAssignedLoading(true);
    const { data } = await supabase
      .from('task_occurrences')
      .select('id, due_date, status, assigned_to, completed_at, notes, task_def:tasks_definitions(id, title, category, frequency, group_name), assignee:profiles!assigned_to(id, full_name)')
      .gte('due_date', from)
      .lte('due_date', to)
      .order('due_date');
    setAssignedOccs(data || []);
    setAssignedLoading(false);
  }

  async function saveAssignment(occId) {
    setEditSaving(true);
    const newAssignee = editAssigneeId || null;
    await supabase
      .from('task_occurrences')
      .update({ assigned_to: newAssignee, status: newAssignee ? 'assigned' : 'unassigned' })
      .eq('id', occId);
    const assigneeProfile = profiles.find(p => p.id === newAssignee);
    setAssignedOccs(prev => prev.map(o => o.id !== occId ? o : {
      ...o,
      assigned_to: newAssignee,
      assignee: newAssignee && assigneeProfile ? { id: newAssignee, full_name: assigneeProfile.full_name } : null,
      status: newAssignee ? 'assigned' : 'unassigned',
    }));
    setEditingOccId(null);
    setEditSaving(false);
  }

  async function sendReminder(occId) {
    setRemindingId(occId);
    try {
      await fetch(`${API}/tasks2/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrenceId: occId }),
      });
      setRemindedIds(p => new Set([...p, occId]));
      setTimeout(() => setRemindedIds(p => { const n = new Set(p); n.delete(occId); return n; }), 3000);
      // Track PM reminder count
      setPmReminders(prev => {
        const updated = { ...prev, [occId]: (prev[occId] || 0) + 1 };
        localStorage.setItem('lab_pm_reminders', JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.error('Reminder failed', e);
    }
    setRemindingId(null);
  }

  async function loadReport(period, from, to) {
    setReportLoading(true);
    const today = new Date().toISOString().split('T')[0];
    let qFrom = from, qTo = to;
    if (period === '30d') {
      qFrom = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      qTo = today;
    } else if (period === 'all') {
      qFrom = '2020-01-01';
      qTo = '2099-12-31';
    }
    const { data } = await supabase
      .from('task_occurrences')
      .select('id, due_date, status, completed_at, assigned_to')
      .not('assigned_to', 'is', null)
      .gte('due_date', qFrom)
      .lte('due_date', qTo);
    const todayStr = new Date().toISOString().split('T')[0];
    const byPerson = {};
    (data || []).forEach(occ => {
      if (!byPerson[occ.assigned_to]) byPerson[occ.assigned_to] = [];
      byPerson[occ.assigned_to].push(occ);
    });
    const rows = profiles
      .map(p => {
        const occs = byPerson[p.id] || [];
        if (!occs.length) return null;
        const onTime  = occs.filter(o => o.status === 'done' && o.completed_at && o.completed_at.slice(0, 10) <= o.due_date).length;
        const late    = occs.filter(o => o.status === 'done' && o.completed_at && o.completed_at.slice(0, 10) > o.due_date).length;
        const missed  = occs.filter(o => o.status !== 'done' && o.due_date < todayStr).length;
        const pending = occs.filter(o => o.status !== 'done' && o.due_date >= todayStr).length;
        const matured = onTime + late + missed;
        const score   = matured > 0 ? Math.round((onTime + late * 0.5) / matured * 100) : null;
        return { profile: p, total: occs.length, onTime, late, missed, pending, score };
      })
      .filter(Boolean)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    setReportRows(rows);
    setReportLoading(false);
  }

  async function loadProductivity(period) {
    setProdLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    let qFrom, qTo;
    if (period === '30d') {
      qFrom = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      qTo = todayStr;
    } else if (period === 'all') {
      qFrom = '2020-01-01';
      qTo = '2099-12-31';
    } else {
      qFrom = '2020-01-01';
      qTo = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
    }

    const [{ data }, { data: profData }] = await Promise.all([
      supabase
        .from('task_occurrences')
        .select('id, due_date, status, completed_at, assigned_to, task_definition_id, task_def:tasks_definitions(category)')
        .not('assigned_to', 'is', null)
        .gte('due_date', qFrom)
        .lte('due_date', qTo),
      profiles.length === 0
        ? supabase.from('profiles').select('id, full_name, email, role')
        : Promise.resolve({ data: null }),
    ]);

    const allProfiles = (profData && profData.length > 0) ? profData : profiles;
    if (profData && profData.length > 0) setProfiles(profData);

    const RECURRING_CATS = new Set(['MISC', 'PM', 'Equipment']);

    function calcScore(arr) {
      const onTime  = arr.filter(o => o.status === 'done' && o.completed_at && o.completed_at.slice(0,10) <= o.due_date).length;
      const late    = arr.filter(o => o.status === 'done' && o.completed_at && o.completed_at.slice(0,10) > o.due_date).length;
      const missed  = arr.filter(o => o.status !== 'done' && o.due_date < todayStr).length;
      const matured = onTime + late + missed;
      const score   = matured > 0 ? Math.round((onTime + late * 0.5) / matured * 100) : null;
      return { onTime, late, missed, matured, score };
    }

    const byPerson = {};
    (data || []).forEach(occ => {
      if (!byPerson[occ.assigned_to]) byPerson[occ.assigned_to] = [];
      byPerson[occ.assigned_to].push(occ);
    });

    const rows = allProfiles
      .map(p => {
        const occs    = byPerson[p.id] || [];
        const recurring = occs.filter(o => RECURRING_CATS.has(o.task_def?.category));
        const oneOff    = occs.filter(o => !RECURRING_CATS.has(o.task_def?.category));
        const occIds    = new Set(occs.map(o => o.id));
        const pmCount   = Object.entries(pmReminders)
          .filter(([id]) => occIds.has(id))
          .reduce((s, [, c]) => s + c, 0);
        return {
          profile: p,
          recurring: calcScore(recurring),
          oneOff: calcScore(oneOff),
          combined: calcScore(occs),
          pmReminders: pmCount,
        };
      })
      .sort((a, b) => (b.combined.score ?? -1) - (a.combined.score ?? -1));

    setProdRows(rows);
    setProdLoading(false);
  }

  async function loadMyTasks() {
    if (!userId) return;
    setMyTaskLoading(true);
    const [{ data: occs }, { data: oneOffs }] = await Promise.all([
      supabase
        .from('task_occurrences')
        .select('id, due_date, status, completed_at, notes, task_def:tasks_definitions(id, title, category, group_name, frequency, sop_trigger, conditional_text, response_options, sub_tasks, response_type)')
        .eq('assigned_to', userId)
        .order('due_date', { ascending: true }),
      supabase
        .from('sporadic_tasks')
        .select('*, assigner:profiles!assigned_by(full_name)')
        .eq('assigned_to', userId)
        .order('due_date', { ascending: true }),
    ]);
    setMyTaskOccs(occs || []);
    setMyTaskOneOffs(oneOffs || []);
    setMyTaskLoading(false);
  }

  async function loadPersonDetail(profileId) {
    setProdDetailLoading(true);
    setProdDetailTasks([]);
    const { data } = await supabase
      .from('task_occurrences')
      .select('id, due_date, status, completed_at, task_definition_id, task_def:tasks_definitions(title, category, group_name, frequency)')
      .eq('assigned_to', profileId)
      .order('due_date', { ascending: false });
    setProdDetailTasks(data || []);
    setProdDetailLoading(false);
  }

  function renderProductivity() {
    if (prodDetailPerson) return renderPersonDetail();

    const scoreColor = s => s === null ? 'var(--text-muted)' : s >= 90 ? '#22c55e' : s >= 70 ? '#f59e0b' : s >= 50 ? '#f97316' : '#ef4444';

    const periods = [
      { id: 'current', label: 'Currently' },
      { id: '30d',     label: 'Last 30 Days' },
      { id: 'all',     label: 'Since Joining' },
    ];

    const thStyle = { padding: '9px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', whiteSpace: 'nowrap' };
    const thLeftStyle = { ...thStyle, textAlign: 'left' };
    const tdStyle = { padding: '10px 12px', fontSize: 13, textAlign: 'center', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
    const tdLeftStyle = { ...tdStyle, textAlign: 'left' };

    const ScoreCell = ({ stats }) => {
      const { onTime, late, missed, matured, score } = stats;
      const col = scoreColor(score);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: col, lineHeight: 1 }}>{score !== null ? score : '—'}</span>
          {matured > 0 && (
            <div style={{ width: 48, height: 4, borderRadius: 2, background: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ flex: onTime, background: '#22c55e', minWidth: onTime > 0 ? 1 : 0 }} />
              <div style={{ flex: late,   background: '#f59e0b', minWidth: late   > 0 ? 1 : 0 }} />
              <div style={{ flex: missed, background: '#ef4444', minWidth: missed > 0 ? 1 : 0 }} />
            </div>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{score !== null ? '/ 100' : 'no data'}</span>
        </div>
      );
    };

    const CountCell = ({ value, color }) => (
      <span style={{ fontWeight: 600, color: color || 'var(--text-primary)', fontSize: 13 }}>{value}</span>
    );

    return (
      <div>
        {/* Period picker */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {periods.map(({ id, label }) => (
            <button key={id} onClick={() => setProdPeriod(id)}
              style={{ padding: '7px 18px', borderRadius: 20, border: `1.5px solid ${prodPeriod === id ? 'var(--purple-primary)' : 'var(--border)'}`, background: prodPeriod === id ? 'var(--purple-primary)' : 'transparent', color: prodPeriod === id ? '#fff' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Name filter dropdown */}
        {!prodLoading && prodRows.length > 0 && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
            <button
              onClick={() => setProdDropdownOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 180 }}>
              <span style={{ flex: 1, textAlign: 'left' }}>
                {prodSelected.size === 0 ? 'All members' : prodSelected.size === 1 ? fmtName(prodRows.find(r => prodSelected.has(r.profile.id))?.profile.full_name) : `${prodSelected.size} members`}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▼</span>
            </button>
            {prodDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 220 }}>
                <div
                  onClick={() => { setProdSelected(new Set()); setProdDropdownOpen(false); }}
                  style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', fontWeight: prodSelected.size === 0 ? 700 : 400, color: prodSelected.size === 0 ? 'var(--purple-primary)' : 'var(--text-primary)', borderBottom: '1px solid var(--border)', background: prodSelected.size === 0 ? '#f5eefb' : 'transparent' }}>
                  All members
                </div>
                {sortByLast(prodRows, r => r.profile.full_name).map(({ profile }) => {
                  const sel = prodSelected.has(profile.id);
                  return (
                    <div key={profile.id}
                      onClick={() => {
                        const next = new Set(prodSelected);
                        sel ? next.delete(profile.id) : next.add(profile.id);
                        setProdSelected(next);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, cursor: 'pointer', background: sel ? '#f5eefb' : 'transparent', color: sel ? 'var(--purple-primary)' : 'var(--text-primary)', fontWeight: sel ? 600 : 400 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${sel ? 'var(--purple-primary)' : 'var(--border)'}`, background: sel ? 'var(--purple-primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
                      </div>
                      {fmtName(profile.full_name)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {prodLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thLeftStyle, borderRight: '1px solid var(--border)' }} rowSpan={2}>Name</th>
                  <th style={{ ...thStyle, borderRight: '1px solid var(--border)' }} rowSpan={2}>Overall<br />Score</th>
                  <th style={{ ...thStyle, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} colSpan={4}>Recurring Tasks</th>
                  <th style={{ ...thStyle, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} colSpan={4}>One-off Tasks</th>
                  <th style={thStyle} rowSpan={2}>PM<br />Reminders</th>
                </tr>
                <tr>
                  {['Score', 'On Time', 'Late', 'Missed'].map((h, i) => (
                    <th key={`r-${h}`} style={{ ...thStyle, borderRight: i === 3 ? '1px solid var(--border)' : undefined }}>{h}</th>
                  ))}
                  {['Score', 'On Time', 'Late', 'Missed'].map((h, i) => (
                    <th key={`o-${h}`} style={{ ...thStyle, borderRight: i === 3 ? '1px solid var(--border)' : undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prodRows.filter(r => prodSelected.size === 0 || prodSelected.has(r.profile.id)).map(({ profile, recurring, oneOff, combined, pmReminders: pmCount }, idx) => (
                  <tr key={profile.id} style={{ background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)', cursor: 'pointer' }}
                    onClick={() => { setProdDetailPerson({ profile }); loadPersonDetail(profile.id); }}>
                    <td style={{ ...tdLeftStyle, fontWeight: 600, borderRight: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--purple-primary)', textDecoration: 'underline dotted' }}>{fmtName(profile.full_name)}</span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                        {combined.onTime + combined.late + combined.missed + combined.pending} total · click to expand
                      </div>
                    </td>
                    <td style={{ ...tdStyle, borderRight: '1px solid var(--border)' }}>
                      <ScoreCell stats={combined} />
                    </td>
                    <td style={tdStyle}><ScoreCell stats={recurring} /></td>
                    <td style={tdStyle}><CountCell value={recurring.onTime} color="#22c55e" /></td>
                    <td style={tdStyle}><CountCell value={recurring.late}   color="#f59e0b" /></td>
                    <td style={{ ...tdStyle, borderRight: '1px solid var(--border)' }}><CountCell value={recurring.missed} color={recurring.missed > 0 ? '#ef4444' : 'var(--text-muted)'} /></td>
                    <td style={tdStyle}><ScoreCell stats={oneOff} /></td>
                    <td style={tdStyle}><CountCell value={oneOff.onTime} color="#22c55e" /></td>
                    <td style={tdStyle}><CountCell value={oneOff.late}   color="#f59e0b" /></td>
                    <td style={{ ...tdStyle, borderRight: '1px solid var(--border)' }}><CountCell value={oneOff.missed} color={oneOff.missed > 0 ? '#ef4444' : 'var(--text-muted)'} /></td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: pmCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{pmCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderPersonDetail() {
    const today = new Date().toISOString().split('T')[0];

    const classify = occ => {
      if (occ.status !== 'done' && occ.due_date >= today) return 'upcoming';
      if (occ.status === 'done' && occ.completed_at && occ.completed_at.slice(0, 10) <= occ.due_date) return 'green';
      if (occ.status === 'done') return 'yellow';
      return 'red';
    };

    const taskLabel = occ => occ.task_def?.group_name || occ.task_def?.title || '—';

    const periodCutoff = period => {
      if (period === 'all') return '2020-01-01';
      const d = new Date();
      if (period === '30d')  { d.setDate(d.getDate() - 30); }
      if (period === '3mo')  { d.setMonth(d.getMonth() - 3); }
      if (period === '6mo')  { d.setMonth(d.getMonth() - 6); }
      if (period === 'year') { d.setFullYear(d.getFullYear() - 1); }
      return d.toISOString().split('T')[0];
    };

    const historyPeriods = [
      { id: 'all',  label: 'All Time' },
      { id: 'year', label: 'This Year' },
      { id: '6mo',  label: 'Last 6 Months' },
      { id: '3mo',  label: 'Last 3 Months' },
      { id: '30d',  label: 'Last 30 Days' },
    ];

    const STATUS_META = {
      green:  { label: 'On Time',  bg: '#f0fdf4', color: '#22c55e', border: '#86efac' },
      yellow: { label: 'Late',     bg: '#fffbeb', color: '#f59e0b', border: '#fcd34d' },
      red:    { label: 'Missed',   bg: '#fef2f2', color: '#ef4444', border: '#fca5a5' },
    };

    const cutoff = periodCutoff(prodDetailHistoryPeriod);
    const historyTasks = prodDetailTasks
      .filter(o => classify(o) !== 'upcoming' && o.due_date >= cutoff)
      .filter(o => prodDetailColorFilter.size === 0 || prodDetailColorFilter.has(classify(o)));

    const upcomingTasks = prodDetailTasks.filter(o => classify(o) === 'upcoming');

    const threeMoCutoff = periodCutoff('3mo');
    const threeMoTasks  = prodDetailTasks.filter(o => classify(o) !== 'upcoming' && o.due_date >= threeMoCutoff);
    const threeMoGreen  = threeMoTasks.filter(o => classify(o) === 'green');
    const threeMoYellow = threeMoTasks.filter(o => classify(o) === 'yellow');
    const threeMoRed    = threeMoTasks.filter(o => classify(o) === 'red');
    const threeMoTotal  = threeMoTasks.length;
    const pct = n => threeMoTotal > 0 ? Math.round(n / threeMoTotal * 100) : 0;

    const threeMoFiltered = prodDetail3MoFilter === 'green' ? threeMoGreen : prodDetail3MoFilter === 'yellow' ? threeMoYellow : prodDetail3MoFilter === 'red' ? threeMoRed : [];

    const sectionLabel = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 };
    const pill = (active, color, bg, border, label, onClick) => (
      <button onClick={onClick} style={{ padding: '5px 13px', borderRadius: 20, border: `1.5px solid ${active ? border : 'var(--border)'}`, background: active ? bg : 'transparent', color: active ? color : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
    );

    const TaskRow = ({ occ }) => {
      const cls = classify(occ);
      const meta = STATUS_META[cls] || {};
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color || 'var(--border)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskLabel(occ)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{occ.task_def?.category} · {occ.task_def?.frequency}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Due {occ.due_date}</div>
          <div style={{ padding: '2px 9px', borderRadius: 12, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 600, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>{meta.label}</div>
        </div>
      );
    };

    const { profile } = prodDetailPerson;

    return (
      <div>
        {/* Back button + person header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => { setProdDetailPerson(null); setProdDetailTasks([]); setProdDetail3MoFilter(null); setProdDetailColorFilter(new Set()); setProdDetailHistoryPeriod('all'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            ← Back
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtName(profile.full_name)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{prodDetailTasks.length} total task occurrences</div>
          </div>
        </div>

        {prodDetailLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* ── LAST 3 MONTH REVIEW ── */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <div style={sectionLabel}>Last 3 Month Review</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[['green', threeMoGreen], ['yellow', threeMoYellow], ['red', threeMoRed]].map(([key, arr]) => {
                    const m = STATUS_META[key];
                    const active = prodDetail3MoFilter === key;
                    return (
                      <button key={key} onClick={() => setProdDetail3MoFilter(active ? null : key)}
                        style={{ flex: 1, padding: '14px 12px', border: `2px solid ${active ? m.color : m.border}`, borderRadius: 10, background: active ? m.bg : 'var(--bg-card)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                        <div style={{ fontSize: 30, fontWeight: 800, color: m.color, lineHeight: 1 }}>{pct(arr.length)}%</div>
                        <div style={{ fontSize: 12, color: m.color, fontWeight: 600, marginTop: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{arr.length} task{arr.length !== 1 ? 's' : ''}</div>
                        {threeMoTotal > 0 && (
                          <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct(arr.length)}%`, height: '100%', background: m.color, borderRadius: 2 }} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {threeMoTotal === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 8 }}>No completed tasks in the last 3 months.</div>}
              </div>
              {prodDetail3MoFilter && (
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {threeMoFiltered.length === 0
                    ? <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No tasks.</div>
                    : threeMoFiltered.map(occ => <TaskRow key={occ.id} occ={occ} />)}
                </div>
              )}
            </div>

            {/* ── UPCOMING ── */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: 'var(--bg-secondary)', borderBottom: upcomingTasks.length > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={sectionLabel}>Upcoming</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{upcomingTasks.length} task{upcomingTasks.length !== 1 ? 's' : ''} not yet due</div>
              </div>
              {upcomingTasks.length === 0
                ? <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No upcoming tasks.</div>
                : (
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {upcomingTasks.map(occ => (
                      <div key={occ.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--purple-primary)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskLabel(occ)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{occ.task_def?.category} · {occ.task_def?.frequency}</div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Due {occ.due_date}</div>
                        <div style={{ padding: '2px 9px', borderRadius: 12, background: '#f5eefb', color: 'var(--purple-primary)', fontSize: 11, fontWeight: 600, border: '1px solid #d4b8f0', whiteSpace: 'nowrap' }}>Upcoming</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* ── HISTORY ── */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <div style={sectionLabel}>History</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {historyPeriods.map(({ id, label }) => (
                    <button key={id} onClick={() => setProdDetailHistoryPeriod(id)}
                      style={{ padding: '5px 13px', borderRadius: 20, border: `1.5px solid ${prodDetailHistoryPeriod === id ? 'var(--purple-primary)' : 'var(--border)'}`, background: prodDetailHistoryPeriod === id ? 'var(--purple-primary)' : 'transparent', color: prodDetailHistoryPeriod === id ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(STATUS_META).map(([key, m]) => {
                    const active = prodDetailColorFilter.has(key);
                    return pill(active, m.color, m.bg, m.border, m.label, () => {
                      const next = new Set(prodDetailColorFilter);
                      active ? next.delete(key) : next.add(key);
                      setProdDetailColorFilter(next);
                    });
                  })}
                  {prodDetailColorFilter.size > 0 && (
                    <button onClick={() => setProdDetailColorFilter(new Set())} style={{ padding: '5px 10px', borderRadius: 20, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Clear</button>
                  )}
                </div>
              </div>
              {historyTasks.length === 0
                ? <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No tasks for this period / filter.</div>
                : (
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {historyTasks.map(occ => <TaskRow key={occ.id} occ={occ} />)}
                  </div>
                )}
            </div>

          </div>
        )}
      </div>
    );
  }

  function renderMyTasksTab() {
    const today = new Date().toISOString().split('T')[0];

    const classifyOcc = occ => {
      if (occ.status === 'done') return occ.completed_at && occ.completed_at.slice(0, 10) <= occ.due_date ? 'ontime' : 'late';
      if (occ.due_date < today) return 'overdue';
      return 'upcoming';
    };
    const classifyOneOff = t => {
      if (t.status === 'completed') return t.completed_at && t.completed_at.slice(0, 10) <= t.due_date ? 'ontime' : 'late';
      if (t.due_date && t.due_date < today) return 'overdue';
      return 'upcoming';
    };

    const FILTER_OPTIONS = [
      { id: 'all',      label: 'All' },
      { id: 'upcoming', label: 'Upcoming' },
      { id: 'overdue',  label: 'Overdue' },
      { id: 'ontime',   label: 'Completed On Time' },
      { id: 'late',     label: 'Completed Late' },
    ];

    const dateLabel = d => {
      if (!d || d === 'none') return 'No Due Date';
      if (d === today) return 'Today';
      const tom = new Date(); tom.setDate(tom.getDate() + 1);
      if (d === tom.toISOString().split('T')[0]) return 'Tomorrow';
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    };
    const dateIsOverdue = d => d && d !== 'none' && d < today;

    // Build task_def_id → occurrence map
    const occByDefId = {};
    myTaskOccs.forEach(occ => { if (occ.task_def?.id) occByDefId[occ.task_def.id] = occ; });
    const myDefIds = new Set(Object.keys(occByDefId));

    // Completion helpers
    const isTaskComplete = task => {
      const r = vatResponses[task.id]?.response;
      if (!r) return false;
      if (task.sop_trigger && r === 'no' && !sopExceptions[task.id]?.submitted) return false;
      if (!task.sub_tasks?.length) return true;
      const trigger = task.sub_tasks[0]?.trigger || 'always';
      const triggered = trigger === 'always' || (trigger.startsWith('custom:') ? r === trigger.slice(7) : r === trigger);
      return !triggered || task.sub_tasks.every(st => vatResponses[`${task.id}_sub_${st.id}`]?.response === 'checked');
    };
    const isGroupComplete = (groupTasks, groupName) => {
      const isLiveCell = groupName === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time';
      if (isLiveCell) {
        const lcParent = groupTasks.find(t => t.response_type === 'yes_no');
        const lcResp = lcParent ? vatResponses[lcParent.id]?.response : null;
        if (!lcResp) return false;
        if (lcResp === 'no') return true;
        return groupTasks.filter(t => t.response_type === 'checkbox').every(t => vatResponses[t.id]?.response === 'checked');
      }
      return groupTasks.every(t => !myDefIds.has(t.id) || isTaskComplete(t));
    };
    const classifyGroup = g => {
      if (isGroupComplete(g.tasks, g.groupName)) return 'ontime';
      if (g.tasks.some(t => { const occ = occByDefId[t.id]; return occ && occ.status !== 'done' && occ.due_date < today; })) return 'overdue';
      return 'upcoming';
    };

    // Find complete groups from vatTasks that include at least one assigned task
    const myGroupKeys = new Set();
    vatTasks.forEach(t => { if (myDefIds.has(t.id)) myGroupKeys.add(t.group_name || t.title || t.id); });

    // Build ordered group list preserving vatTasks sort_order
    const groupMap = new Map(); // groupKey → { groupName, category, tasks[], dueDate }
    vatTasks.forEach(t => {
      const gKey = t.group_name || t.title || t.id;
      if (!myGroupKeys.has(gKey)) return;
      if (!groupMap.has(gKey)) {
        const groupOccDates = vatTasks
          .filter(vt => (vt.group_name || vt.title || vt.id) === gKey && myDefIds.has(vt.id))
          .map(vt => occByDefId[vt.id]?.due_date).filter(Boolean).sort();
        groupMap.set(gKey, { groupName: t.group_name || '', category: t.category || 'MISC', tasks: [], dueDate: groupOccDates[0] || 'none' });
      }
      groupMap.get(gKey).tasks.push(t);
    });

    // Apply status filter using group-level classification
    const filteredGroups = [...groupMap.values()].filter(g => {
      if (myTaskStatusFilter === 'all') return true;
      return classifyGroup(g) === myTaskStatusFilter;
    });

    // Group by date → category
    const groupsByDate = {};
    filteredGroups.forEach(g => {
      const date = g.dueDate;
      if (!groupsByDate[date]) groupsByDate[date] = {};
      if (!groupsByDate[date][g.category]) groupsByDate[date][g.category] = [];
      groupsByDate[date][g.category].push(g);
    });

    // One-offs: group by date → category
    const oneOffsByDate = {};
    const oneOffDateOrder = [];
    myTaskOneOffs
      .filter(t => myTaskStatusFilter === 'all' || classifyOneOff(t) === myTaskStatusFilter)
      .slice().sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
      .forEach(t => {
        const date = t.due_date || 'none';
        const cat  = t.category || 'General';
        if (!oneOffsByDate[date]) { oneOffsByDate[date] = {}; oneOffDateOrder.push(date); }
        if (!oneOffsByDate[date][cat]) oneOffsByDate[date][cat] = [];
        oneOffsByDate[date][cat].push(t);
      });

    const allDates = [...new Set([...Object.keys(groupsByDate), ...oneOffDateOrder])].sort((a, b) => {
      if (a === 'none') return 1; if (b === 'none') return -1;
      return a.localeCompare(b);
    });

    const overdueCt  = myTaskOccs.filter(o => classifyOcc(o) === 'overdue').length + myTaskOneOffs.filter(t => classifyOneOff(t) === 'overdue').length;
    const upcomingCt = myTaskOccs.filter(o => classifyOcc(o) === 'upcoming').length + myTaskOneOffs.filter(t => classifyOneOff(t) === 'upcoming').length;

    // Render a one-off task card
    const renderOneOffTask = t => {
      const cls = classifyOneOff(t);
      const isDone = cls === 'ontime' || cls === 'late';
      const key = `oneoff-${t.id}`;
      const resp = myTaskResponses[key] || '';
      const notes = myTaskNotes[key] ?? (t.notes || '');
      const toggleResp = () => setMyTaskResponses(p => ({ ...p, [key]: p[key] === 'checked' ? '' : 'checked' }));
      const updateNotes = v => setMyTaskNotes(p => ({ ...p, [key]: v }));
      return (
        <div key={t.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '6px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: '5px', flexShrink: 0, marginTop: '2px' }}>
              <button onClick={toggleResp} style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid', borderColor: resp === 'checked' || isDone ? 'var(--success)' : 'var(--border)', background: resp === 'checked' || isDone ? 'var(--success)' : 'transparent', color: resp === 'checked' || isDone ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CheckCircle size={13} /></button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.5, margin: 0 }}>{t.title}</p>
              {t.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 3 }}>{t.description}</div>}
              {t.assigner?.full_name && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>Assigned by {t.assigner.full_name}</div>}
              {isDone && t.completed_at && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--success)' }}>✓</span> Completed on {new Date(t.completed_at).toLocaleDateString()}
                  {cls === 'late' && <span style={{ color: '#f59e0b', marginLeft: 4 }}>(late)</span>}
                </div>
              )}
              {(resp || isDone) && (
                <textarea value={notes} onChange={e => updateNotes(e.target.value)} placeholder="Notes (optional)" rows={1}
                  style={{ width: '100%', marginTop: '6px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', fontFamily: 'inherit' }} />
              )}
              {t.file_url && <div style={{ marginTop: 6 }}><a href={t.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--purple-primary)', fontWeight: 600 }}>📎 Attachment →</a></div>}
            </div>
          </div>
        </div>
      );
    };

    const isEmpty = allDates.length === 0;

    return (
      <div>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>My Tasks</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            {myProfile?.full_name || 'Your'} assigned tasks — {upcomingCt} upcoming{overdueCt > 0 ? `, ${overdueCt} overdue` : ''}
          </div>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {FILTER_OPTIONS.map(({ id, label }) => (
            <button key={id} onClick={() => setMyTaskStatusFilter(id)}
              style={{ padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${myTaskStatusFilter === id ? 'var(--purple-primary)' : 'var(--border)'}`, background: myTaskStatusFilter === id ? 'var(--purple-primary)' : 'transparent', color: myTaskStatusFilter === id ? '#fff' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {myTaskLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : isEmpty ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No tasks match this filter.</div>
        ) : (
          allDates.map(date => {
            const catMapForDate = groupsByDate[date] || {};
            const oneOffCatMap  = oneOffsByDate[date] || {};
            const allCats = [...new Set([...Object.keys(catMapForDate), ...Object.keys(oneOffCatMap)])].sort();
            if (allCats.length === 0) return null;
            const isOverdue = dateIsOverdue(date);

            return (
              <div key={date} style={{ marginBottom: 32 }}>
                {/* Date header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: isOverdue ? '#ef4444' : 'var(--text-primary)' }}>
                    {dateLabel(date)}
                    {date !== 'none' && <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>}
                  </div>
                  {isOverdue && <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', padding: '2px 8px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10 }}>OVERDUE</span>}
                  <div style={{ flex: 1, height: 2, background: isOverdue ? '#fca5a5' : 'var(--purple-primary)', opacity: 0.25, borderRadius: 1 }} />
                </div>

                {/* Categories */}
                {allCats.map(cat => (
                  <div key={cat} style={{ marginBottom: 20 }}>
                    {allCats.length > 1 && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, paddingLeft: 2 }}>{cat}</div>
                    )}

                    {/* Complete task groups — exact same markup as Tasks tab */}
                    {(catMapForDate[cat] || []).map(({ groupName, tasks: groupTasks }) => {
                      const groupDone = isGroupComplete(groupTasks, groupName);

                      // ── Completed: show only the parent task as a summary ──
                      if (groupDone) {
                        const parentTask = groupTasks.find(t => t.response_type === 'yes_no' || t.response_type === 'yes_no_na') || groupTasks[0];
                        const parentResp = parentTask ? vatResponses[parentTask.id]?.response : null;
                        return (
                          <div key={groupName || 'ungrouped'} style={{ marginBottom: '4px', opacity: 0.8 }}>
                            {groupName && (
                              <div style={{ padding: '12px 2px 6px', borderBottom: '2px solid var(--success)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)' }}>{groupName}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', background: '#EAF7F0', padding: '2px 8px', borderRadius: 10, border: '1px solid #A9DFBF' }}>✓ Completed</span>
                              </div>
                            )}
                            {parentTask && (
                              <div style={{ background: 'var(--bg-card)', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-md)', marginBottom: '6px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px' }}>
                                  <div style={{ display: 'flex', gap: '5px', flexShrink: 0, marginTop: '2px' }}>
                                    {(parentTask.response_type === 'yes_no' || parentTask.response_type === 'yes_no_na') ? (
                                      parentResp === 'yes' ? (
                                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid var(--success)', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={13} /></div>
                                      ) : parentResp === 'no' ? (
                                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid var(--danger)', background: 'var(--danger)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><XCircle size={13} /></div>
                                      ) : (
                                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid var(--success)', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={13} /></div>
                                      )
                                    ) : (
                                      <div style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--success)', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={13} /></div>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through', lineHeight: 1.5, margin: 0 }}>{parentTask.title}</p>
                                    {!groupName && <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: 'var(--success)' }}>✓ Completed</div>}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // ── Incomplete: full group rendering identical to Tasks tab ──
                      const isLiveCellGroup = groupName === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time';
                      const lcParent = isLiveCellGroup ? groupTasks.find(t => t.response_type === 'yes_no') : null;
                      const lcParentResp = lcParent ? vatResponses[lcParent.id]?.response : null;
                      const lcSubTasks = isLiveCellGroup ? groupTasks.filter(t => t.response_type === 'checkbox') : [];
                      const lcAllChecked = lcSubTasks.length > 0 && lcSubTasks.every(t => vatResponses[t.id]?.response === 'checked');

                      return (
                        <div key={groupName || 'ungrouped'} style={{ marginBottom: '4px' }}>
                          {groupName && (
                            <div style={{ padding: '12px 2px 6px', borderBottom: '2px solid var(--purple-primary)', marginBottom: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--purple-primary)' }}>{groupName}</span>
                            </div>
                          )}
                          {groupTasks.map(task => {
                            if (isLiveCellGroup && task.response_type === 'checkbox' && lcParentResp !== 'yes') return null;
                            const resp = vatResponses[task.id];
                            const done = resp?.response === 'yes' || resp?.response === 'checked';
                            if (task.response_type === 'placeholder') {
                              return <div key={task.id} style={{ padding: '8px 14px', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>Tasks to be defined.</div>;
                            }
                            return (
                              <div key={task.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '6px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px' }}>
                                  <div style={{ display: 'flex', gap: '5px', flexShrink: 0, marginTop: '2px' }}>
                                    {(task.response_type === 'yes_no' || task.response_type === 'yes_no_na') ? (
                                      <>
                                        <button onClick={() => handleVatResponse(task.id, resp?.response === 'yes' ? '' : 'yes')} title="Yes" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid', borderColor: resp?.response === 'yes' ? 'var(--success)' : 'var(--border)', background: resp?.response === 'yes' ? 'var(--success)' : 'transparent', color: resp?.response === 'yes' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CheckCircle size={13} /></button>
                                        <button onClick={() => handleVatResponse(task.id, resp?.response === 'no' ? '' : 'no')} title="No" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid', borderColor: resp?.response === 'no' ? 'var(--danger)' : 'var(--border)', background: resp?.response === 'no' ? 'var(--danger)' : 'transparent', color: resp?.response === 'no' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><XCircle size={13} /></button>
                                        {task.response_type === 'yes_no_na' && <button onClick={() => handleVatResponse(task.id, resp?.response === 'na' ? '' : 'na')} style={{ padding: '0 7px', height: '26px', borderRadius: '13px', border: '2px solid', borderColor: resp?.response === 'na' ? 'var(--text-muted)' : 'var(--border)', background: resp?.response === 'na' ? 'var(--text-muted)' : 'transparent', color: resp?.response === 'na' ? 'white' : 'var(--text-muted)', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>N/A</button>}
                                      </>
                                    ) : task.response_type === 'checkbox' ? (
                                      <button onClick={() => handleVatResponse(task.id, resp?.response === 'checked' ? '' : 'checked')} style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', border: '2px solid', borderColor: resp?.response === 'checked' ? 'var(--purple-primary)' : 'var(--border)', background: resp?.response === 'checked' ? 'var(--purple-primary)' : 'transparent', color: resp?.response === 'checked' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CheckCircle size={13} /></button>
                                    ) : (
                                      <label style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                        <Upload size={13} />
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={() => {}} />
                                      </label>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                      <p style={{ fontSize: '13px', color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, margin: 0, flex: 1 }}>{task.title}</p>
                                      <button onClick={() => openTaskDefEditor(task)} title="Edit task" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px 3px', display: 'flex', flexShrink: 0, opacity: 0.5 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}><Pencil size={12} /></button>
                                    </div>
                                    {task.sop_trigger && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '3px', padding: '2px 7px', background: '#FEF0F0', color: 'var(--danger)', borderRadius: '12px', fontSize: '10px', fontWeight: 600 }}><AlertTriangle size={9} /> {task.conditional_text ? <a href={task.conditional_text} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--danger)', textDecoration: 'underline' }}>SOP</a> : 'SOP'}</span>}
                                    {!task.sop_trigger && task.conditional_text && !task.conditional_text.startsWith('http') && (
                                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '3px 0 0', lineHeight: 1.4 }}>{task.conditional_text}</p>
                                    )}
                                    {vatExisting[task.id] && (
                                      <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        <span style={{ color: 'var(--success)' }}>✓</span> Done by {vatExisting[task.id].assignment?.profile?.full_name || '?'} on {new Date(vatExisting[task.id].responded_at).toLocaleDateString()}
                                      </div>
                                    )}
                                    {resp?.response && (
                                      <textarea value={resp?.notes || ''} onChange={e => handleVatNotes(task.id, e.target.value)} placeholder="Notes (optional)" rows={1}
                                        style={{ width: '100%', marginTop: '6px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', fontFamily: 'inherit' }} />
                                    )}
                                    {task.sop_trigger && resp?.response === 'no' && (() => {
                                      const exc = sopExceptions[task.id] || {};
                                      return exc.submitted ? (
                                        <div style={{ marginTop: 8, padding: '8px 12px', background: '#EAF7F0', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: '#27AE60', fontWeight: 500 }}>
                                          ✓ Exception documented and PM notified.
                                        </div>
                                      ) : (
                                        <div style={{ marginTop: 8, padding: '10px 12px', background: '#FFF8F0', border: '1px solid #F5CBA7', borderRadius: 'var(--radius-sm)' }}>
                                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#E67E22', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠ SOP Exception — Action Required</div>
                                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 6 }}>Document the exception, corrective action taken, and upload a photo. This will be sent to PM.</div>
                                          <textarea
                                            value={exc.note || ''}
                                            onChange={e => handleSopNote(task.id, e.target.value)}
                                            placeholder="Describe the exception and corrective action taken…"
                                            rows={2}
                                            style={{ width: '100%', padding: '5px 8px', border: '1px solid #F5CBA7', borderRadius: 'var(--radius-sm)', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white', marginBottom: 6 }}
                                          />
                                          {exc.photoPreview && (
                                            <img src={exc.photoPreview} alt="SOP correction" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 4, marginBottom: 6 }} />
                                          )}
                                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'white', border: '1px solid #F5CBA7', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', color: '#E67E22', fontWeight: 500 }}>
                                              <Upload size={12} /> {exc.photo ? 'Change photo' : 'Upload photo *'}
                                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleSopPhotoSelect(task.id, e.target.files[0])} />
                                            </label>
                                            <button
                                              onClick={() => handleSopSubmit(task)}
                                              disabled={!exc.note?.trim() || !exc.photo || exc.submitting}
                                              style={{ padding: '5px 14px', background: (!exc.note?.trim() || !exc.photo || exc.submitting) ? 'var(--border)' : '#E67E22', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, cursor: (!exc.note?.trim() || !exc.photo || exc.submitting) ? 'default' : 'pointer' }}>
                                              {exc.submitting ? 'Submitting…' : 'Submit to PM'}
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                    {task.sub_tasks && task.sub_tasks.length > 0 && (() => {
                                      const trigger = task.sub_tasks[0]?.trigger || 'always';
                                      if (trigger === 'always') return true;
                                      const mainResp = resp?.response;
                                      if (trigger.startsWith('custom:')) return mainResp === trigger.slice(7);
                                      return mainResp === trigger;
                                    })() && (
                                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                                        {task.sub_tasks.map((st, si) => {
                                          const stKey = `${task.id}_sub_${st.id}`;
                                          const stDone = vatResponses[stKey]?.response === 'checked';
                                          return (
                                            <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                                              <button onClick={() => handleVatResponse(stKey, stDone ? '' : 'checked')} style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${stDone ? 'var(--purple-primary)' : 'var(--border)'}`, background: stDone ? 'var(--purple-primary)' : 'transparent', color: stDone ? 'white' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Check size={11} /></button>
                                              <span style={{ fontSize: 12, color: stDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: stDone ? 'line-through' : 'none' }}>{st.title}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Live Cell group: contextual status messages */}
                          {isLiveCellGroup && !lcParentResp && (
                            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                              Select Yes or No above to continue.
                            </div>
                          )}
                          {isLiveCellGroup && lcParentResp === 'no' && (
                            <div style={{ padding: '10px 14px', background: '#EAF7F0', borderRadius: 'var(--radius-md)', border: '1px solid #A9DFBF', fontSize: '13px', color: '#27AE60', fontWeight: 500, marginTop: '4px' }}>
                              ✓ No new live cell material this week — protocol steps not required.
                            </div>
                          )}
                          {isLiveCellGroup && lcParentResp === 'yes' && !lcAllChecked && (
                            <div style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--danger)', fontWeight: 500, marginTop: '2px' }}>
                              All protocol steps must be confirmed to complete this task.
                            </div>
                          )}
                          {isLiveCellGroup && lcParentResp === 'yes' && lcAllChecked && (
                            <div style={{ padding: '10px 14px', background: '#EAF7F0', borderRadius: 'var(--radius-md)', border: '1px solid #A9DFBF', fontSize: '13px', color: '#27AE60', fontWeight: 500, marginTop: '4px' }}>
                              ✓ All quarantine protocol steps confirmed.
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* One-off tasks within this category */}
                    {(oneOffCatMap[cat] || []).map(t => renderOneOffTask(t))}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    );
  }

  function renderAssignedTab() {
    const today = new Date().toISOString().split('T')[0];
    const members = sortByLast(profiles);

    const assignedList   = assignedOccs.filter(o => o.assigned_to);
    const unassignedList = assignedOccs.filter(o => !o.assigned_to);
    const completed      = assignedList.filter(o => o.status === 'done' || o.completed_at);
    const overdue        = assignedList.filter(o => o.status !== 'done' && !o.completed_at && o.due_date < today);
    const upcoming       = assignedList.filter(o => o.status !== 'done' && !o.completed_at && o.due_date >= today);

    const tableHeader = () => (
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 160px 100px auto', gap: '0 12px', padding: '8px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '4px' }}>
        {['Due date', 'Task', 'Assigned to', 'Status', ''].map(h => (
          <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
        ))}
      </div>
    );

    const renderOccRow = (occ, isUnassignedSection) => {
      const isDone    = occ.status === 'done' || !!occ.completed_at;
      const isOverdue = !isDone && occ.due_date < today;
      const taskDef   = occ.task_def;
      const taskLabel = taskDef?.group_name || taskDef?.title || '—';
      const isEditing = editingOccId === occ.id;
      const freqColor = FREQ_COLORS[taskDef?.frequency] || {};

      const statusChip = isUnassignedSection
        ? { label: 'Unassigned', color: '#7B3FA0', bg: '#F5EEF8' }
        : isDone
          ? { label: 'Done', color: '#27AE60', bg: '#EAF7F0' }
          : isOverdue
            ? { label: 'Overdue', color: '#E74C3C', bg: '#FDEDEC' }
            : { label: 'Upcoming', color: '#2980B9', bg: '#EBF5FB' };

      if (isEditing) {
        return (
          <div key={occ.id} style={{ padding: '12px 14px', background: 'var(--bg-card)', border: '2px solid var(--purple-primary)', borderRadius: 'var(--radius-md)', marginBottom: '4px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div style={{ flexShrink: 0, fontSize: '13px', fontWeight: 600, color: isOverdue ? '#E74C3C' : 'var(--text-primary)' }}>
                {new Date(occ.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskLabel}</div>
                <div style={{ display: 'flex', gap: '5px', marginTop: '2px' }}>
                  {taskDef?.category && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{taskDef.category}</span>}
                  {taskDef?.frequency && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: freqColor.bg || 'var(--bg-secondary)', color: freqColor.text || 'var(--text-muted)', border: `1px solid ${freqColor.border || 'var(--border)'}` }}>{taskDef.frequency}</span>}
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '10px', background: statusChip.bg, color: statusChip.color, flexShrink: 0 }}>{statusChip.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>Assign to:</span>
              <select value={editAssigneeId} onChange={e => setEditAssigneeId(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--purple-primary)', borderRadius: 'var(--radius-md)', fontSize: '13px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}>
                {!isUnassignedSection && <option value="">— Unassign —</option>}
                {isUnassignedSection && <option value="">— Select member —</option>}
                {members.map(m => <option key={m.id} value={m.id}>{fmtName(m.full_name)}</option>)}
              </select>
              <button onClick={() => saveAssignment(occ.id)} disabled={editSaving}
                style={{ padding: '7px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingOccId(null)}
                style={{ padding: '7px 12px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
                Cancel
              </button>
            </div>
          </div>
        );
      }

      const isReminding = remindingId === occ.id;
      const wasReminded = remindedIds.has(occ.id);

      return (
        <div key={occ.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 160px 100px auto', gap: '0 12px', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '4px', boxShadow: 'var(--shadow-sm)', opacity: isDone ? 0.75 : 1 }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: isOverdue ? '#E74C3C' : 'var(--text-primary)' }}>
              {new Date(occ.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {new Date(occ.due_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric' })}
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{taskLabel}</div>
            <div style={{ display: 'flex', gap: '5px', marginTop: '3px', flexWrap: 'wrap' }}>
              {taskDef?.category && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{taskDef.category}</span>}
              {taskDef?.frequency && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: freqColor.bg || 'var(--bg-secondary)', color: freqColor.text || 'var(--text-muted)', border: `1px solid ${freqColor.border || 'var(--border)'}` }}>{taskDef.frequency}</span>}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{fmtName(occ.assignee?.full_name) || '—'}</span>
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '10px', background: statusChip.bg, color: statusChip.color, whiteSpace: 'nowrap' }}>{statusChip.label}</span>
            {isDone && occ.completed_at && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {new Date(occ.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button onClick={() => { setEditingOccId(occ.id); setEditAssigneeId(occ.assigned_to || ''); }}
              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: isUnassignedSection ? '15px' : '13px' }}
              title={isUnassignedSection ? 'Assign' : 'Edit assignee'}>
              {isUnassignedSection ? '+' : '✎'}
            </button>
            {!isUnassignedSection && (
              <button onClick={() => sendReminder(occ.id)} disabled={isReminding || wasReminded}
                title={`Remind ${occ.assignee?.full_name || 'assignee'}`}
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: wasReminded ? '#EAF7F0' : 'transparent', border: `1px solid ${wasReminded ? '#A9DFBF' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', cursor: isReminding ? 'wait' : 'pointer', color: wasReminded ? '#27AE60' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                <Bell size={12} />
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div>
        {/* Date range controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>From</span>
          <input type="date" value={assignedFrom} onChange={e => setAssignedFrom(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>to</span>
          <input type="date" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
          {[
            { label: 'Unassigned', value: unassignedList.length, color: '#7B3FA0', bg: '#F5EEF8' },
            { label: 'Upcoming',   value: upcoming.length,       color: '#2980B9', bg: '#EBF5FB' },
            { label: 'Overdue',    value: overdue.length,        color: '#E74C3C', bg: '#FDEDEC' },
            { label: 'Done',       value: completed.length,      color: '#27AE60', bg: '#EAF7F0' },
          ].map(s => (
            <div key={s.label} style={{ padding: '12px 14px', background: s.bg, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {assignedLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <>
            {/* ── Assigned section ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Assigned</span>
              <span style={{ fontSize: '11px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderRadius: '10px', padding: '1px 8px', border: '1px solid var(--border)' }}>{assignedList.length}</span>
            </div>
            {assignedList.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>No assigned tasks in this date range.</div>
            ) : (
              <div style={{ marginBottom: '28px' }}>
                {tableHeader()}
                {assignedList.map(occ => renderOccRow(occ, false))}
              </div>
            )}

            {/* ── Unassigned section ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Unassigned</span>
              <span style={{ fontSize: '11px', background: unassignedList.length > 0 ? '#F5EEF8' : 'var(--bg-secondary)', color: unassignedList.length > 0 ? '#7B3FA0' : 'var(--text-muted)', borderRadius: '10px', padding: '1px 8px', border: `1px solid ${unassignedList.length > 0 ? '#D7BDE2' : 'var(--border)'}`, fontWeight: unassignedList.length > 0 ? 700 : 400 }}>{unassignedList.length}</span>
            </div>
            {unassignedList.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>All tasks in this range are assigned.</div>
            ) : (
              <div>
                {tableHeader()}
                {unassignedList.map(occ => renderOccRow(occ, true))}
              </div>
            )}
          </>
        )}

        {/* ── Performance Report ─────────────────────────────────────────── */}
        <div style={{ marginTop: 36, paddingTop: 28, borderTop: '2px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Performance Report</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['current', 'Current Range'], ['30d', 'Last 30 Days'], ['all', 'Since Joining']].map(([key, label]) => (
                <button key={key} onClick={() => setReportPeriod(key)}
                  style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${reportPeriod === key ? 'var(--purple-primary)' : 'var(--border)'}`, background: reportPeriod === key ? 'var(--purple-primary)' : 'transparent', color: reportPeriod === key ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {reportLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading report…</div>
          ) : reportRows.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>No assigned tasks found for this period.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {reportRows.map(({ profile, total, onTime, late, missed, pending, score }) => {
                const scoreCol = score === null ? 'var(--text-muted)' : score >= 90 ? '#22c55e' : score >= 70 ? '#f59e0b' : score >= 50 ? '#f97316' : '#ef4444';
                const matured = onTime + late + missed;
                return (
                  <div key={profile.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{total} task{total !== 1 ? 's' : ''} assigned</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: scoreCol, lineHeight: 1 }}>{score !== null ? score : '—'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>/ 100</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 10px', fontSize: 12, marginBottom: matured > 0 ? 10 : 0 }}>
                      <div style={{ color: '#22c55e' }}>✓ On time: <strong>{onTime}</strong></div>
                      <div style={{ color: '#ef4444' }}>✗ Missed: <strong>{missed}</strong></div>
                      <div style={{ color: '#f59e0b' }}>⚠ Late: <strong>{late}</strong></div>
                      <div style={{ color: 'var(--text-muted)' }}>⏳ Pending: <strong>{pending}</strong></div>
                    </div>
                    {matured > 0 && (
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ flex: onTime, background: '#22c55e', minWidth: onTime > 0 ? 2 : 0 }} />
                        <div style={{ flex: late, background: '#f59e0b', minWidth: late > 0 ? 2 : 0 }} />
                        <div style={{ flex: missed, background: '#ef4444', minWidth: missed > 0 ? 2 : 0 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── View All Tasks render ─────────────────────────────────────────────────

  function renderViewAll() {
    if (vatLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;

    const isRecurring = vatCategory === 'MISC' || vatCategory === 'PM';

    const visibleTasks = vatTasks.filter(t =>
      t.frequency === vatFreq && t.category === vatCategory &&
      (vatSearch === '' || t.title.toLowerCase().includes(vatSearch.toLowerCase()))
    );

    const visibleGroups = (() => {
      const map = new Map();
      for (const task of visibleTasks) {
        const key = task.group_name || '';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(task);
      }
      return [...map.entries()];
    })();

    // Live Cell group: checkbox sub-tasks only count when parent answered "yes"
    const liveCellParent = visibleTasks.find(t => t.group_name === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time' && t.response_type === 'yes_no');
    const liveCellParentResp = liveCellParent ? vatResponses[liveCellParent.id]?.response : null;
    const adjustedVisibleTasks = visibleTasks.filter(t =>
      !(t.group_name === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time' && t.response_type === 'checkbox' && liveCellParentResp !== 'yes')
    );
    const completedCount = adjustedVisibleTasks.filter(t => {
      const r = vatResponses[t.id]?.response;
      if (t.group_name === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time' && t.response_type === 'yes_no' && r === 'no') return true;
      return !!r;
    }).length;

    return (
      <div>
        {/* Category selector */}
        <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '3px', marginBottom: '14px', width: 'fit-content' }}>
          {['MISC', 'PM', 'Equipment'].map(cat => (
            <button key={cat} onClick={() => setVatCategory(cat)} style={{ padding: '7px 18px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: '13px', fontWeight: vatCategory === cat ? 600 : 400, background: vatCategory === cat ? 'var(--purple-primary)' : 'transparent', color: vatCategory === cat ? 'white' : 'var(--text-secondary)' }}>
              {cat}
            </button>
          ))}
        </div>

        {/* ── PM / MISC recurring tasks ── */}
        {isRecurring && (
          <>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {ALL_FREQS.map(freq => {
                const c = FREQ_COLORS[freq];
                const count = vatTasks.filter(t => t.frequency === freq && t.category === vatCategory).length;
                if (count === 0) return null;
                return (
                  <button key={freq} onClick={() => setVatFreq(freq)} style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${vatFreq === freq ? c.border : 'var(--border)'}`, background: vatFreq === freq ? c.bg : 'var(--bg-primary)', color: vatFreq === freq ? c.text : 'var(--text-secondary)', fontWeight: vatFreq === freq ? 600 : 400, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={12} />
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    <span style={{ background: vatFreq === freq ? c.text : 'var(--border)', color: vatFreq === freq ? 'white' : 'var(--text-muted)', borderRadius: '10px', padding: '0 6px', fontSize: '10px' }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
                <Search size={14} color="var(--text-muted)" />
                <input value={vatSearch} onChange={e => setVatSearch(e.target.value)} placeholder="Search tasks…" style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <CheckCircle size={13} color="var(--success)" />
                {completedCount} / {adjustedVisibleTasks.length}
              </div>
              <button onClick={() => openTaskDefEditor(null, { category: vatCategory, frequency: vatFreq })} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', border: '1px solid var(--purple-primary)', borderRadius: 'var(--radius-md)', background: 'var(--purple-primary)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Plus size={13} /> Add Task
              </button>
            </div>

            {adjustedVisibleTasks.length > 0 && (
              <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(completedCount / adjustedVisibleTasks.length) * 100}%`, background: 'var(--purple-primary)', transition: 'width 0.3s' }} />
              </div>
            )}

            {visibleTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>No tasks found.</div>
            ) : visibleGroups.map(([groupName, groupTasks]) => {
              const isLiveCellGroup = groupName === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time';
              const lcParent = isLiveCellGroup ? groupTasks.find(t => t.response_type === 'yes_no') : null;
              const lcParentResp = lcParent ? vatResponses[lcParent.id]?.response : null;
              const lcSubTasks = isLiveCellGroup ? groupTasks.filter(t => t.response_type === 'checkbox') : [];
              const lcAllChecked = lcSubTasks.length > 0 && lcSubTasks.every(t => vatResponses[t.id]?.response === 'checked');

              return (
                <div key={groupName || 'ungrouped'} style={{ marginBottom: '4px' }}>
                  {groupName && (
                    <div style={{ padding: '12px 2px 6px', borderBottom: '2px solid var(--purple-primary)', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--purple-primary)' }}>{groupName}</span>
                    </div>
                  )}
                  {groupTasks.map(task => {
                    // Hide Live Cell subtasks unless parent answered "yes"
                    if (isLiveCellGroup && task.response_type === 'checkbox' && lcParentResp !== 'yes') return null;

                    const resp = vatResponses[task.id];
                    const done = resp?.response === 'yes' || resp?.response === 'checked';
                    if (task.response_type === 'placeholder') {
                      return <div key={task.id} style={{ padding: '8px 14px', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>Tasks to be defined.</div>;
                    }
                    return (
                      <div key={task.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '6px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: '5px', flexShrink: 0, marginTop: '2px' }}>
                            {(task.response_type === 'yes_no' || task.response_type === 'yes_no_na') ? (
                              <>
                                <button onClick={() => handleVatResponse(task.id, resp?.response === 'yes' ? '' : 'yes')} title="Yes" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid', borderColor: resp?.response === 'yes' ? 'var(--success)' : 'var(--border)', background: resp?.response === 'yes' ? 'var(--success)' : 'transparent', color: resp?.response === 'yes' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CheckCircle size={13} /></button>
                                <button onClick={() => handleVatResponse(task.id, resp?.response === 'no' ? '' : 'no')} title="No" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid', borderColor: resp?.response === 'no' ? 'var(--danger)' : 'var(--border)', background: resp?.response === 'no' ? 'var(--danger)' : 'transparent', color: resp?.response === 'no' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><XCircle size={13} /></button>
                                {task.response_type === 'yes_no_na' && <button onClick={() => handleVatResponse(task.id, resp?.response === 'na' ? '' : 'na')} style={{ padding: '0 7px', height: '26px', borderRadius: '13px', border: '2px solid', borderColor: resp?.response === 'na' ? 'var(--text-muted)' : 'var(--border)', background: resp?.response === 'na' ? 'var(--text-muted)' : 'transparent', color: resp?.response === 'na' ? 'white' : 'var(--text-muted)', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>N/A</button>}
                              </>
                            ) : task.response_type === 'checkbox' ? (
                              <button onClick={() => handleVatResponse(task.id, resp?.response === 'checked' ? '' : 'checked')} style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', border: '2px solid', borderColor: resp?.response === 'checked' ? 'var(--purple-primary)' : 'var(--border)', background: resp?.response === 'checked' ? 'var(--purple-primary)' : 'transparent', color: resp?.response === 'checked' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CheckCircle size={13} /></button>
                            ) : (
                              <label style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <Upload size={13} />
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={() => {}} />
                              </label>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                              <p style={{ fontSize: '13px', color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, margin: 0, flex: 1 }}>{task.title}</p>
                              <button onClick={() => openTaskDefEditor(task)} title="Edit task" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px 3px', display: 'flex', flexShrink: 0, opacity: 0.5 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}><Pencil size={12} /></button>
                            </div>
                            {task.sop_trigger && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '3px', padding: '2px 7px', background: '#FEF0F0', color: 'var(--danger)', borderRadius: '12px', fontSize: '10px', fontWeight: 600 }}><AlertTriangle size={9} /> {task.conditional_text ? <a href={task.conditional_text} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--danger)', textDecoration: 'underline' }}>SOP</a> : 'SOP'}</span>}
                            {!task.sop_trigger && task.conditional_text && !task.conditional_text.startsWith('http') && (
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '3px 0 0', lineHeight: 1.4 }}>{task.conditional_text}</p>
                            )}
                            {vatExisting[task.id] && (
                              <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span style={{ color: 'var(--success)' }}>✓</span> Done by {vatExisting[task.id].assignment?.profile?.full_name || '?'} on {new Date(vatExisting[task.id].responded_at).toLocaleDateString()}
                              </div>
                            )}
                            {resp?.response && (
                              <textarea value={resp?.notes || ''} onChange={e => handleVatNotes(task.id, e.target.value)} placeholder="Notes (optional)" rows={1}
                                style={{ width: '100%', marginTop: '6px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', fontFamily: 'inherit' }} />
                            )}
                            {task.sop_trigger && resp?.response === 'no' && (() => {
                              const exc = sopExceptions[task.id] || {};
                              return exc.submitted ? (
                                <div style={{ marginTop: 8, padding: '8px 12px', background: '#EAF7F0', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: '#27AE60', fontWeight: 500 }}>
                                  ✓ Exception documented and PM notified.
                                </div>
                              ) : (
                                <div style={{ marginTop: 8, padding: '10px 12px', background: '#FFF8F0', border: '1px solid #F5CBA7', borderRadius: 'var(--radius-sm)' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#E67E22', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠ SOP Exception — Action Required</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 6 }}>Document the exception, corrective action taken, and upload a photo. This will be sent to PM.</div>
                                  <textarea
                                    value={exc.note || ''}
                                    onChange={e => handleSopNote(task.id, e.target.value)}
                                    placeholder="Describe the exception and corrective action taken…"
                                    rows={2}
                                    style={{ width: '100%', padding: '5px 8px', border: '1px solid #F5CBA7', borderRadius: 'var(--radius-sm)', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white', marginBottom: 6 }}
                                  />
                                  {exc.photoPreview && (
                                    <img src={exc.photoPreview} alt="SOP correction" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 4, marginBottom: 6 }} />
                                  )}
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'white', border: '1px solid #F5CBA7', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', color: '#E67E22', fontWeight: 500 }}>
                                      <Upload size={12} /> {exc.photo ? 'Change photo' : 'Upload photo *'}
                                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleSopPhotoSelect(task.id, e.target.files[0])} />
                                    </label>
                                    <button
                                      onClick={() => handleSopSubmit(task)}
                                      disabled={!exc.note?.trim() || !exc.photo || exc.submitting}
                                      style={{ padding: '5px 14px', background: (!exc.note?.trim() || !exc.photo || exc.submitting) ? 'var(--border)' : '#E67E22', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, cursor: (!exc.note?.trim() || !exc.photo || exc.submitting) ? 'default' : 'pointer' }}>
                                      {exc.submitting ? 'Submitting…' : 'Submit to PM'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                            {task.sub_tasks && task.sub_tasks.length > 0 && (() => {
                              const trigger = task.sub_tasks[0]?.trigger || 'always';
                              if (trigger === 'always') return true;
                              const mainResp = resp?.response;
                              if (trigger.startsWith('custom:')) return mainResp === trigger.slice(7);
                              return mainResp === trigger;
                            })() && (
                              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                                {task.sub_tasks.map((st, si) => {
                                  const stKey = `${task.id}_sub_${st.id}`;
                                  const stDone = vatResponses[stKey]?.response === 'checked';
                                  return (
                                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                                      <button onClick={() => handleVatResponse(stKey, stDone ? '' : 'checked')} style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${stDone ? 'var(--purple-primary)' : 'var(--border)'}`, background: stDone ? 'var(--purple-primary)' : 'transparent', color: stDone ? 'white' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Check size={11} /></button>
                                      <span style={{ fontSize: 12, color: stDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: stDone ? 'line-through' : 'none' }}>{st.title}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Live Cell group: contextual status after the parent task */}
                  {isLiveCellGroup && !lcParentResp && (
                    <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                      Select Yes or No above to continue.
                    </div>
                  )}
                  {isLiveCellGroup && lcParentResp === 'no' && (
                    <div style={{ padding: '10px 14px', background: '#EAF7F0', borderRadius: 'var(--radius-md)', border: '1px solid #A9DFBF', fontSize: '13px', color: '#27AE60', fontWeight: 500, marginTop: '4px' }}>
                      ✓ No new live cell material this week — protocol steps not required.
                    </div>
                  )}
                  {isLiveCellGroup && lcParentResp === 'yes' && !lcAllChecked && (
                    <div style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--danger)', fontWeight: 500, marginTop: '2px' }}>
                      All protocol steps must be confirmed to complete this task.
                    </div>
                  )}
                  {isLiveCellGroup && lcParentResp === 'yes' && lcAllChecked && (
                    <div style={{ padding: '10px 14px', background: '#EAF7F0', borderRadius: 'var(--radius-md)', border: '1px solid #A9DFBF', fontSize: '13px', color: '#27AE60', fontWeight: 500, marginTop: '4px' }}>
                      ✓ All quarantine protocol steps confirmed.
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── Equipment checklist ── */}
        {vatCategory === 'Equipment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {EQUIPMENT_MAINTENANCE.map(equip => {
              const equipOpen = vatExpandedEquip.has(equip.id);
              const allFreqDone = equip.frequencies.every(f => isMaintFreqDone(maintChecks, equip, f));
              return (
                <div key={equip.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <button onClick={() => setVatExpandedEquip(p => { const n = new Set(p); n.has(equip.id) ? n.delete(equip.id) : n.add(equip.id); return n; })}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: allFreqDone ? '#EAF7F0' : 'var(--bg-secondary)', border: 'none', cursor: 'pointer', borderBottom: equipOpen ? '1px solid var(--border)' : 'none', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: allFreqDone ? '#27AE60' : 'var(--text-primary)' }}>{equip.name}</span>
                      {allFreqDone && <span style={{ fontSize: '11px', fontWeight: 600, color: '#27AE60', background: '#D5F5E3', padding: '2px 8px', borderRadius: '10px' }}>All complete</span>}
                    </div>
                    <ChevronDown size={16} style={{ transform: equipOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)', flexShrink: 0 }} />
                  </button>

                  {equipOpen && (
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {equip.note && (
                        <div style={{ padding: '10px 12px', background: '#F8F9FA', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                          {equip.note}
                        </div>
                      )}
                      {equip.frequencies.map(freq => {
                        const freqKey = `${equip.id}|${freq.id}`;
                        const freqOpen = vatExpandedFreq.has(freqKey);
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
                            <button onClick={() => setVatExpandedFreq(p => { const n = new Set(p); n.has(freqKey) ? n.delete(freqKey) : n.add(freqKey); return n; })}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: freqDone ? '#EAF7F0' : 'var(--bg-secondary)', border: 'none', cursor: 'pointer', borderBottom: freqOpen ? `1px solid ${freqDone ? '#A9DFBF' : 'var(--border)'}` : 'none', textAlign: 'left', gap: '10px' }}>
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
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${parentDone ? '#27AE60' : 'var(--border)'}`, background: parentDone ? '#27AE60' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          {parentDone && <CheckCircle size={11} color="white" />}
                                        </div>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: parentDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: parentDone ? 'line-through' : 'none', lineHeight: 1.4 }}>{parent.label}</span>
                                      </div>
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
                                                    <button onClick={() => toggleMaintCheck(equip.id, freq.id, freq.resetFreq, parent.id, sub.id, 'Y')} style={{ padding: '2px 9px', borderRadius: '4px', border: `1.5px solid ${val === 'Y' ? '#27AE60' : 'var(--border)'}`, background: val === 'Y' ? '#27AE60' : 'transparent', color: val === 'Y' ? 'white' : 'var(--text-muted)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', lineHeight: 1.4 }}>Y</button>
                                                    <button onClick={() => toggleMaintCheck(equip.id, freq.id, freq.resetFreq, parent.id, sub.id, 'N')} style={{ padding: '2px 9px', borderRadius: '4px', border: `1.5px solid ${val === 'N' ? '#E74C3C' : 'var(--border)'}`, background: val === 'N' ? '#E74C3C' : 'transparent', color: val === 'N' ? 'white' : 'var(--text-muted)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', lineHeight: 1.4 }}>N</button>
                                                  </div>
                                                ) : (
                                                  <button onClick={() => toggleMaintCheck(equip.id, freq.id, freq.resetFreq, parent.id, sub.id, 'done')} style={{ width: '22px', height: '22px', borderRadius: 'var(--radius-sm)', border: `1.5px solid ${val === 'done' ? 'var(--purple-primary)' : 'var(--border)'}`, background: val === 'done' ? 'var(--purple-primary)' : 'transparent', color: val === 'done' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: '1px' }}>
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
      </div>
    );
  }

  // ── Step renders ──────────────────────────────────────────────────────────

  function renderStep1() {
    const tree = buildTree();
    const selBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple-primary)', fontSize: 12, padding: '2px 6px', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' };

    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Select task scope</div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {tree.map((node, ci) => {
            const { cat, freqs: catFreqs } = node;
            const isExpanded = expandedCats.has(cat);
            const cs = catCheckboxState(cat);
            const catTotal = tasks.filter(t => t.category === cat).length;
            const catSel = tasks.filter(t => t.category === cat && selectedTaskIds.has(t.id)).length;

            return (
              <div key={cat} style={{ borderBottom: ci < tree.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {/* Category row — click selects all + expands/collapses */}
                <div onClick={() => handleCatRowClick(cat)}
                  style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 10, cursor: 'pointer', background: cs !== 'unchecked' ? 'rgba(123,63,160,0.03)' : 'var(--bg-primary)', userSelect: 'none' }}>
                  <input type="checkbox" checked={cs === 'checked'}
                    ref={el => { if (el) el.indeterminate = cs === 'indeterminate'; }}
                    onChange={() => {}}
                    style={{ width: 16, height: 16, accentColor: 'var(--purple-primary)', cursor: 'pointer', flexShrink: 0, pointerEvents: 'none' }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
                    {cat}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                      · {catTotal} task{catTotal !== 1 ? 's' : ''}
                    </span>
                    {catSel > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--purple-primary)', fontWeight: 700, marginLeft: 6 }}>
                        · {catSel} selected
                      </span>
                    )}
                  </span>
                  <button onClick={e => { e.stopPropagation(); selectAllCat(cat); }} style={selBtn}>
                    Select all
                  </button>
                </div>

                {/* Cadence rows */}
                {isExpanded && (
                  <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                    {catFreqs.filter(freq => tasksInLeaf(cat, freq).length > 0).map((freq, fi) => {
                      const leafTasks = tasksInLeaf(cat, freq);
                      const selCount = selectedInLeaf(cat, freq).length;
                      const allSel = selCount === leafTasks.length;
                      const someSel = selCount > 0;
                      const cadKey = `${cat}-${freq}`;
                      const isCadExpanded = expandedCadences.has(cadKey);
                      const groups = getGroupsForLeaf(cat, freq);

                      return (
                        <div key={freq} style={{ borderTop: fi > 0 ? '1px solid var(--border)' : 'none' }}>
                          {/* Cadence row */}
                          <div onClick={() => handleCadenceRowClick(cat, freq)}
                            style={{ display: 'flex', alignItems: 'center', padding: '9px 16px 9px 34px', gap: 10, cursor: 'pointer', background: someSel ? 'rgba(123,63,160,0.02)' : 'transparent', userSelect: 'none' }}>
                            <input type="checkbox" checked={allSel}
                              ref={el => { if (el) el.indeterminate = someSel && !allSel; }}
                              onChange={() => {}}
                              style={{ width: 14, height: 14, accentColor: 'var(--purple-primary)', cursor: 'pointer', flexShrink: 0, pointerEvents: 'none' }} />
                            <span style={{ flex: 1, fontSize: 13 }}>
                              {FREQ_LABEL[freq]}
                              <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 12 }}>
                                · {leafTasks.length} task{leafTasks.length !== 1 ? 's' : ''}
                              </span>
                              {selCount > 0 && (
                                <span style={{ color: 'var(--purple-primary)', marginLeft: 6, fontSize: 12, fontWeight: 700 }}>
                                  · {selCount} selected
                                </span>
                              )}
                            </span>
                            <button onClick={e => { e.stopPropagation(); selectAllLeaf(cat, freq); }} style={selBtn}>
                              Select all
                            </button>
                          </div>

                          {/* Group rows */}
                          {isCadExpanded && (
                            <div style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
                              {groups.map((g, gi) => {
                                const gIds = g.tasks.map(t => t.id);
                                const gAllSel = gIds.every(id => selectedTaskIds.has(id));
                                const gSomeSel = gIds.some(id => selectedTaskIds.has(id));
                                const isGExpanded = expandedGroups.has(g.name);

                                return (
                                  <div key={g.name} style={{ borderTop: gi > 0 ? '1px solid var(--border)' : 'none' }}>
                                    {/* Group row */}
                                    <div onClick={() => handleGroupRowClick(g)}
                                      style={{ display: 'flex', alignItems: 'center', padding: '8px 16px 8px 52px', gap: 10, cursor: 'pointer', background: gSomeSel ? 'rgba(123,63,160,0.02)' : 'transparent', userSelect: 'none' }}>
                                      <input type="checkbox" checked={gAllSel}
                                        ref={el => { if (el) el.indeterminate = gSomeSel && !gAllSel; }}
                                        onChange={() => {}}
                                        style={{ width: 13, height: 13, accentColor: 'var(--purple-primary)', cursor: 'pointer', flexShrink: 0, pointerEvents: 'none' }} />
                                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                                        {g.name}
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                                          {g.tasks.length} task{g.tasks.length !== 1 ? 's' : ''}
                                        </span>
                                        {gSomeSel && !gAllSel && (
                                          <span style={{ fontSize: 11, color: 'var(--purple-primary)', fontWeight: 700, marginLeft: 6 }}>
                                            {gIds.filter(id => selectedTaskIds.has(id)).length}/{g.tasks.length}
                                          </span>
                                        )}
                                      </span>
                                      <button onClick={e => { e.stopPropagation(); selectAllGroup(g); }} style={selBtn}>
                                        Select all
                                      </button>
                                    </div>

                                    {/* Individual task rows */}
                                    {isGExpanded && (
                                      <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                                        {g.tasks.map(t => (
                                          <div key={t.id} onClick={() => toggleTask(t.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px 7px 70px', cursor: 'pointer', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
                                            <input type="checkbox" checked={selectedTaskIds.has(t.id)}
                                              onChange={() => {}}
                                              style={{ width: 13, height: 13, accentColor: 'var(--purple-primary)', cursor: 'pointer', flexShrink: 0, pointerEvents: 'none' }} />
                                            <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.title}</span>
                                          </div>
                                        ))}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 13, color: selectedTaskIds.size ? 'var(--purple-primary)' : 'var(--text-muted)', fontWeight: selectedTaskIds.size ? 600 : 400 }}>
            {selectedTaskIds.size > 0 ? `${selectedTaskIds.size} task${selectedTaskIds.size !== 1 ? 's' : ''} selected` : 'No tasks selected — click a row to begin'}
          </span>
          <button onClick={() => setStep(2)} disabled={!selectedTaskIds.size}
            style={{ ...btn('primary'), opacity: selectedTaskIds.size ? 1 : 0.4 }}>
            Next: Review tasks →
          </button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    const groups = getScopedGroups();
    const allIds = groups.flatMap(g => g.tasks.map(t => t.id));
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Task groups</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
              {groups.length} group{groups.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setSelectedTaskIds(new Set(allIds))} style={linkBtn}>Select all</button>
            <button onClick={() => setSelectedTaskIds(new Set())} style={{ ...linkBtn, color: 'var(--text-muted)' }}>Clear</button>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 440, overflowY: 'auto' }}>
          {groups.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No task groups in scope — go back and select at least one cadence
            </div>
          )}
          {groups.map((g, i) => {
            const allSel = g.tasks.every(t => selectedTaskIds.has(t.id));
            const someSel = g.tasks.some(t => selectedTaskIds.has(t.id));
            const expanded = expandedGroups.has(g.name);
            return (
              <div key={g.name} style={{ borderBottom: i < groups.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 10, background: someSel ? 'rgba(123,63,160,0.04)' : 'transparent' }}>
                  <input type="checkbox" checked={allSel}
                    ref={el => { if (el) el.indeterminate = someSel && !allSel; }}
                    onChange={() => toggleGroup(g)}
                    style={{ width: 15, height: 15, accentColor: 'var(--purple-primary)', cursor: 'pointer' }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {g.tasks.length} task{g.tasks.length !== 1 ? 's' : ''} · {FREQ_LABEL[g.frequency?.toLowerCase()] || g.frequency} · {g.category}
                    </span>
                    {someSel && !allSel && (
                      <span style={{ fontSize: 11, color: 'var(--purple-primary)', marginLeft: 8, fontWeight: 700 }}>
                        {g.tasks.filter(t => selectedTaskIds.has(t.id)).length}/{g.tasks.length}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setExpandedGroups(prev => { const n = new Set(prev); n.has(g.name) ? n.delete(g.name) : n.add(g.name); return n; })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '2px 6px', userSelect: 'none' }}>
                    {expanded ? '▲' : '▼'}
                  </button>
                </div>
                {expanded && (
                  <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                    {g.tasks.map(t => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 14px 8px 38px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedTaskIds.has(t.id)} onChange={() => toggleTask(t.id)}
                          style={{ marginTop: 2, accentColor: 'var(--purple-primary)', cursor: 'pointer' }} />
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button onClick={() => setStep(1)} style={btn('ghost')}>← Back</button>
          <button onClick={() => setStep(3)} disabled={!selectedTaskIds.size}
            style={{ ...btn('primary'), opacity: selectedTaskIds.size ? 1 : 0.4 }}>
            Next: Assignees →
          </button>
        </div>
      </div>
    );
  }

  function renderStep3() {
    const members = sortByLast(profiles);
    const available = members.filter(p => !assigneeIds.includes(p.id));
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add assignees</div>
        {/* Selected assignees */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, minHeight: 36 }}>
          {assigneeIds.map(id => {
            const p = profiles.find(x => x.id === id);
            const pto = hasVacation(id);
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(123,63,160,0.1)', borderRadius: 20, border: '1.5px solid var(--purple-primary)' }}>
                {pto && <span title="Has upcoming time away" style={{ fontSize: 11, color: '#f59e0b' }}>⚠</span>}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple-primary)' }}>{fmtName(p?.full_name) || id}</span>
                <button onClick={() => setAssigneeIds(prev => prev.filter(x => x !== id))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple-primary)', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
            );
          })}
          {assigneeIds.length === 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>No assignees selected</span>
          )}
        </div>

        {/* Add from list */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto', marginBottom: 20 }}>
          {available.map(p => {
            const pto = hasVacation(p.id);
            return (
              <button key={p.id} onClick={() => setAssigneeIds(prev => [...prev, p.id])}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                <span style={{ color: 'var(--text-primary)' }}>{fmtName(p.full_name)}</span>
                {pto && <span style={{ fontSize: 11, color: '#f59e0b', marginLeft: 'auto' }}>⚠ has PTO</span>}
              </button>
            );
          })}
          {available.length === 0 && <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>All lab members added</div>}
        </div>

        {/* Rotate every N */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <span style={{ fontSize: 14 }}>Rotate every</span>
          <input type="number" min={1} value={rotateEvery} onChange={e => setRotateEvery(Math.max(1, Number(e.target.value)))}
            style={{ width: 60, padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, textAlign: 'center' }} />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>instance{rotateEvery !== 1 ? 's' : ''} between assignees</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={() => setStep(2)} style={btn('ghost')}>← Back</button>
          <button onClick={() => setStep(4)} disabled={!assigneeIds.length}
            style={{ ...btn('primary'), opacity: assigneeIds.length ? 1 : 0.4 }}>
            Next: Date range →
          </button>
        </div>
      </div>
    );
  }

  function renderStep4() {
    if (!orderedFreqs.length) {
      return (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No tasks selected. Go back and select at least one task.</p>
          <button onClick={() => setStep(3)} style={btn('ghost')}>← Back</button>
        </div>
      );
    }

    const currentFreq = orderedFreqs[freqSubStep];
    const currentRange = dateRanges[currentFreq] || { start: null, end: null };
    const rangeComplete = currentRange.start && currentRange.end;
    const isFirst = freqSubStep === 0;
    const isLast = freqSubStep >= orderedFreqs.length - 1;
    const hasMore = orderedFreqs.length > 1 && isFirst && !applyAllAsked && rangeComplete;

    function setCurrentRange(r) {
      setDateRanges(prev => ({ ...prev, [currentFreq]: r }));
    }

    function applyToAll() {
      const range = dateRanges[orderedFreqs[0]];
      const allRanges = {};
      orderedFreqs.forEach(f => { allRanges[f] = range; });
      setDateRanges(allRanges);
      setApplyAllAsked(true);
      loadOccurrences(allRanges);
    }

    function advanceSubStep() {
      if (isLast) {
        loadOccurrences();
      } else {
        setFreqSubStep(f => f + 1);
        setApplyAllAsked(true);
      }
    }

    return (
      <div>
        {/* Sub-step progress */}
        {orderedFreqs.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {orderedFreqs.map((f, i) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12,
                  background: i === freqSubStep ? 'var(--purple-primary)' : dateRanges[f]?.end ? 'rgba(123,63,160,0.15)' : 'var(--bg-secondary)',
                  color: i === freqSubStep ? '#fff' : dateRanges[f]?.end ? 'var(--purple-primary)' : 'var(--text-muted)',
                  fontWeight: i === freqSubStep ? 700 : 400 }}>
                  {FREQ_LABEL[f]}
                </span>
                {i < orderedFreqs.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{FREQ_LABEL[currentFreq]} date range</div>
        {currentRange.start && currentRange.end && (
          <div style={{ fontSize: 13, color: 'var(--purple-primary)', marginBottom: 12 }}>
            {fmtDate(currentRange.start)} → {fmtDate(currentRange.end)}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          {pickerFor(currentFreq, currentRange, setCurrentRange)}
        </div>

        {/* Apply to all prompt (after first range is set, if more frequencies) */}
        {hasMore && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Apply this range to {orderedFreqs.length - 1} other {orderedFreqs.length - 1 === 1 ? 'frequency' : 'frequencies'}?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={applyToAll} style={btn('primary')}>Apply to all</button>
              <button onClick={() => { setApplyAllAsked(true); setFreqSubStep(1); }} style={btn('outline')}>Set each individually</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={() => { if (freqSubStep > 0) setFreqSubStep(f => f - 1); else setStep(3); }} style={btn('ghost')}>← Back</button>
          {(!hasMore) && (
            <button onClick={advanceSubStep} disabled={!rangeComplete || occsLoading}
              style={{ ...btn('primary'), opacity: rangeComplete && !occsLoading ? 1 : 0.4 }}>
              {occsLoading ? 'Loading…' : isLast ? 'Next: Occurrences →' : `Next: ${FREQ_LABEL[orderedFreqs[freqSubStep + 1]]} →`}
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderStep5() {
    const someChecked = occs.some(o => checkedIds.has(o.id));
    const reassignCount = occs.filter(o => checkedIds.has(o.id) && o.assigned_to).length;

    if (occsLoading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading occurrences…</div>;

    // Group by task, sorted by task name then date within each group
    const taskGroupOrder = [];
    const taskGroupMap = {};
    [...occs].sort((a, b) => {
      const ta = tasks.find(t => t.id === a.task_definition_id);
      const tb = tasks.find(t => t.id === b.task_definition_id);
      const na = ta?.group_name || ta?.title || '';
      const nb = tb?.group_name || tb?.title || '';
      if (na !== nb) return na.localeCompare(nb);
      return a.due_date.localeCompare(b.due_date);
    }).forEach(o => {
      const key = o.task_definition_id;
      if (!taskGroupMap[key]) { taskGroupMap[key] = []; taskGroupOrder.push(key); }
      taskGroupMap[key].push(o);
    });

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{occs.length} occurrence{occs.length !== 1 ? 's' : ''} in range</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setCheckedIds(new Set(occs.map(o => o.id)))} style={linkBtn}>Select all</button>
            <button onClick={() => setCheckedIds(new Set())} style={{ ...linkBtn, color: 'var(--text-muted)' }}>Clear</button>
          </div>
        </div>

        {reassignCount > 0 && (
          <div style={{ background: '#FFF3CD', border: '1px solid #FFC107', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13 }}>
            {reassignCount} selected occurrence{reassignCount !== 1 ? 's' : ''} already have an assignee. Continuing will reassign them.
          </div>
        )}

        {occs.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px solid var(--border)', borderRadius: 10 }}>
            No occurrences found in the selected date range for these tasks.
          </div>
        )}

        {occs.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 420, overflowY: 'auto' }}>
            {taskGroupOrder.map((taskId, gi) => {
              const groupOccs = taskGroupMap[taskId];
              const taskDef = tasks.find(t => t.id === taskId);
              const taskLabel = taskDef?.group_name || taskDef?.title || taskId;
              const allGroupChecked = groupOccs.every(o => checkedIds.has(o.id));
              const someGroupChecked = groupOccs.some(o => checkedIds.has(o.id));

              return (
                <div key={taskId} style={{ borderTop: gi > 0 ? '1px solid var(--border)' : 'none' }}>
                  {/* Task group header */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', background: 'var(--bg-secondary)', gap: 10 }}>
                    <input type="checkbox" checked={allGroupChecked}
                      ref={el => { if (el) el.indeterminate = someGroupChecked && !allGroupChecked; }}
                      onChange={() => {
                        const ids = groupOccs.map(o => o.id);
                        setCheckedIds(prev => {
                          const n = new Set(prev);
                          allGroupChecked ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id));
                          return n;
                        });
                      }}
                      style={{ accentColor: 'var(--purple-primary)', cursor: 'pointer' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{taskLabel}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                      {groupOccs.length} occurrence{groupOccs.length !== 1 ? 's' : ''}
                      {taskDef?.frequency && ` · ${FREQ_LABEL[taskDef.frequency.toLowerCase()] || taskDef.frequency}`}
                    </span>
                  </div>
                  {/* Occurrence rows */}
                  {groupOccs.map((o, i) => {
                    const checked = checkedIds.has(o.id);
                    return (
                      <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px 8px 36px', borderTop: '1px solid var(--border)', cursor: 'pointer', background: checked ? 'rgba(123,63,160,0.03)' : 'transparent' }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setCheckedIds(prev => { const n = new Set(prev); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; })}
                          style={{ accentColor: 'var(--purple-primary)', cursor: 'pointer' }} />
                        <span style={{ fontSize: 13, fontWeight: 500, minWidth: 110 }}>{fmtDate(o.due_date)}</span>
                        <span style={{ fontSize: 12, color: o.assigned_to ? 'var(--text-muted)' : '#9ca3af' }}>
                          {o.assigned_to ? `assigned to ${o.assignee?.full_name || o.assigned_to}` : 'unassigned'}
                        </span>
                        {o.assigned_to && checked && (
                          <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 4 }}>will reassign</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button onClick={() => setStep(4)} style={btn('ghost')}>← Back</button>
          <button onClick={loadPreview} disabled={!someChecked || previewLoading}
            style={{ ...btn('primary'), opacity: someChecked && !previewLoading ? 1 : 0.4 }}>
            {previewLoading ? 'Computing…' : 'Preview rotation →'}
          </button>
        </div>
      </div>
    );
  }

  function renderStep6() {
    if (!preview) return null;
    const unresolvable = preview.filter(r => r.unresolvable);
    const blocked = preview.filter(r => r.blocked);
    const counts = {};
    preview.forEach(r => {
      if (r.assignedTo) counts[r.assignedTo] = (counts[r.assignedTo] || 0) + 1;
    });

    if (submitDone) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Assignments saved</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
            {preview.filter(r => r.assignedTo).length} occurrences assigned across {Object.keys(counts).length} people
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={resetWizard} style={btn('primary')}>Assign more</button>
            <button onClick={() => setTab('calendar')} style={btn('outline')}>View calendar</button>
          </div>
        </div>
      );
    }

    return (
      <div>
        {unresolvable.length > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 13 }}>
            {unresolvable.length} occurrence{unresolvable.length !== 1 ? 's' : ''} skipped — no assignees selected for those tasks.
          </div>
        )}
        {blocked.length > 0 && (
          <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 13 }}>
            {blocked.length} occurrence{blocked.length !== 1 ? 's' : ''} could not be covered — all selected assignees are on PTO on those dates. They will remain unassigned. Add a fallback assignee or adjust the date range.
          </div>
        )}

        {/* Counts footer */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          {Object.entries(counts).map(([id, n]) => (
            <div key={id} style={{ padding: '4px 12px', background: 'rgba(123,63,160,0.08)', borderRadius: 20, fontSize: 13, color: 'var(--purple-primary)', fontWeight: 600 }}>
              {profileName(id)}: {n}
            </div>
          ))}
          {(unresolvable.length + blocked.length) > 0 && (
            <div style={{ padding: '4px 12px', background: '#FEF2F2', borderRadius: 20, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
              Unassigned: {unresolvable.length + blocked.length}
            </div>
          )}
        </div>

        {/* Preview table */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 380, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr 1fr auto', gap: 0 }}>
            {['Date', 'Task', 'Assigned to', 'Previous', ''].map(h => (
              <div key={h} style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>{h}</div>
            ))}
            {preview.map((r, i) => {
              const taskDef = tasks.find(t => t.id === r.task_definition_id);
              const taskLabel = taskDef?.group_name || taskDef?.title || '—';
              return [
                <div key={`d${i}`} style={{ padding: '9px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{fmtDate(r.due_date)}</div>,
                <div key={`k${i}`} style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={taskLabel}>{taskLabel}</div>,
                <div key={`a${i}`} style={{ padding: '9px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', color: (r.unresolvable || r.blocked) ? '#9ca3af' : 'var(--text-primary)' }}>
                  {(r.unresolvable || r.blocked) ? '—' : profileName(r.assignedTo)}
                </div>,
                <div key={`p${i}`} style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                  {r.previousAssigneeName || '—'}
                </div>,
                <div key={`t${i}`} style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {r.autoReassigned && <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>auto-rotated</span>}
                  {r.previousAssignee && r.assignedTo !== r.previousAssignee && <span style={{ fontSize: 10, background: '#EDE9FE', color: '#5B21B6', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>reassigned</span>}
                  {r.blocked && <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>all on PTO</span>}
                  {r.unresolvable && <span style={{ fontSize: 10, background: '#FEE2E2', color: '#991B1B', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>no assignees</span>}
                </div>,
              ];
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button onClick={() => setStep(5)} style={btn('ghost')}>← Back</button>
          <button onClick={submitAssignment} disabled={submitting} style={{ ...btn('primary'), opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Saving…' : `Confirm & save ${preview.filter(r => r.assignedTo).length} assignments`}
          </button>
        </div>
      </div>
    );
  }

  // ── Calendar tab ──────────────────────────────────────────────────────────

  function renderCalendar() {
    const firstDow = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const todayStr = today();

    const byDate = {};
    calData.forEach(o => { if (!byDate[o.due_date]) byDate[o.due_date] = []; byDate[o.due_date].push(o); });

    const unassignedCount = calData.filter(o => o.status === 'unassigned').length;

    const cells = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    const selectedDayOccs = selectedDay ? (byDate[selectedDay] || []) : [];

    return (
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Grid */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={() => { if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
              style={{ ...btn('ghost'), padding: '6px 12px' }}>←</button>
            <span style={{ fontSize: 18, fontWeight: 700, minWidth: 160, textAlign: 'center' }}>
              {MONTHS_FULL[calMonth - 1]} {calYear}
            </span>
            <button onClick={() => { if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
              style={{ ...btn('ghost'), padding: '6px 12px' }}>→</button>
          </div>

          {/* Banner */}
          {unassignedCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF3CD', border: '1px solid #FFC107', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13 }}>
              <span>{unassignedCount} unassigned occurrence{unassignedCount !== 1 ? 's' : ''} this month</span>
              <button onClick={() => setTab('unassigned')} style={{ ...linkBtn, fontSize: 12 }}>Review →</button>
            </div>
          )}

          {calLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: 1 }}>{d}</div>
                ))}
              </div>
              {/* Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={`e${i}`} style={{ minHeight: 72, background: 'var(--bg-secondary)', borderRadius: 6 }} />;
                  const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const dayOccs = byDate[dateStr] || [];
                  const isToday = dateStr === todayStr;
                  const isSelected = selectedDay === dateStr;

                  const statuses = dayOccs.map(o => occStatus(o));
                  const hasDone = statuses.includes('done');
                  const hasLate = statuses.includes('late');
                  const hasPending = statuses.includes('pending');
                  const hasUnassigned = statuses.includes('unassigned');

                  return (
                    <div key={dateStr} onClick={() => dayOccs.length && setSelectedDay(isSelected ? null : dateStr)}
                      style={{
                        minHeight: 72, padding: 6, borderRadius: 6, cursor: dayOccs.length ? 'pointer' : 'default',
                        background: isSelected ? 'rgba(123,63,160,0.12)' : 'var(--bg-primary)',
                        border: isToday ? '2px solid var(--purple-primary)' : isSelected ? '2px solid rgba(123,63,160,0.4)' : '1px solid var(--border)',
                      }}>
                      <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--purple-primary)' : 'var(--text-primary)', marginBottom: 4 }}>{day}</div>
                      {dayOccs.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                          {hasUnassigned && <div style={{ width: 7, height: 7, borderRadius: '50%', border: '1.5px solid #9ca3af' }} />}
                          {hasLate && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />}
                          {hasPending && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />}
                          {hasDone && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />}
                          {dayOccs.length > 1 && <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>×{dayOccs.length}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                {[['Done','#22c55e'],['Pending','#f59e0b'],['Late','#ef4444']].map(([l, c]) => (
                  <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
                  </span>
                ))}
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid #9ca3af', display: 'inline-block' }} />Unassigned
                </span>
              </div>
            </>
          )}
        </div>

        {/* Day detail panel */}
        {selectedDay && (
          <div style={{ width: 280, flexShrink: 0 }}>
            <div style={{ ...card, padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{fmtDate(selectedDay)}</div>
              {selectedDayOccs.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No occurrences</div>
              )}
              {selectedDayOccs.map(o => {
                const st = occStatus(o);
                const stColors = { done: '#22c55e', pending: '#f59e0b', late: '#ef4444', unassigned: '#9ca3af' };
                return (
                  <div key={o.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>
                      {o.task?.title || o.task_definition_id}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${stColors[st]}22`, color: stColors[st], fontWeight: 700, textTransform: 'capitalize' }}>{st}</span>
                      {o.assignee?.full_name
                        ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.assignee.full_name}</span>
                        : <span style={{ fontSize: 12, color: '#9ca3af' }}>No assignee</span>}
                    </div>
                    {st === 'unassigned' && (
                      <button onClick={() => { setQuickAssign({ occurrenceId: o.id, task: o.task, task_definition_id: o.task_definition_id, due_date: o.due_date }); setQaStart(o.due_date); setQaEnd(''); setQaAssignees([]); setQaPreview(null); setQaDone(false); }}
                        style={{ ...btn('outline'), padding: '4px 10px', fontSize: 12, marginTop: 6 }}>
                        Assign
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Unassigned tab ────────────────────────────────────────────────────────

  // eslint-disable-next-line no-unused-vars
  function renderUnassigned() {
    const byCatFreq = {};
    unassigned.forEach(o => {
      const cat = o.task?.category || 'MISC';
      const freq = o.task?.frequency?.toLowerCase() || 'monthly';
      if (!byCatFreq[cat]) byCatFreq[cat] = {};
      if (!byCatFreq[cat][freq]) byCatFreq[cat][freq] = [];
      byCatFreq[cat][freq].push(o);
    });

    const urgencyColor = (days) => days <= 3 ? '#ef4444' : days <= 14 ? '#f59e0b' : 'var(--text-muted)';

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {unassigned.length} gap{unassigned.length !== 1 ? 's' : ''} within lookahead windows
          </div>
          <button onClick={loadUnassigned} style={{ ...btn('ghost'), padding: '5px 12px', fontSize: 12 }}>Refresh</button>
        </div>

        {uLoading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>}

        {!uLoading && unassigned.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No coverage gaps</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>All upcoming occurrences are assigned within their lookahead windows</div>
          </div>
        )}

        {CAT_ORDER.filter(cat => byCatFreq[cat]).map(cat => (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-primary)', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
              {cat}
            </div>
            {FREQ_ORDER.filter(f => byCatFreq[cat]?.[f]?.length > 0).map(f => (
              <div key={f} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {FREQ_LABEL[f]} — {LOOKAHEAD[f] || 90}-day window
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {byCatFreq[cat][f].map((o, i) => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < byCatFreq[cat][f].length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.task?.title || o.task_definition_id}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {o.lastAssignedThrough ? `Last assigned through ${fmtDate(o.lastAssignedThrough)}` : 'Never assigned'}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: urgencyColor(o.daysUntilDue), whiteSpace: 'nowrap' }}>
                        {o.daysUntilDue === 0 ? 'Due today' : o.daysUntilDue === 1 ? 'Due tomorrow' : `Due in ${o.daysUntilDue}d`}
                      </div>
                      <button onClick={() => { setQuickAssign({ occurrenceId: o.id, task: o.task, task_definition_id: o.task_definition_id, due_date: o.due_date }); setQaStart(o.due_date); setQaEnd(''); setQaAssignees([]); setQaPreview(null); setQaDone(false); }}
                        style={{ ...btn('outline'), padding: '5px 12px', fontSize: 12 }}>
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ── Quick-assign modal ────────────────────────────────────────────────────

  async function loadQaPreview() {
    if (!qaAssignees.length || !qaStart) return;
    // Fetch occurrences for this task from qaStart to qaEnd (or far future if open-ended)
    const end = qaEnd || (() => { const d = new Date(qaStart); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0]; })();
    const data = await fetch(`${API}/api/tasks2/occurrences?taskIds=${quickAssign.task_definition_id || quickAssign.task?.id}&start=${qaStart}&end=${end}`)
      .then(r => r.json()).catch(() => []);
    const ids = data.map(o => o.id);
    if (!ids.length) { setQaPreview({ preview: [] }); return; }
    const prev = await fetch(`${API}/api/tasks2/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeIds: qaAssignees, rotateEvery: 1, occurrenceIds: ids, taskIds: [quickAssign.task_definition_id || quickAssign.task?.id], dryRun: true }),
    }).then(r => r.json()).catch(() => null);
    setQaPreview(prev);
  }

  async function submitQa() {
    if (!qaPreview?.preview?.length) return;
    setQaSubmitting(true);
    const end = qaEnd || (() => { const d = new Date(qaStart); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0]; })();
    const data = await fetch(`${API}/api/tasks2/occurrences?taskIds=${quickAssign.task_definition_id || quickAssign.task?.id}&start=${qaStart}&end=${end}`)
      .then(r => r.json()).catch(() => []);
    await fetch(`${API}/api/tasks2/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeIds: qaAssignees, rotateEvery: 1, occurrenceIds: data.map(o => o.id), taskIds: [quickAssign.task_definition_id || quickAssign.task?.id], dryRun: false }),
    }).catch(() => {});
    setQaSubmitting(false);
    setQaDone(true);
    loadUnassigned();
    if (tab === 'calendar') loadCalendar();
  }

  async function loadOneOffTab() {
    setOneOffLoading(true);
    const { data } = await supabase
      .from('sporadic_tasks')
      .select('*, assignee:profiles!assigned_to(id, full_name)')
      .order('created_at', { ascending: false });
    setOneOffTasks(data || []);
    setOneOffLoading(false);
  }

  async function handleCreateOneOff() {
    if (!oneOffForm.title.trim() || !oneOffForm.dueDate || oneOffForm.assigneeIds.length === 0) {
      setOneOffError('Please enter a title, due date, and assign to at least one person.');
      return;
    }
    setOneOffSaving(true);
    setOneOffError('');
    const rows = oneOffForm.assigneeIds.map(uid => ({
      title: oneOffForm.title.trim(),
      assigned_to: uid,
      due_date: oneOffForm.dueDate,
      show_on_public_dashboard: oneOffForm.showOnPublic,
      status: 'pending',
      category: 'MISC',
    }));
    const { error: insertErr } = await supabase.from('sporadic_tasks').insert(rows);
    if (insertErr) {
      setOneOffError(insertErr.message);
      setOneOffSaving(false);
      return;
    }
    setOneOffForm({ title: '', assigneeIds: [], dueDate: '', showOnPublic: false });
    setOneOffSaving(false);
    loadOneOffTab();
  }

  async function handleOneOffToggleDone(task) {
    const isDone = task.status === 'done';
    const update = isDone
      ? { status: 'pending', completed_at: null }
      : { status: 'done', completed_at: new Date().toISOString() };
    setOneOffTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...update } : t));
    await supabase.from('sporadic_tasks').update(update).eq('id', task.id);
  }

  async function handleOneOffDelete(id) {
    setConfirmDeleteOneOff(null);
    setOneOffTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from('sporadic_tasks').delete().eq('id', id);
  }

  function renderOneOffTab() {
    const todayStr = today();
    const pending = oneOffTasks.filter(t => t.status !== 'done');
    const done = oneOffTasks.filter(t => t.status === 'done');

    return (
      <div>
        {/* Create form */}
        <div style={{ marginBottom: 24, padding: 20, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Create One-off Task</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Title</label>
              <input
                value={oneOffForm.title}
                onChange={e => setOneOffForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Task title"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Due Date</label>
              <input
                type="date"
                value={oneOffForm.dueDate}
                onChange={e => setOneOffForm(p => ({ ...p, dueDate: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
              <input
                type="checkbox"
                id="one-off-public"
                checked={oneOffForm.showOnPublic}
                onChange={e => setOneOffForm(p => ({ ...p, showOnPublic: e.target.checked }))}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--purple-primary)' }}
              />
              <label htmlFor="one-off-public" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Globe size={13} color="var(--purple-primary)" /> Show on public dashboard
              </label>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Assign To</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profiles.map(p => {
                const selected = oneOffForm.assigneeIds.includes(p.id);
                return (
                  <button key={p.id} onClick={() => setOneOffForm(prev => ({
                    ...prev,
                    assigneeIds: selected ? prev.assigneeIds.filter(id => id !== p.id) : [...prev.assigneeIds, p.id],
                  }))} style={{
                    padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: selected ? 600 : 400, cursor: 'pointer',
                    border: `1.5px solid ${selected ? 'var(--purple-primary)' : 'var(--border)'}`,
                    background: selected ? 'var(--purple-faint)' : 'transparent',
                    color: selected ? 'var(--purple-primary)' : 'var(--text-secondary)',
                  }}>
                    {selected && <Check size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                    {p.full_name}
                  </button>
                );
              })}
            </div>
          </div>
          {oneOffError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{oneOffError}</div>}
          <button onClick={handleCreateOneOff} disabled={oneOffSaving} style={{ ...btn('primary'), display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> {oneOffSaving ? 'Creating…' : 'Create Task'}
          </button>
        </div>

        {/* Task list */}
        {oneOffLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <>
            {pending.length === 0 && done.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>No one-off tasks yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[...pending, ...done].map(task => {
                  const isDone = task.status === 'done';
                  const overdue = !isDone && task.due_date && task.due_date < todayStr;
                  const isConfirmDelete = confirmDeleteOneOff === task.id;
                  return (
                    <div key={task.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)',
                      opacity: isDone ? 0.55 : 1,
                    }}>
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => handleOneOffToggleDone(task)}
                        style={{ width: 15, height: 15, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--purple-primary)' }}
                      />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                        {task.title}
                      </span>
                      {task.assignee?.full_name && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{task.assignee.full_name}</span>
                      )}
                      {task.show_on_public_dashboard && (
                        <Globe size={12} color="var(--purple-primary)" style={{ flexShrink: 0 }} title="Visible on public dashboard" />
                      )}
                      {task.due_date && (
                        <span style={{ fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {fmtDate(task.due_date)}
                        </span>
                      )}
                      {overdue && <AlertTriangle size={11} color="var(--danger)" style={{ flexShrink: 0 }} />}
                      {isConfirmDelete ? (
                        <>
                          <button onClick={() => handleOneOffDelete(task.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Confirm</button>
                          <button onClick={() => setConfirmDeleteOneOff(null)} style={{ fontSize: 11, padding: '3px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDeleteOneOff(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function renderQuickAssignModal() {
    if (!quickAssign) return null;
    const taskId = quickAssign.task_definition_id || quickAssign.task?.id;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={e => { if (e.target === e.currentTarget) setQuickAssign(null); }}>
        <div style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: 28, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Quick assign</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.4 }}>
            {quickAssign.task?.title || taskId}
          </div>

          {qaDone ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Assigned</div>
              <button onClick={() => setQuickAssign(null)} style={{ ...btn('primary'), marginTop: 16 }}>Done</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Assignees</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {qaAssignees.map(id => {
                    const p = profiles.find(x => x.id === id);
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(123,63,160,0.1)', borderRadius: 16, border: '1.5px solid var(--purple-primary)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--purple-primary)' }}>{p?.full_name}</span>
                        <button onClick={() => setQaAssignees(prev => prev.filter(x => x !== id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple-primary)', fontSize: 13, lineHeight: 1 }}>×</button>
                      </div>
                    );
                  })}
                </div>
                <select onChange={e => { if (e.target.value) setQaAssignees(prev => prev.includes(e.target.value) ? prev : [...prev, e.target.value]); e.target.value = ''; }}
                  style={{ padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
                  <option value="">Add assignee…</option>
                  {profiles.filter(p => !qaAssignees.includes(p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <label style={{ fontSize: 13, flex: 1 }}>
                  <span style={{ color: 'var(--text-muted)' }}>From</span>
                  <input type="date" value={qaStart} onChange={e => { setQaStart(e.target.value); setQaPreview(null); }}
                    style={{ display: 'block', marginTop: 4, width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)' }} />
                </label>
                <label style={{ fontSize: 13, flex: 1 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Through (optional)</span>
                  <input type="date" value={qaEnd} min={qaStart} onChange={e => { setQaEnd(e.target.value); setQaPreview(null); }}
                    style={{ display: 'block', marginTop: 4, width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)' }} />
                </label>
              </div>

              {qaPreview && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
                  {qaPreview.preview?.length === 0
                    ? <span style={{ color: 'var(--text-muted)' }}>No occurrences in this range</span>
                    : <span><strong>{qaPreview.preview.filter(r => r.assignedTo).length}</strong> occurrence{qaPreview.preview.length !== 1 ? 's' : ''} will be assigned</span>}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={loadQaPreview} disabled={!qaAssignees.length || !qaStart}
                  style={{ ...btn('outline'), opacity: qaAssignees.length && qaStart ? 1 : 0.4 }}>
                  Preview
                </button>
                <button onClick={submitQa} disabled={!qaPreview?.preview?.length || qaSubmitting}
                  style={{ ...btn('primary'), opacity: qaPreview?.preview?.length && !qaSubmitting ? 1 : 0.4 }}>
                  {qaSubmitting ? 'Saving…' : 'Confirm'}
                </button>
                <button onClick={() => setQuickAssign(null)} style={{ ...btn('ghost'), marginLeft: 'auto' }}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Step indicator ────────────────────────────────────────────────────────

  function renderStepIndicator() {
    const steps = ['Scope', 'Tasks', 'Assignees', 'Date range', 'Occurrences', 'Preview'];
    return (
      <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
        {steps.map((s, i) => {
          const n = i + 1;
          const done = step > n;
          const active = step === n;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? '#22c55e' : active ? 'var(--purple-primary)' : 'var(--border)',
                  color: done || active ? '#fff' : 'var(--text-muted)',
                  marginBottom: 4,
                }}>{done ? '✓' : n}</div>
                <span style={{ fontSize: 11, color: active ? 'var(--purple-primary)' : 'var(--text-muted)', fontWeight: active ? 700 : 400 }}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? '#22c55e' : 'var(--border)', margin: '0 4px', marginBottom: 18 }} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  if (dataLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
      Loading…
    </div>
  );

  const myTaskOverdueCt = myTaskOccs.filter(o => {
    const today = new Date().toISOString().split('T')[0];
    return o.status !== 'done' && o.due_date < today;
  }).length + myTaskOneOffs.filter(t => {
    const today = new Date().toISOString().split('T')[0];
    return t.status !== 'completed' && t.due_date && t.due_date < today;
  }).length;

  const tabs = [
    { id: 'view-all',     label: 'Tasks' },
    { id: 'oneoff',       label: 'One-off Tasks' },
    { id: 'calendar',     label: 'Calendar' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'assigned',     label: 'Insights', badge: unassignedCount || null },
    { id: 'my-tasks',     label: 'My Tasks', badge: myTaskOverdueCt || null },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Task assignment</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Recurring tasks · admin view</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 28 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
            color: tab === t.id ? 'var(--purple-primary)' : 'var(--text-muted)',
            borderBottom: `2px solid ${tab === t.id ? 'var(--purple-primary)' : 'transparent'}`,
            marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t.label}
            {t.badge ? (
              <span style={{ fontSize: 11, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'view-all' && (
        <>
          <div style={card}>
            {renderStepIndicator()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
            {step === 6 && renderStep6()}
          </div>
          <div style={{ borderTop: '2px solid var(--border)', margin: '28px 0' }} />
          <div style={card}>
            {renderViewAll()}
          </div>
        </>
      )}

      {tab === 'calendar' && (
        <div style={card}>
          {renderCalendar()}
        </div>
      )}

      {tab === 'productivity' && (
        <div style={card}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Task Productivity Evaluations</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              Score 0–100 based on % of tasks completed on time. Recurring = MISC/PM/Equipment. One-off = all other assigned tasks.
            </div>
          </div>
          {renderProductivity()}
        </div>
      )}

      {tab === 'assigned' && (
        <div style={card}>
          {renderAssignedTab()}
        </div>
      )}

      {tab === 'my-tasks' && (
        <div style={card}>
          {renderMyTasksTab()}
        </div>
      )}

      {tab === 'oneoff' && (
        <div style={card}>
          {renderOneOffTab()}
        </div>
      )}

      {/* Quick-assign modal */}
      {renderQuickAssignModal()}
      {/* Task definition editor modal */}
      {renderTaskDefModal()}
    </div>
  );
}
