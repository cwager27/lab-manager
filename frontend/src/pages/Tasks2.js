import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, AlertTriangle, Upload, Clock, Search, ChevronDown, Bell } from 'lucide-react';
import {
  getMaintCycleKey, getMaintNextDue, getMaintKey,
  isMaintSubDone, isMaintParentDone, isMaintFreqDone,
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

const chip = (active) => ({
  padding: '5px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: 500,
  border: `1.5px solid ${active ? 'var(--purple-primary)' : 'var(--border)'}`,
  background: active ? 'var(--purple-primary)' : 'transparent',
  color: active ? '#fff' : 'var(--text-primary)',
});

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

function fmtMonthYear(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return `${MONTHS_SHORT[Number(m) - 1]} ${y}`;
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

export default function Tasks2({ userRole }) {
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

  // ── Load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/tasks2/data`)
      .then(r => r.json())
      .then(d => { setTasks(d.tasks || []); setProfiles(d.profiles || []); setVacations(d.vacations || []); setDataLoading(false); })
      .catch(() => setDataLoading(false));
  }, []);

  useEffect(() => { if (tab === 'calendar') loadCalendar(); }, [tab, calYear, calMonth]);
  useEffect(() => { if (tab === 'unassigned') loadUnassigned(); }, [tab]);
  useEffect(() => { if (tab === 'view-all' && !vatLoaded) loadVatData(); }, [tab, vatLoaded]); // eslint-disable-line
  useEffect(() => { if (tab === 'assigned') loadAssignedTasks(assignedFrom, assignedTo); }, [tab, assignedFrom, assignedTo]); // eslint-disable-line
  useEffect(() => { if (tab === 'assigned') loadReport(reportPeriod, assignedFrom, assignedTo); }, [tab, reportPeriod, assignedFrom, assignedTo]); // eslint-disable-line

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

  function getOverallRange() {
    const ranges = Object.values(dateRanges).filter(r => r?.start && r?.end);
    if (!ranges.length) return null;
    return {
      start: ranges.map(r => r.start).sort()[0],
      end: ranges.map(r => r.end).sort().reverse()[0],
    };
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

  function renderAssignedTab() {
    const today = new Date().toISOString().split('T')[0];
    const members = profiles.slice().sort((a, b) => a.full_name.localeCompare(b.full_name));

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
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
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
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{occ.assignee?.full_name || '—'}</span>
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

    const completedCount = visibleTasks.filter(t => vatResponses[t.id]?.response).length;

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
                {completedCount} / {visibleTasks.length}
              </div>
            </div>

            {visibleTasks.length > 0 && (
              <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(completedCount / visibleTasks.length) * 100}%`, background: 'var(--purple-primary)', transition: 'width 0.3s' }} />
              </div>
            )}

            {visibleTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>No tasks found.</div>
            ) : visibleGroups.map(([groupName, groupTasks]) => (
              <div key={groupName || 'ungrouped'} style={{ marginBottom: '4px' }}>
                {groupName && (
                  <div style={{ padding: '12px 2px 6px', borderBottom: '2px solid var(--purple-primary)', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--purple-primary)' }}>{groupName}</span>
                  </div>
                )}
                {groupTasks.map(task => {
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
                          <p style={{ fontSize: '13px', color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, margin: 0 }}>{task.title}</p>
                          {task.sop_trigger && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '3px', padding: '2px 7px', background: '#FEF0F0', color: 'var(--danger)', borderRadius: '12px', fontSize: '10px', fontWeight: 600 }}><AlertTriangle size={9} /> SOP</span>}
                          {vatExisting[task.id] && (
                            <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                              <span style={{ color: 'var(--success)' }}>✓</span> Done by {vatExisting[task.id].assignment?.profile?.full_name || '?'} on {new Date(vatExisting[task.id].responded_at).toLocaleDateString()}
                            </div>
                          )}
                          {resp?.response && (
                            <textarea value={resp?.notes || ''} onChange={e => handleVatNotes(task.id, e.target.value)} placeholder="Notes (optional)" rows={1}
                              style={{ width: '100%', marginTop: '6px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', fontFamily: 'inherit' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
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
    const members = profiles.slice().sort((a, b) => a.full_name.localeCompare(b.full_name));
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
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple-primary)' }}>{p?.full_name || id}</span>
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
                <span style={{ color: 'var(--text-primary)' }}>{p.full_name}</span>
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

  const tabs = [
    { id: 'view-all', label: 'Tasks' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'assigned', label: 'Insights', badge: unassignedCount || null },
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

      {tab === 'assigned' && (
        <div style={card}>
          {renderAssignedTab()}
        </div>
      )}

      {/* Quick-assign modal */}
      {renderQuickAssignModal()}
    </div>
  );
}
