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
  daily:      { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  weekly:     { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  biweekly:   { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
  monthly:    { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  bimonthly:  { bg: '#E8F8F5', text: '#1A7A6A', border: '#A2D9CE' },
  quarterly:  { bg: '#FDEBD0', text: '#D35400', border: '#F0B27A' },
  yearly:     { bg: '#FDEDEC', text: '#E74C3C', border: '#F1948A' },
};
const ALL_FREQS = ['daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'yearly'];

const FREQ_ORDER = ['yearly', 'quarterly', 'bimonthly', 'monthly', 'biweekly', 'weekly', 'daily'];
const FREQ_LABEL = { yearly: 'Yearly', quarterly: 'Quarterly', bimonthly: 'Bimonthly', monthly: 'Monthly', biweekly: 'Biweekly', weekly: 'Weekly', daily: 'Daily' };
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const LOOKAHEAD = { daily: 7, weekly: 14, biweekly: 30, monthly: 60, bimonthly: 75, quarterly: 90, yearly: 90 };

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

function bimonthlyItems() {
  const now = new Date();
  const items = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i * 2, 1);
    const y = d.getFullYear(); const m = d.getMonth();
    const m2 = m + 1;
    const ld = new Date(y, m2 + 1, 0).getDate();
    items.push({
      key: `${y}-${String(m + 1).padStart(2,'0')}`,
      label: `${MONTHS_SHORT[m]}–${MONTHS_SHORT[m2]} ${y}`,
      startISO: `${y}-${String(m + 1).padStart(2,'0')}-01`,
      endISO: `${y}-${String(m2 + 1).padStart(2,'0')}-${ld}`,
    });
  }
  return items;
}

function pickerFor(freq, value, onChange) {
  if (freq === 'yearly') return <RangeList items={yearItems()} value={value} onChange={onChange} />;
  if (freq === 'quarterly') return <RangeList items={quarterItems()} value={value} onChange={onChange} />;
  if (freq === 'bimonthly') return <RangeList items={bimonthlyItems()} value={value} onChange={onChange} />;
  if (freq === 'monthly') return <RangeList items={monthItems()} value={value} onChange={onChange} />;
  if (freq === 'weekly') return <RangeList items={weekItems()} value={value} onChange={onChange} />;
  return <DateRangeInputs value={value} onChange={onChange} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Tasks2({ userRole, userId, profile: myProfile }) {
  const canManage = userRole === 'admin' || userRole === 'pm';
  const [tab, setTab] = useState(canManage ? 'view-all' : 'my-tasks');

  // Shared data
  const [tasks, setTasks] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [step1Cat, setStep1Cat] = useState('');
  const [step1Freq, setStep1Freq] = useState('');
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
  const [vatExpandedGroups, setVatExpandedGroups] = useState(new Set());
  const [vatExpandedAuditAreas, setVatExpandedAuditAreas] = useState(new Set());
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
  const [unassignedOccs, setUnassignedOccs] = useState([]);
  const [unassignedOccsLoading, setUnassignedOccsLoading] = useState(false);
  const [unassignedTimeTab, setUnassignedTimeTab] = useState('month');
  const [unassignedMinimized, setUnassignedMinimized] = useState(false);
  const [assignedPersonTab, setAssignedPersonTab] = useState('all');
  const [assignedTimePeriod, setAssignedTimePeriod] = useState('all');
  const [assignedFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [assignedTo] = useState(() => `${new Date().getFullYear()}-12-31`);
  const [editingOccId, setEditingOccId] = useState(null);
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [remindingId, setRemindingId] = useState(null);
  const [remindedIds, setRemindedIds] = useState(new Set());

  // ── Productivity state ────────────────────────────────────────────────────
  const [prodPeriod, setProdPeriod] = useState('current');
  const [prodRows, setProdRows] = useState([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodDirty, setProdDirty] = useState(0);
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
  const [myTaskSubTab, setMyTaskSubTab] = useState('summary');
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
  const [relatedTaskEdits, setRelatedTaskEdits] = useState({});

  // ── One-off Tasks state ───────────────────────────────────────────────────
  const [oneOffTasks, setOneOffTasks] = useState([]);
  const [oneOffLoading, setOneOffLoading] = useState(false);
  const [oneOffForm, setOneOffForm] = useState({ title: '', description: '', assigneeIds: [], dueDate: '', showOnPublic: false });
  const [oneOffSaving, setOneOffSaving] = useState(false);
  const [oneOffError, setOneOffError] = useState('');
  const [confirmDeleteOneOff, setConfirmDeleteOneOff] = useState(null);
  const [oneOffPersonTab, setOneOffPersonTab] = useState('all');
  const [oneOffSearch, setOneOffSearch] = useState('');

  // ── Load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    // Fetch profiles directly from Supabase (reliable on all envs) in parallel with the backend call
    supabase.from('profiles').select('id, full_name, email, role').order('full_name')
      .then(({ data }) => { if (data?.length) setProfiles(data); });
    fetch(`${API}/api/tasks2/data`)
      .then(r => r.json())
      .then(d => { setTasks(d.tasks || []); if (d.profiles?.length) setProfiles(d.profiles); setVacations(d.vacations || []); setDataLoading(false); })
      .catch(() => setDataLoading(false));
  }, []);

  useEffect(() => { if (tab === 'calendar') loadCalendar(); }, [tab, calYear, calMonth]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'unassigned') loadUnassigned(); }, [tab]);
  useEffect(() => { if (tab === 'view-all' && !vatLoaded) loadVatData(); }, [tab, vatLoaded]); // eslint-disable-line
  useEffect(() => { if (tab === 'assigned') { loadAssignedTasks(assignedFrom, assignedTo); loadUnassignedOccs(); } }, [tab, assignedFrom, assignedTo]); // eslint-disable-line
  useEffect(() => { if (tab === 'productivity') loadProductivity(prodPeriod); }, [tab, prodPeriod, profiles.length, prodDirty]); // eslint-disable-line
  useEffect(() => { if (tab === 'oneoff') loadOneOffTab(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'my-tasks' && userId) { loadMyTasks(); if (!vatLoaded) loadVatData(); } }, [tab, userId]); // eslint-disable-line
  useEffect(() => { if (tab === 'my-tasks' && myTaskSubTab === 'productivity') loadProductivity(prodPeriod); }, [tab, myTaskSubTab, prodPeriod, prodDirty]); // eslint-disable-line

  // Save vatResponses to localStorage — only real completions (keys scoped to a due date via '::')
  // View-all demo uses bare taskId keys and must not persist across sessions
  useEffect(() => {
    if (!userId) return;
    const toSave = Object.fromEntries(Object.entries(vatResponses).filter(([k]) => k.includes('::')));
    if (!Object.keys(toSave).length) return;
    try { localStorage.setItem(`vat_${userId}`, JSON.stringify(toSave)); } catch {}
  }, [vatResponses, userId]); // eslint-disable-line

  // Restore my-tasks completions from localStorage on mount
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(`vat_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Object.keys(parsed).length) setVatResponses(parsed);
      }
    } catch {}
  }, [userId]); // eslint-disable-line

  // Auto-persist completed task groups to DB
  useEffect(() => {
    if (!myTaskOccs.length || !vatTasks.length) return;
    // Build occsByDefAndDate: taskDefId → { dueDate → occ }
    const occsByDefAndDate = {};
    myTaskOccs.forEach(occ => {
      if (!occ.task_def?.id) return;
      if (!occsByDefAndDate[occ.task_def.id]) occsByDefAndDate[occ.task_def.id] = {};
      occsByDefAndDate[occ.task_def.id][occ.due_date] = occ;
    });
    const myDefIds = new Set(Object.keys(occsByDefAndDate));
    // Build per-date group map: "groupName__dueDate" → { groupName, dueDate, tasks }
    const groupMap = new Map();
    vatTasks.forEach(t => {
      if (!myDefIds.has(t.id)) return;
      const gName = t.group_name || t.title || t.id;
      Object.keys(occsByDefAndDate[t.id] || {}).forEach(dueDate => {
        const mapKey = `${gName}__${dueDate}`;
        if (!groupMap.has(mapKey)) groupMap.set(mapKey, { groupName: gName, dueDate, tasks: [] });
        groupMap.get(mapKey).tasks.push(t);
      });
    });
    const toUpdate = [];
    groupMap.forEach(group => {
      const { groupName, dueDate, tasks } = group;
      const isLiveCell = groupName === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time';
      let complete = false;
      const vKey = id => `${id}::${dueDate}`;
      if (isLiveCell) {
        const lcParent = tasks.find(t => t.response_type === 'yes_no');
        const lcResp = lcParent ? vatResponses[vKey(lcParent.id)]?.response : null;
        if (lcResp === 'no') complete = true;
        else if (lcResp === 'yes') complete = tasks.filter(t => t.response_type === 'checkbox').every(t => vatResponses[vKey(t.id)]?.response === 'checked');
      } else {
        const myAssigned = tasks.filter(t => myDefIds.has(t.id));
        complete = myAssigned.length > 0 && myAssigned.every(t => {
          const r = vatResponses[vKey(t.id)]?.response;
          if (!r) return false;
          if (t.sop_trigger && r === 'no' && !sopExceptions[t.id]?.submitted) return false;
          if (!t.sub_tasks?.length) return true;
          const trigger = t.sub_tasks[0]?.trigger || 'always';
          const triggered = trigger === 'always' || (trigger.startsWith('custom:') ? r === trigger.slice(7) : r === trigger);
          return !triggered || t.sub_tasks.every(st => vatResponses[`${t.id}_sub_${st.id}::${dueDate}`]?.response === 'checked');
        });
      }
      if (complete) {
        tasks.forEach(t => {
          const occ = occsByDefAndDate[t.id]?.[dueDate];
          if (occ && occ.status !== 'done' && !persistedCompletionsRef.current.has(occ.id)) {
            persistedCompletionsRef.current.add(occ.id);
            toUpdate.push(occ.id);
          }
        });
      }
    });
    if (toUpdate.length > 0) {
      const now = new Date().toISOString();
      (async () => {
        await Promise.all(toUpdate.map(id =>
          supabase.from('task_occurrences').update({ status: 'done', completed_at: now }).eq('id', id)
        ));
        setMyTaskOccs(prev => prev.map(occ => toUpdate.includes(occ.id) ? { ...occ, status: 'done', completed_at: now } : occ));
        setProdDirty(d => d + 1);
      })();
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
      audit_area: src.audit_area || defaults?.audit_area || '',
      newAuditAreaMode: false,
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
    setRelatedTaskEdits({});
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
      audit_area: taskDefForm.audit_area.trim() || null,
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
    const relatedUpdates = Object.entries(relatedTaskEdits).filter(([, t]) => t.trim());
    for (const [id, title] of relatedUpdates) {
      await supabase.from('tasks_definitions').update({ title: title.trim() }).eq('id', id);
    }
    setTaskDefSaving(false);
    setEditingTaskDef(null);
    setRelatedTaskEdits({});
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
              <textarea value={f.title} onChange={e => tdf({ title: e.target.value })} onBlur={e => tdf({ title: e.target.value.trim().replace(/\b\w/g, c => c.toUpperCase()) })} placeholder="Task title…" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            {/* Category + Frequency */}
            {(() => {
              const existingCats = [...new Set(['MISC', 'PM', 'Equipment', ...vatTasks.map(t => t.category).filter(Boolean)])].sort((a, b) => {
                const order = ['MISC', 'PM', 'Equipment'];
                const ai = order.indexOf(a); const bi = order.indexOf(b);
                if (ai >= 0 && bi >= 0) return ai - bi;
                if (ai >= 0) return -1; if (bi >= 0) return 1;
                return a.localeCompare(b);
              });
              const showNewCat = f.newCategoryMode;
              const catSelectVal = showNewCat ? '__new__' : (f.category || '');
              return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Category</label>
                <select value={catSelectVal} onChange={e => {
                  if (e.target.value === '__new__') tdf({ category: '', newCategoryMode: true });
                  else tdf({ category: e.target.value, newCategoryMode: false });
                }} style={inputStyle}>
                  <option value="">Select category…</option>
                  {existingCats.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">+ New category…</option>
                </select>
                {showNewCat && (
                  <input value={f.category} onChange={e => tdf({ category: e.target.value })}
                    onBlur={e => tdf({ category: e.target.value.trim().replace(/\b\w/g, c => c.toUpperCase()) })}
                    placeholder="New category name…" autoFocus style={{ ...inputStyle, marginTop: 6 }} />
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Frequency</label>
                <select value={f.frequency} onChange={e => tdf({ frequency: e.target.value })} style={inputStyle}>
                  {ALL_FREQS.map(fr => <option key={fr} value={fr}>{fr.charAt(0).toUpperCase() + fr.slice(1)}</option>)}
                </select>
              </div>
            </div>
              );
            })()}
            {/* Audit Area */}
            {(() => {
              const existingAuditAreas = [...new Set(vatTasks.filter(t => t.audit_area && t.category === f.category).map(t => t.audit_area))].sort();
              const showNewAA = f.newAuditAreaMode;
              const aaSelectVal = showNewAA ? '__new__' : (f.audit_area || '');
              return (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Audit Area <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)', fontSize: 11 }}>(optional top-level grouping)</span></label>
              <select value={aaSelectVal} onChange={e => {
                if (e.target.value === '__new__') tdf({ audit_area: '', newAuditAreaMode: true });
                else tdf({ audit_area: e.target.value, newAuditAreaMode: false });
              }} style={inputStyle}>
                <option value="">No audit area</option>
                {existingAuditAreas.map(a => <option key={a} value={a}>{a}</option>)}
                <option value="__new__">+ New audit area…</option>
              </select>
              {showNewAA && (
                <input value={f.audit_area} onChange={e => tdf({ audit_area: e.target.value })}
                  onBlur={e => tdf({ audit_area: e.target.value.trim().replace(/\b\w/g, c => c.toUpperCase()) })}
                  placeholder="New audit area name…" autoFocus style={{ ...inputStyle, marginTop: 6 }} />
              )}
            </div>
              );
            })()}
            {/* Section (previously Group Name) */}
            {(() => {
              const existingSections = [...new Set(vatTasks.filter(t => t.group_name && t.category === f.category && (!f.audit_area || t.audit_area === f.audit_area)).map(t => t.group_name))].sort();
              const showNewInput = f.newGroupMode;
              const selectVal = showNewInput ? '__new__' : (f.group_name || '');
              return (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Section <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)', fontSize: 11 }}>(groups tasks under a heading)</span></label>
              <select value={selectVal} onChange={e => {
                if (e.target.value === '__new__') tdf({ group_name: '', newGroupMode: true });
                else tdf({ group_name: e.target.value, newGroupMode: false });
              }} style={inputStyle}>
                <option value="">No section</option>
                {existingSections.map(g => <option key={g} value={g}>{g}</option>)}
                <option value="__new__">+ New section…</option>
              </select>
              {showNewInput && (
                <input value={f.group_name} onChange={e => tdf({ group_name: e.target.value })}
                  onBlur={e => tdf({ group_name: e.target.value.trim().replace(/\b\w/g, c => c.toUpperCase()) })}
                  placeholder="New section name…" autoFocus style={{ ...inputStyle, marginTop: 6 }} />
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
            {/* Other Tasks in This Group */}
            {(() => {
              if (!editingTaskDef?.id) return null;
              const groupKey = f.group_name?.trim() || f.audit_area?.trim();
              if (!groupKey) return null;
              const field = f.group_name?.trim() ? 'group_name' : 'audit_area';
              const related = vatTasks.filter(t => t.id !== editingTaskDef.id && t[field] === groupKey).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
              if (!related.length) return null;
              return (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Other Tasks in This Group</label>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>Edit the wording of related tasks in the same group.</p>
                  {related.map(t => (
                    <div key={t.id} style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Step {t.sort_order ?? '—'}</span>
                      <textarea
                        value={relatedTaskEdits[t.id] !== undefined ? relatedTaskEdits[t.id] : (t.title || '')}
                        onChange={e => setRelatedTaskEdits(p => ({ ...p, [t.id]: e.target.value }))}
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
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

  const CAT_ORDER = (() => {
    const known = new Set(['MISC', 'PM', 'Equipment', ...tasks.map(t => t.category).filter(Boolean)]);
    return [...known].sort((a, b) => {
      const pri = { MISC: 0, PM: 1, Equipment: 999 };
      const ap = pri[a] ?? 100; const bp = pri[b] ?? 100;
      if (ap !== bp) return ap - bp;
      return a.localeCompare(b);
    });
  })();

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

  function getAuditAreasForLeaf(cat, freq) {
    const areaMap = new Map();
    tasksInLeaf(cat, freq).forEach(t => {
      const area = t.audit_area || t.group_name || t.title;
      if (!areaMap.has(area)) areaMap.set(area, { name: area, groupMap: new Map() });
      const groupKey = t.group_name || t.title;
      const aEntry = areaMap.get(area);
      if (!aEntry.groupMap.has(groupKey)) aEntry.groupMap.set(groupKey, { name: groupKey, tasks: [] });
      aEntry.groupMap.get(groupKey).tasks.push(t);
    });
    return [...areaMap.values()].map(a => ({ name: a.name, groups: [...a.groupMap.values()] }));
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
    if (!selectedTaskIds.size) return;
    setOccsLoading(true);

    // Group selected task IDs by frequency using `tasks` (always loaded at mount)
    const tasksByFreq = {};
    tasks.forEach(t => {
      if (!selectedTaskIds.has(t.id)) return;
      const freq = t.frequency || 'daily';
      if (!tasksByFreq[freq]) tasksByFreq[freq] = [];
      tasksByFreq[freq].push(t.id);
    });

    // Fallback: if tasks aren't loaded yet, use a single combined range
    if (Object.keys(tasksByFreq).length === 0) {
      const ranges = Object.values(rangesToUse).filter(r => r?.start && r?.end);
      if (ranges.length) {
        const start = ranges.map(r => r.start).sort()[0];
        const end = ranges.map(r => r.end).sort().reverse()[0];
        await fetch(`${API}/api/tasks2/ensure-occurrences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds: [...selectedTaskIds], start, end }),
        }).catch(() => {});
        const data = await fetch(`${API}/api/tasks2/occurrences?taskIds=${[...selectedTaskIds].join(',')}&start=${start}&end=${end}`)
          .then(r => r.json()).catch(() => []);
        setOccs(data);
        setCheckedIds(new Set(data.map(o => o.id)));
      }
      setOccsLoading(false);
      setStep(5);
      return;
    }

    // Ensure occurrences exist in DB (backfills gaps for past/new tasks), then fetch
    const allData = [];
    for (const [freq, taskIds] of Object.entries(tasksByFreq)) {
      const range = rangesToUse[freq];
      if (!range?.start || !range?.end) continue;
      // Fill any missing occurrence rows (e.g. past dates or newly-created tasks)
      await fetch(`${API}/api/tasks2/ensure-occurrences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, start: range.start, end: range.end }),
      }).catch(() => {});
      const fetched = await fetch(
        `${API}/api/tasks2/occurrences?taskIds=${taskIds.join(',')}&start=${range.start}&end=${range.end}`
      ).then(r => r.json()).catch(() => []);
      allData.push(...fetched);
    }

    setOccs(allData);
    setCheckedIds(new Set(allData.map(o => o.id)));
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
    setStep(1); setStep1Cat(''); setStep1Freq('');
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
      .select('id, due_date, status, assigned_to, completed_at, notes, task_def:tasks_definitions(id, title, category, frequency, audit_area, group_name), assignee:profiles!assigned_to(id, full_name)')
      .gte('due_date', from)
      .lte('due_date', to)
      .order('due_date');
    setAssignedOccs(data || []);
    setAssignedLoading(false);
  }

  async function loadUnassignedOccs() {
    setUnassignedOccsLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const endOfYear = `${new Date().getFullYear()}-12-31`;
    const { data } = await supabase
      .from('task_occurrences')
      .select('id, due_date, task_def:tasks_definitions(id, title, category, frequency, audit_area, group_name)')
      .is('assigned_to', null)
      .gte('due_date', todayStr)
      .lte('due_date', endOfYear)
      .order('due_date');
    setUnassignedOccs(data || []);
    setUnassignedOccsLoading(false);
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
    loadUnassignedOccs();
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

    const [{ data }, { data: profData }, { data: sporadicData }] = await Promise.all([
      supabase
        .from('task_occurrences')
        .select('id, due_date, status, completed_at, assigned_to, task_definition_id, task_def:tasks_definitions(category)')
        .not('assigned_to', 'is', null)
        .gte('due_date', qFrom)
        .lte('due_date', qTo),
      profiles.length === 0
        ? supabase.from('profiles').select('id, full_name, email, role')
        : Promise.resolve({ data: null }),
      supabase
        .from('sporadic_tasks')
        .select('id, due_date, status, submitted_at, assigned_to')
        .not('assigned_to', 'is', null),
    ]);

    const allProfiles = (profData && profData.length > 0) ? profData : profiles;
    if (profData && profData.length > 0) setProfiles(profData);

    function calcScore(arr) {
      const onTime  = arr.filter(o => o.status === 'done' && o.completed_at && o.completed_at.slice(0,10) <= o.due_date).length;
      const late    = arr.filter(o => o.status === 'done' && o.completed_at && o.completed_at.slice(0,10) > o.due_date).length;
      const missed  = arr.filter(o => o.status !== 'done' && o.due_date < todayStr).length;
      const matured = onTime + late + missed;
      const score   = matured > 0 ? Math.round(onTime / matured * 100) : null;
      return { onTime, late, missed, matured, score };
    }

    const byPerson = {};
    (data || []).forEach(occ => {
      if (!byPerson[occ.assigned_to]) byPerson[occ.assigned_to] = [];
      byPerson[occ.assigned_to].push(occ);
    });

    const sporadicByPerson = {};
    (sporadicData || []).forEach(s => {
      if (!sporadicByPerson[s.assigned_to]) sporadicByPerson[s.assigned_to] = [];
      sporadicByPerson[s.assigned_to].push({
        status: s.status === 'submitted' ? 'done' : s.status,
        completed_at: s.submitted_at,
        due_date: s.due_date,
      });
    });

    const rows = allProfiles
      .map(p => {
        const occs     = byPerson[p.id] || [];
        const sporadic = sporadicByPerson[p.id] || [];
        const occIds   = new Set(occs.map(o => o.id));
        const pmCount  = Object.entries(pmReminders)
          .filter(([id]) => occIds.has(id))
          .reduce((s, [, c]) => s + c, 0);
        return {
          profile: p,
          recurring: calcScore(occs),
          oneOff: calcScore(sporadic),
          combined: calcScore([...occs, ...sporadic]),
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
        .select('*')
        .eq('assigned_to', userId)
        .order('due_date', { ascending: true }),
    ]);
    setMyTaskOccs(occs || []);
    setMyTaskOneOffs(oneOffs || []);

    // Restore saved responses — first from localStorage, then fill gaps from DB (done occurrences)
    const currentDefIds = new Set((occs || []).map(o => o.task_def?.id).filter(Boolean));
    const merged = {};
    try {
      const saved = localStorage.getItem(`vat_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([k, v]) => {
          const taskDefId = k.split('_sub_')[0].split('::')[0];
          if (currentDefIds.has(taskDefId)) merged[k] = v;
        });
      }
    } catch {}
    // Synthesize responses for done occurrences not covered by localStorage
    for (const occ of (occs || [])) {
      if (occ.status !== 'done' || !occ.task_def?.id) continue;
      const k = `${occ.task_def.id}::${occ.due_date}`;
      if (!merged[k]) {
        merged[k] = { response: occ.task_def.response_type === 'checkbox' ? 'checked' : 'yes' };
        (occ.task_def.sub_tasks || []).forEach(st => {
          merged[`${occ.task_def.id}_sub_${st.id}::${occ.due_date}`] = { response: 'checked' };
        });
      }
    }
    if (Object.keys(merged).length) setVatResponses(merged);

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
                  <th style={{ ...thStyle, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} colSpan={4}>Recurrent Tasks</th>
                  <th style={{ ...thStyle, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} colSpan={4}>Ad hoc Tasks</th>
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
                        {combined.matured} total · click to expand
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
    const historyPeriodTasks = prodDetailTasks.filter(o => classify(o) !== 'upcoming' && o.due_date >= cutoff);
    const histGreen  = historyPeriodTasks.filter(o => classify(o) === 'green');
    const histYellow = historyPeriodTasks.filter(o => classify(o) === 'yellow');
    const histRed    = historyPeriodTasks.filter(o => classify(o) === 'red');
    const histTotal  = historyPeriodTasks.length;
    const histPct    = n => histTotal > 0 ? Math.round(n / histTotal * 100) : 0;
    const historyTasks = historyPeriodTasks
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {historyPeriods.map(({ id, label }) => (
                    <button key={id} onClick={() => setProdDetailHistoryPeriod(id)}
                      style={{ padding: '5px 13px', borderRadius: 20, border: `1.5px solid ${prodDetailHistoryPeriod === id ? 'var(--purple-primary)' : 'var(--border)'}`, background: prodDetailHistoryPeriod === id ? 'var(--purple-primary)' : 'transparent', color: prodDetailHistoryPeriod === id ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {histTotal > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {[['green', histGreen], ['yellow', histYellow], ['red', histRed]].map(([key, arr]) => {
                      const m = STATUS_META[key];
                      return (
                        <div key={key} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1.5px solid ${m.border}`, borderRadius: 8, background: m.bg }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: m.color, lineHeight: 1 }}>{histPct(arr.length)}%</div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{arr.length} of {histTotal}</div>
                          </div>
                          <div style={{ marginLeft: 'auto', width: 36, height: 36, borderRadius: '50%', background: 'white', border: `2px solid ${m.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ position: 'absolute', inset: 0, background: `conic-gradient(${m.color} 0% ${histPct(arr.length)}%, var(--border) ${histPct(arr.length)}% 100%)`, borderRadius: '50%' }} />
                              <div style={{ position: 'absolute', inset: 4, background: m.bg, borderRadius: '50%' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
    const now = new Date();

    const classifyOneOff = t => {
      if (t.status === 'submitted' || t.status === 'completed') {
        const finishedAt = (t.submitted_at || t.completed_at || '').slice(0, 10);
        return !finishedAt || !t.due_date || finishedAt <= t.due_date ? 'ontime' : 'late';
      }
      if (t.due_date && t.due_date < today) return 'overdue';
      return 'upcoming';
    };



    // ── Time bucket helpers ─────────────────────────────────────────────────
    const plus7 = new Date(now); plus7.setDate(plus7.getDate() + 7);
    const endOfWeek = plus7.toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const end3Mo = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString().split('T')[0];

    const bucketFor = dueDate => {
      if (!dueDate || dueDate === 'none') return 'nodate';
      if (dueDate < today) return 'overdue';
      if (dueDate <= endOfWeek) return 'week';
      if (dueDate <= endOfMonth) return 'month';
      if (dueDate <= end3Mo) return 'three';
      return 'beyond';
    };

    // Build occsByDefAndDate: taskDefId → { dueDate → occ }
    const occsByDefAndDate = {};
    myTaskOccs.forEach(occ => {
      if (!occ.task_def?.id) return;
      if (!occsByDefAndDate[occ.task_def.id]) occsByDefAndDate[occ.task_def.id] = {};
      occsByDefAndDate[occ.task_def.id][occ.due_date] = occ;
    });
    const myDefIds = new Set(Object.keys(occsByDefAndDate));

    // vatResponses key scoped to a specific occurrence date
    const vKey = (taskId, dueDate) => `${taskId}::${dueDate}`;

    // Completion helpers (date-scoped so each occurrence date is independent)
    const isTaskComplete = (task, dueDate) => {
      const r = vatResponses[vKey(task.id, dueDate)]?.response;
      if (!r) return false;
      if (task.sop_trigger && r === 'no' && !sopExceptions[task.id]?.submitted) return false;
      if (!task.sub_tasks?.length) return true;
      const trigger = task.sub_tasks[0]?.trigger || 'always';
      const triggered = trigger === 'always' || (trigger.startsWith('custom:') ? r === trigger.slice(7) : r === trigger);
      return !triggered || task.sub_tasks.every(st => vatResponses[`${task.id}_sub_${st.id}::${dueDate}`]?.response === 'checked');
    };
    const isGroupComplete = (groupTasks, groupName, dueDate) => {
      const isLiveCell = groupName === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time';
      if (isLiveCell) {
        const lcParent = groupTasks.find(t => t.response_type === 'yes_no');
        const lcResp = lcParent ? vatResponses[vKey(lcParent.id, dueDate)]?.response : null;
        if (!lcResp) return false;
        if (lcResp === 'no') return true;
        return groupTasks.filter(t => t.response_type === 'checkbox').every(t => vatResponses[vKey(t.id, dueDate)]?.response === 'checked');
      }
      const myAssigned = groupTasks.filter(t => myDefIds.has(t.id));
      if (myAssigned.length === 0) return false;
      return myAssigned.every(t => isTaskComplete(t, dueDate));
    };

    // Build group map: one entry per (groupName, dueDate) pair
    const groupMap = new Map();
    vatTasks.forEach(t => {
      if (!myDefIds.has(t.id)) return;
      const gName = t.group_name || t.title || t.id;
      Object.keys(occsByDefAndDate[t.id] || {}).forEach(dueDate => {
        const mapKey = `${gName}__${dueDate}`;
        if (!groupMap.has(mapKey)) {
          groupMap.set(mapKey, { groupName: gName, category: t.category || 'MISC', tasks: [], dueDate });
        }
        groupMap.get(mapKey).tasks.push(t);
      });
    });

    const allGroups = [...groupMap.values()];

    // Distribute into time buckets
    const recBuckets = { overdue: [], week: [], month: [], three: [], beyond: [], nodate: [] };
    allGroups.forEach(g => recBuckets[bucketFor(g.dueDate)].push(g));

    const adhocBuckets = { overdue: [], week: [], month: [], three: [], beyond: [], nodate: [] };
    [...myTaskOneOffs].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).forEach(t => adhocBuckets[bucketFor(t.due_date)].push(t));

    // Render a one-off task card
    const renderOneOffTask = t => {
      const cls = classifyOneOff(t);
      const isDone = cls === 'ontime' || cls === 'late';
      const key = `oneoff-${t.id}`;
      const resp = myTaskResponses[key] || '';
      const notes = myTaskNotes[key] ?? (t.notes || '');
      const toggleResp = async () => {
        const nowDone = !(resp === 'checked' || isDone);
        setMyTaskResponses(p => ({ ...p, [key]: nowDone ? 'checked' : '' }));
        const now = new Date().toISOString();
        if (nowDone) {
          await supabase.from('sporadic_tasks').update({ status: 'submitted', response: 'checked', submitted_at: now }).eq('id', t.id);
          setMyTaskOneOffs(prev => prev.map(x => x.id === t.id ? { ...x, status: 'submitted', submitted_at: now } : x));
        } else {
          await supabase.from('sporadic_tasks').update({ status: 'pending', response: null, submitted_at: null }).eq('id', t.id);
          setMyTaskOneOffs(prev => prev.map(x => x.id === t.id ? { ...x, status: 'pending', submitted_at: null } : x));
        }
      };
      const updateNotes = v => setMyTaskNotes(p => ({ ...p, [key]: v }));
      const saveNotes = async v => {
        const trimmed = v.trim();
        await supabase.from('sporadic_tasks').update({ notes: trimmed || null }).eq('id', t.id);
        setMyTaskOneOffs(prev => prev.map(x => x.id === t.id ? { ...x, notes: trimmed || null } : x));
      };
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
              {isDone && (t.submitted_at || t.completed_at) && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--success)' }}>✓</span> Completed on {new Date(t.submitted_at || t.completed_at).toLocaleDateString()}
                  {cls === 'late' && <span style={{ color: '#f59e0b', marginLeft: 4 }}>(late)</span>}
                </div>
              )}
              <textarea value={notes} onChange={e => updateNotes(e.target.value)} onBlur={e => saveNotes(e.target.value)} placeholder="Add a note…" rows={1}
                style={{ width: '100%', marginTop: '6px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', fontFamily: 'inherit' }} />
              {t.file_url && <div style={{ marginTop: 6 }}><a href={t.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--purple-primary)', fontWeight: 600 }}>📎 Attachment →</a></div>}
            </div>
          </div>
        </div>
      );
    };

    // ── renderFullGroup: full interactive rendering for active/overdue ─────────
    const renderFullGroup = ({ groupName, tasks: groupTasks, dueDate }, bucketId = 'week') => {
      const groupDone = isGroupComplete(groupTasks, groupName, dueDate);

                      const gateTask = groupTasks.find(t => t.conditional_text === 'on_yes');
                      const gateIdx = gateTask ? groupTasks.indexOf(gateTask) : -1;
                      const gateResp = gateTask ? vatResponses[vKey(gateTask.id, dueDate)]?.response : null;
                      const isLiveCellGroup = groupName === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time';
                      const lcParentResp = isLiveCellGroup ? gateResp : null;
                      const lcSubTasks = isLiveCellGroup ? groupTasks.filter(t => t.response_type === 'checkbox') : [];
                      const lcAllChecked = lcSubTasks.length > 0 && lcSubTasks.every(t => vatResponses[vKey(t.id, dueDate)]?.response === 'checked');

                      return (
                        <div key={`${groupName || 'ungrouped'}__${dueDate}`} style={{ marginBottom: '4px' }}>
                          {groupName && (
                            <div style={{ padding: '12px 2px 6px', borderBottom: `2px solid ${groupDone ? 'var(--success)' : 'var(--purple-primary)'}`, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: groupDone ? 'var(--success)' : 'var(--purple-primary)' }}>{groupName}</span>
                              {dueDate && dueDate !== 'none' && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>· Due {fmtDate(dueDate)}</span>
                              )}
                              {groupDone && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', background: '#EAF7F0', padding: '2px 8px', borderRadius: 10, border: '1px solid #A9DFBF' }}>✓ Completed</span>}
                            </div>
                          )}
                          {groupTasks.map((task, taskIdx) => {
                            if (gateTask && taskIdx > gateIdx && gateResp !== 'yes') return null;
                            const resp = vatResponses[vKey(task.id, dueDate)];
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
                                        <button onClick={() => handleVatResponse(vKey(task.id, dueDate), resp?.response === 'yes' ? '' : 'yes')} title="Yes" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid', borderColor: resp?.response === 'yes' ? 'var(--success)' : 'var(--border)', background: resp?.response === 'yes' ? 'var(--success)' : 'transparent', color: resp?.response === 'yes' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CheckCircle size={13} /></button>
                                        <button onClick={() => handleVatResponse(vKey(task.id, dueDate), resp?.response === 'no' ? '' : 'no')} title="No" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid', borderColor: resp?.response === 'no' ? 'var(--danger)' : 'var(--border)', background: resp?.response === 'no' ? 'var(--danger)' : 'transparent', color: resp?.response === 'no' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><XCircle size={13} /></button>
                                        {task.response_type === 'yes_no_na' && <button onClick={() => handleVatResponse(vKey(task.id, dueDate), resp?.response === 'na' ? '' : 'na')} style={{ padding: '0 7px', height: '26px', borderRadius: '13px', border: '2px solid', borderColor: resp?.response === 'na' ? 'var(--text-muted)' : 'var(--border)', background: resp?.response === 'na' ? 'var(--text-muted)' : 'transparent', color: resp?.response === 'na' ? 'white' : 'var(--text-muted)', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>N/A</button>}
                                      </>
                                    ) : task.response_type === 'checkbox' ? (
                                      <button onClick={() => handleVatResponse(vKey(task.id, dueDate), resp?.response === 'checked' ? '' : 'checked')} style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', border: '2px solid', borderColor: resp?.response === 'checked' ? 'var(--purple-primary)' : 'var(--border)', background: resp?.response === 'checked' ? 'var(--purple-primary)' : 'transparent', color: resp?.response === 'checked' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CheckCircle size={13} /></button>
                                    ) : (
                                      <label style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                        <Upload size={13} />
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={() => {}} />
                                      </label>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                      <p style={{ fontSize: '13px', color: done ? 'var(--text-muted)' : bucketId === 'overdue' ? '#ef4444' : 'var(--purple-primary)', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.5, margin: 0, flex: 1 }}>{task.title}</p>
                                      <button onClick={() => openTaskDefEditor(task)} title="Edit task" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px 3px', display: 'flex', flexShrink: 0, opacity: 0.5 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}><Pencil size={12} /></button>
                                    </div>
                                    {task.sop_trigger && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '3px', padding: '2px 7px', background: '#FEF0F0', color: 'var(--danger)', borderRadius: '12px', fontSize: '10px', fontWeight: 600 }}><AlertTriangle size={9} /> {task.conditional_text ? <a href={task.conditional_text} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--danger)', textDecoration: 'underline' }}>SOP</a> : 'SOP'}</span>}
                                    {!task.sop_trigger && task.conditional_text && !task.conditional_text.startsWith('http') && task.conditional_text !== 'on_yes' && (
                                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '3px 0 0', lineHeight: 1.4 }}>{task.conditional_text}</p>
                                    )}
                                    {vatExisting[task.id] && (
                                      <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        <span style={{ color: 'var(--success)' }}>✓</span> Done by {vatExisting[task.id].assignment?.profile?.full_name || '?'} on {new Date(vatExisting[task.id].responded_at).toLocaleDateString()}
                                      </div>
                                    )}
                                    {resp?.response && (
                                      <textarea value={resp?.notes || ''} onChange={e => handleVatNotes(vKey(task.id, dueDate), e.target.value)} placeholder="Notes (optional)" rows={1}
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
                                          const stKey = `${task.id}_sub_${st.id}::${dueDate}`;
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
    };

    // ── Compact renderers for future buckets ──────────────────────────────
    const CAT_COLORS = { MISC: { bg: '#f5eefb', fg: '#8b5cf6' }, PM: { bg: '#eff6ff', fg: '#3b82f6' }, Equipment: { bg: '#fffbeb', fg: '#f59e0b' } };

    const renderCompactGroup = g => {
      const isDone = isGroupComplete(g.tasks, g.groupName, g.dueDate);
      const { bg, fg } = CAT_COLORS[g.category] || { bg: '#f3f4f6', fg: '#6b7280' };
      return (
        <div key={`${g.groupName || (g.tasks[0] && g.tasks[0].id)}__${g.dueDate}`} style={{ padding: '10px 12px', background: 'var(--bg-card)', border: `1px solid ${isDone ? '#A9DFBF' : 'var(--border)'}`, borderRadius: 8, marginBottom: 5, opacity: isDone ? 0.7 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isDone ? '#22c55e' : 'var(--border)'}`, background: isDone ? '#22c55e' : 'transparent', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isDone && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.4 }}>
                  {g.groupName || (g.tasks[0] && g.tasks[0].title) || 'Task'}
                </span>
                {g.dueDate && g.dueDate !== 'none' && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                    · Due {fmtDate(g.dueDate)}
                  </span>
                )}
              </div>
              <div style={{ marginTop: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: bg, color: fg }}>{g.category}</span>
              </div>
            </div>
          </div>
        </div>
      );
    };


    // ── Summary sub-tab ────────────────────────────────────────────────────
    const BUCKET_CONFIG = [
      { id: 'overdue', label: 'Overdue',       headColor: '#ef4444',              headBg: '#fef2f2',             isActive: true },
      { id: 'week',    label: 'This Week',      headColor: 'var(--purple-primary)', headBg: '#f5eefb',             isActive: true },
      { id: 'month',   label: 'This Month',     headColor: 'var(--text-primary)',   headBg: 'var(--bg-secondary)', isActive: true },
      { id: 'three',   label: 'Next 3 Months',  headColor: 'var(--text-secondary)', headBg: 'var(--bg-secondary)', isActive: true },
      { id: 'beyond',  label: 'Beyond',          headColor: 'var(--text-muted)',     headBg: 'var(--bg-secondary)', isActive: true },
      { id: 'nodate',  label: 'No Due Date',     headColor: 'var(--text-muted)',     headBg: 'var(--bg-secondary)', isActive: true },
    ];

    const renderSummary = () => (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
          <div style={{ padding: '6px 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--purple-primary)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '2px solid var(--purple-primary)' }}>
            Recurrent Tasks
          </div>
          <div style={{ padding: '6px 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '2px solid var(--border)' }}>
            Ad hoc Tasks
          </div>
        </div>
        {BUCKET_CONFIG.map(({ id, label, headColor, headBg, isActive }) => {
          const recItems = recBuckets[id];
          const adhocItems = adhocBuckets[id];
          if (recItems.length === 0 && adhocItems.length === 0) return null;
          return (
            <div key={id} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px', background: headBg, borderRadius: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: headColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  {recItems.length === 0
                    ? <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 4px' }}>None</div>
                    : recItems.map(g => isActive ? renderFullGroup(g, id) : renderCompactGroup(g))}
                </div>
                <div>
                  {adhocItems.length === 0
                    ? <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 4px' }}>None</div>
                    : adhocItems.map(t => renderOneOffTask(t))}
                </div>
              </div>
            </div>
          );
        })}
        {allGroups.length + myTaskOneOffs.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No tasks assigned to you yet.</div>
        )}
      </div>
    );

    // ── Productivity sub-tab ───────────────────────────────────────────────
    const scoreColor = s => s === null ? 'var(--text-muted)' : s >= 90 ? '#22c55e' : s >= 70 ? '#f59e0b' : s >= 50 ? '#f97316' : '#ef4444';

    const renderMyProductivity = () => {
      const myRow = prodRows.find(r => r.profile.id === userId);
      const periods = [
        { id: 'current', label: 'Currently' },
        { id: '30d',     label: 'Last 30 Days' },
        { id: 'all',     label: 'Since Joining' },
      ];

      const ScoreBar = ({ stats, label: barLabel }) => {
        const { onTime, late, missed, matured, score } = stats;
        const col = scoreColor(score);
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{barLabel}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'center', minWidth: 56 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: col, lineHeight: 1 }}>{score !== null ? score : '—'}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{score !== null ? '/ 100' : 'no data'}</div>
              </div>
              {matured > 0 && (
                <div style={{ flex: 1 }}>
                  <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', marginBottom: 6 }}>
                    <div style={{ flex: onTime, background: '#22c55e', minWidth: onTime > 0 ? 2 : 0 }} />
                    <div style={{ flex: late, background: '#f59e0b', minWidth: late > 0 ? 2 : 0 }} />
                    <div style={{ flex: missed, background: '#ef4444', minWidth: missed > 0 ? 2 : 0 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12 }}><span style={{ color: '#22c55e', fontWeight: 700 }}>{onTime}</span> on time</span>
                    <span style={{ fontSize: 12 }}><span style={{ color: '#f59e0b', fontWeight: 700 }}>{late}</span> late</span>
                    <span style={{ fontSize: 12 }}><span style={{ color: '#ef4444', fontWeight: 700 }}>{missed}</span> missed</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      };

      return (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {periods.map(({ id, label }) => (
              <button key={id} onClick={() => setProdPeriod(id)}
                style={{ padding: '7px 18px', borderRadius: 20, border: `1.5px solid ${prodPeriod === id ? 'var(--purple-primary)' : 'var(--border)'}`, background: prodPeriod === id ? 'var(--purple-primary)' : 'transparent', color: prodPeriod === id ? '#fff' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
          {prodLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : !myRow ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No productivity data found.</div>
          ) : (
            <div>
              <div style={{ textAlign: 'center', padding: '24px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Overall Score</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                  Based on your assigned tasks: on-time = full credit · late = 50% · missed = 0%<br />
                  <span style={{ fontStyle: 'italic' }}>Score = on-time ÷ matured tasks × 100 &nbsp;·&nbsp; Late and missed both count as 0. Future tasks not yet due are excluded.</span>
                </div>
                <div style={{ fontSize: 52, fontWeight: 900, color: scoreColor(myRow.combined.score), lineHeight: 1 }}>
                  {myRow.combined.score !== null ? myRow.combined.score : '—'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{myRow.combined.score !== null ? '/ 100' : 'no data yet'}</div>
                {myRow.combined.matured > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13 }}><span style={{ color: '#22c55e', fontWeight: 700 }}>{myRow.combined.onTime}</span> on time</span>
                    <span style={{ fontSize: 13 }}><span style={{ color: '#f59e0b', fontWeight: 700 }}>{myRow.combined.late}</span> late</span>
                    <span style={{ fontSize: 13 }}><span style={{ color: '#ef4444', fontWeight: 700 }}>{myRow.combined.missed}</span> missed</span>
                    {myRow.pmReminders > 0 && <span style={{ fontSize: 13 }}><span style={{ color: '#f59e0b', fontWeight: 700 }}>{myRow.pmReminders}</span> PM reminders</span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <ScoreBar stats={myRow.recurring} label="Recurrent Tasks" />
                <ScoreBar stats={myRow.oneOff} label="Ad hoc Tasks" />
              </div>
            </div>
          )}
        </div>
      );
    };

    // ── Main render ────────────────────────────────────────────────────────
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>My Tasks</div>
        </div>

        <div style={{ display: 'flex', marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
          {[{ id: 'summary', label: 'Task Summary' }, { id: 'productivity', label: 'My Productivity' }].map(({ id, label }) => (
            <button key={id} onClick={() => setMyTaskSubTab(id)}
              style={{ padding: '8px 20px', fontSize: 14, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', color: myTaskSubTab === id ? 'var(--purple-primary)' : 'var(--text-muted)', borderBottom: `2px solid ${myTaskSubTab === id ? 'var(--purple-primary)' : 'transparent'}`, marginBottom: -2 }}>
              {label}
            </button>
          ))}
        </div>

        {myTaskLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          myTaskSubTab === 'summary' ? renderSummary() : renderMyProductivity()
        )}
      </div>
    );
  }

  function renderAssignedTab() {
    const todayDate = new Date();
    const today = todayDate.toISOString().split('T')[0];
    const members = sortByLast(profiles);

    // ── Unassigned section (top) ──────────────────────────────────────────────
    const unassignedTimeTabs = [
      { id: 'month', label: 'This Month', end: (() => { const d = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0); return d.toISOString().split('T')[0]; })() },
      { id: '3mo',   label: '3 Months',   end: (() => { const d = new Date(todayDate); d.setMonth(d.getMonth() + 3); return d.toISOString().split('T')[0]; })() },
      { id: '6mo',   label: '6 Months',   end: (() => { const d = new Date(todayDate); d.setMonth(d.getMonth() + 6); return d.toISOString().split('T')[0]; })() },
      { id: 'year',  label: 'Current Year', end: `${todayDate.getFullYear()}-12-31` },
    ];
    const activeTimeTab = unassignedTimeTabs.find(t => t.id === unassignedTimeTab) || unassignedTimeTabs[0];
    const filteredUnassigned = unassignedOccs.filter(o => o.due_date <= activeTimeTab.end);

    // Build category → audit_area → occurrences tree
    const unassignedTree = {};
    filteredUnassigned.forEach(occ => {
      const cat = occ.task_def?.category || 'MISC';
      const aa  = occ.task_def?.audit_area || '';
      if (!unassignedTree[cat]) unassignedTree[cat] = {};
      if (!unassignedTree[cat][aa]) unassignedTree[cat][aa] = [];
      unassignedTree[cat][aa].push(occ);
    });
    const catOrder = CAT_ORDER.filter(c => unassignedTree[c]);

    const renderUnassignedRow = occ => {
      const taskDef = occ.task_def;
      const freq = taskDef?.frequency || '';
      const fc = FREQ_COLORS[freq] || {};
      const isEditing = editingOccId === occ.id;
      const dateStr = new Date(occ.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const thStyle = { padding: '9px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
      if (isEditing) {
        return (
          <tr key={occ.id} style={{ background: '#F0EBF8' }}>
            <td colSpan={4} style={{ ...thStyle, borderLeft: '3px solid var(--purple-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>{dateStr}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskDef?.title || '—'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>Assign to:</span>
                <select value={editAssigneeId} onChange={e => setEditAssigneeId(e.target.value)}
                  style={{ padding: '5px 8px', border: '1px solid var(--purple-primary)', borderRadius: 'var(--radius-sm)', fontSize: 12, background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}>
                  <option value="">— Select —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{fmtName(m.full_name)}</option>)}
                </select>
                <button onClick={() => saveAssignment(occ.id)} disabled={!editAssigneeId || editSaving}
                  style={{ padding: '5px 12px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  {editSaving ? '…' : 'Save'}
                </button>
                <button onClick={() => setEditingOccId(null)} style={{ padding: '5px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>✕</button>
              </div>
            </td>
          </tr>
        );
      }
      return (
        <tr key={occ.id} style={{ background: 'var(--bg-card)' }}>
          <td style={{ ...thStyle, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{dateStr}</td>
          <td style={{ ...thStyle, fontSize: 13, color: 'var(--text-primary)', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskDef?.title || '—'}</td>
          <td style={{ ...thStyle, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: fc.bg || 'var(--bg-secondary)', color: fc.text || 'var(--text-muted)', border: `1px solid ${fc.border || 'var(--border)'}` }}>
              {freq ? freq.charAt(0).toUpperCase() + freq.slice(1) : '—'}
            </span>
          </td>
          <td style={{ ...thStyle, textAlign: 'right' }}>
            <button onClick={() => { setEditingOccId(occ.id); setEditAssigneeId(''); }}
              style={{ padding: '4px 12px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Assign
            </button>
          </td>
        </tr>
      );
    };

    const assignedList = assignedOccs.filter(o => o.assigned_to);

    return (
      <div>
        {/* ══ UNASSIGNED (top) ══════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button onClick={() => setUnassignedMinimized(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <ChevronDown size={16} style={{ transform: unassignedMinimized ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Unassigned</span>
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, background: filteredUnassigned.length > 0 ? '#F5EEF8' : 'var(--bg-secondary)', color: filteredUnassigned.length > 0 ? '#7B3FA0' : 'var(--text-muted)', borderRadius: 10, padding: '1px 8px', border: `1px solid ${filteredUnassigned.length > 0 ? '#D7BDE2' : 'var(--border)'}` }}>{filteredUnassigned.length}</span>
            <button onClick={loadUnassignedOccs} style={{ marginLeft: 'auto', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>Refresh</button>
          </div>

          {!unassignedMinimized && <>{/* Time period tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 3, width: 'fit-content', marginBottom: 16 }}>
            {unassignedTimeTabs.map(t => (
              <button key={t.id} onClick={() => setUnassignedTimeTab(t.id)}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: 12, fontWeight: unassignedTimeTab === t.id ? 600 : 400, background: unassignedTimeTab === t.id ? 'var(--purple-primary)' : 'transparent', color: unassignedTimeTab === t.id ? 'white' : 'var(--text-secondary)', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>

          {unassignedOccsLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : filteredUnassigned.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>All tasks in this window are assigned. 🎉</div>
          ) : (
            <div>
              {catOrder.map(cat => (
                <div key={cat} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>{cat}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        <th style={{ width: 100, padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid var(--border)' }}>Due Date</th>
                        <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid var(--border)' }}>Task</th>
                        <th style={{ width: 140, padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid var(--border)' }}>Recurrence</th>
                        <th style={{ width: 80, padding: '8px 14px', borderBottom: '2px solid var(--border)' }}></th>
                      </tr>
                    </thead>
                    {Object.entries(unassignedTree[cat]).map(([aa, occs]) => (
                      <tbody key={aa || '__none__'}>
                        {aa && (
                          <tr style={{ background: '#F5EEF8' }}>
                            <td colSpan={4} style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, color: 'var(--purple-primary)', borderBottom: '1px solid #E8D5F0' }}>{aa}</td>
                          </tr>
                        )}
                        {occs.map(occ => renderUnassignedRow(occ))}
                      </tbody>
                    ))}
                  </table>
                </div>
              ))}
            </div>
          )}
          </>}
        </div>

        <div style={{ borderTop: '2px solid var(--border)', paddingTop: 28, marginBottom: 24 }}>
          {/* ══ ASSIGNED (below) ══════════════════════════════════════════════ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Assigned</span>
            <span style={{ fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderRadius: 10, padding: '1px 8px', border: '1px solid var(--border)' }}>{assignedList.length}</span>
            <button onClick={() => loadAssignedTasks(assignedFrom, assignedTo)} style={{ marginLeft: 'auto', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>Refresh</button>
          </div>

          {(() => {
            const todayD = new Date();
            const assignedPeriods = [
              { id: 'all',   label: 'All Tasks',    end: '9999-12-31' },
              { id: 'month', label: 'This Month',   end: new Date(todayD.getFullYear(), todayD.getMonth() + 1, 0).toISOString().split('T')[0] },
              { id: '3mo',   label: '3 Months',     end: (() => { const d = new Date(todayD); d.setMonth(d.getMonth() + 3); return d.toISOString().split('T')[0]; })() },
              { id: '6mo',   label: '6 Months',     end: (() => { const d = new Date(todayD); d.setMonth(d.getMonth() + 6); return d.toISOString().split('T')[0]; })() },
              { id: 'year',  label: 'Current Year', end: `${todayD.getFullYear()}-12-31` },
            ];
            const activePeriod = assignedPeriods.find(p => p.id === assignedTimePeriod) || assignedPeriods[0];
            const timeFiltered = assignedList.filter(o => o.due_date <= activePeriod.end);

            const personsMap = new Map();
            timeFiltered.forEach(o => {
              if (o.assigned_to && !personsMap.has(o.assigned_to)) {
                personsMap.set(o.assigned_to, o.assignee?.full_name || o.assigned_to);
              }
            });
            const persons = [...personsMap.entries()].sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));

            const displayList = assignedPersonTab === 'all'
              ? timeFiltered
              : timeFiltered.filter(o => o.assigned_to === assignedPersonTab);

            const showAssignedTo = assignedPersonTab === 'all';
            const numCols = showAssignedTo ? 6 : 5;
            const thStyle = { padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)' };
            const tdStyle = { padding: '10px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };

            return (
              <>
                {/* Time period selector */}
                <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 3, width: 'fit-content', marginBottom: 16 }}>
                  {assignedPeriods.map(p => (
                    <button key={p.id} onClick={() => setAssignedTimePeriod(p.id)}
                      style={{ padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: 12, fontWeight: assignedTimePeriod === p.id ? 600 : 400, background: assignedTimePeriod === p.id ? 'var(--purple-primary)' : 'transparent', color: assignedTimePeriod === p.id ? 'white' : 'var(--text-secondary)', cursor: 'pointer' }}>
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Person tabs */}
                {persons.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    <button onClick={() => setAssignedPersonTab('all')}
                      style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${assignedPersonTab === 'all' ? 'var(--purple-primary)' : 'var(--border)'}`, background: assignedPersonTab === 'all' ? 'var(--purple-primary)' : 'transparent', color: assignedPersonTab === 'all' ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      All
                    </button>
                    {persons.map(([pid, name]) => (
                      <button key={pid} onClick={() => setAssignedPersonTab(pid)}
                        style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${assignedPersonTab === pid ? 'var(--purple-primary)' : 'var(--border)'}`, background: assignedPersonTab === pid ? 'var(--purple-primary)' : 'transparent', color: assignedPersonTab === pid ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {fmtName(name)}
                        <span style={{ marginLeft: 6, fontSize: 10, background: assignedPersonTab === pid ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)', borderRadius: 8, padding: '1px 5px' }}>
                          {timeFiltered.filter(o => o.assigned_to === pid).length}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Table */}
                {assignedLoading ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
                ) : displayList.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>No assigned tasks in this window.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: 100 }}>Due Date</th>
                        <th style={thStyle}>Task</th>
                        <th style={{ ...thStyle, width: 130 }}>Recurrence</th>
                        {showAssignedTo && <th style={{ ...thStyle, width: 150 }}>Assigned To</th>}
                        <th style={{ ...thStyle, width: 110 }}>Status</th>
                        <th style={{ ...thStyle, width: 70 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayList.map(occ => {
                        const isDone    = occ.status === 'done' || !!occ.completed_at;
                        const isOverdue = !isDone && occ.due_date < today;
                        const taskDef   = occ.task_def;
                        const freq      = taskDef?.frequency || '';
                        const fc        = FREQ_COLORS[freq] || {};
                        const statusChip = isDone
                          ? { label: 'Done',     color: '#27AE60', bg: '#EAF7F0' }
                          : isOverdue
                            ? { label: 'Overdue',  color: '#E74C3C', bg: '#FDEDEC' }
                            : { label: 'Upcoming', color: '#2980B9', bg: '#EBF5FB' };
                        const isEditing   = editingOccId === occ.id;
                        const isReminding = remindingId === occ.id;
                        const wasReminded = remindedIds.has(occ.id);

                        if (isEditing) {
                          return (
                            <tr key={occ.id} style={{ background: '#F0EBF8' }}>
                              <td colSpan={numCols} style={{ ...tdStyle, borderLeft: '3px solid var(--purple-primary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
                                    {new Date(occ.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskDef?.title || '—'}</span>
                                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>Assign to:</span>
                                  <select value={editAssigneeId} onChange={e => setEditAssigneeId(e.target.value)}
                                    style={{ padding: '5px 8px', border: '1px solid var(--purple-primary)', borderRadius: 'var(--radius-sm)', fontSize: 12, background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}>
                                    <option value="">— Unassign —</option>
                                    {members.map(m => <option key={m.id} value={m.id}>{fmtName(m.full_name)}</option>)}
                                  </select>
                                  <button onClick={() => saveAssignment(occ.id)} disabled={editSaving}
                                    style={{ padding: '5px 14px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                                    {editSaving ? 'Saving…' : 'Save'}
                                  </button>
                                  <button onClick={() => setEditingOccId(null)}
                                    style={{ padding: '5px 10px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={occ.id} style={{ background: 'var(--bg-card)', opacity: isDone ? 0.75 : 1 }}>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: isOverdue ? '#E74C3C' : 'var(--text-primary)' }}>
                                {new Date(occ.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {new Date(occ.due_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric' })}
                              </div>
                            </td>
                            <td style={{ ...tdStyle, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {taskDef?.title || '—'}
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: fc.bg || 'var(--bg-secondary)', color: fc.text || 'var(--text-muted)', border: `1px solid ${fc.border || 'var(--border)'}` }}>
                                {freq ? freq.charAt(0).toUpperCase() + freq.slice(1) : '—'}
                              </span>
                            </td>
                            {showAssignedTo && (
                              <td style={{ ...tdStyle, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {fmtName(occ.assignee?.full_name) || '—'}
                              </td>
                            )}
                            <td style={tdStyle}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: statusChip.bg, color: statusChip.color, whiteSpace: 'nowrap' }}>
                                {statusChip.label}
                              </span>
                              {isDone && occ.completed_at && (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {new Date(occ.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                              )}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'flex-end' }}>
                                <button onClick={() => { setEditingOccId(occ.id); setEditAssigneeId(occ.assigned_to || ''); }}
                                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}
                                  title="Edit assignee">✎
                                </button>
                                <button onClick={() => sendReminder(occ.id)} disabled={isReminding || wasReminded}
                                  title={`Remind ${occ.assignee?.full_name || 'assignee'}`}
                                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: wasReminded ? '#EAF7F0' : 'transparent', border: `1px solid ${wasReminded ? '#A9DFBF' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', cursor: isReminding ? 'wait' : 'pointer', color: wasReminded ? '#27AE60' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                                  <Bell size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            );
          })()}
        </div>

      </div>
    );
  }

  // ── View All Tasks render ─────────────────────────────────────────────────

  function renderViewAll() {
    if (vatLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;

    const isRecurring = vatCategory !== 'Equipment';

    const visibleTasks = vatTasks.filter(t =>
      t.frequency === vatFreq && t.category === vatCategory &&
      (vatSearch === '' || t.title.toLowerCase().includes(vatSearch.toLowerCase()))
    );

    // Two-level grouping: audit_area → group_name → tasks
    const visibleByAuditArea = (() => {
      const aaMap = new Map();
      for (const task of visibleTasks) {
        const aa = task.audit_area || '';
        const gn = task.group_name || '';
        if (!aaMap.has(aa)) aaMap.set(aa, new Map());
        const gnMap = aaMap.get(aa);
        if (!gnMap.has(gn)) gnMap.set(gn, []);
        gnMap.get(gn).push(task);
      }
      return [...aaMap.entries()];
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
          {CAT_ORDER.filter(cat => vatTasks.some(t => t.category === cat)).map(cat => (
            <button key={cat} onClick={() => { setVatCategory(cat); setVatExpandedGroups(new Set()); setVatExpandedAuditAreas(new Set()); }} style={{ padding: '7px 18px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: '13px', fontWeight: vatCategory === cat ? 600 : 400, background: vatCategory === cat ? 'var(--purple-primary)' : 'transparent', color: vatCategory === cat ? 'white' : 'var(--text-secondary)' }}>
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
                  <button key={freq} onClick={() => { setVatFreq(freq); setVatExpandedGroups(new Set()); setVatExpandedAuditAreas(new Set()); }} style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${vatFreq === freq ? c.border : 'var(--border)'}`, background: vatFreq === freq ? c.bg : 'var(--bg-primary)', color: vatFreq === freq ? c.text : 'var(--text-secondary)', fontWeight: vatFreq === freq ? 600 : 400, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            ) : (() => {
              const renderSectionGroup = (groupName, groupTasks) => {
                const gateTask = groupTasks.find(t => t.conditional_text === 'on_yes');
                const gateIdx = gateTask ? groupTasks.indexOf(gateTask) : -1;
                const gateResp = gateTask ? vatResponses[gateTask.id]?.response : null;
                const isLiveCellGroup = groupName === 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time';
                const lcParentResp = isLiveCellGroup ? gateResp : null;
                const lcSubTasks = isLiveCellGroup ? groupTasks.filter(t => t.response_type === 'checkbox') : [];
                const groupKey = groupName || '__ungrouped__';
                const isOpen = !groupName || vatExpandedGroups.has(groupKey);
                const toggleGroup = () => setVatExpandedGroups(prev => { const n = new Set(prev); n.has(groupKey) ? n.delete(groupKey) : n.add(groupKey); return n; });
                const groupVisible = groupTasks.filter((t, i) => !(gateTask && i > gateIdx && gateResp !== 'yes'));
                const groupDone = groupVisible.filter(t => {
                  const r = vatResponses[t.id]?.response;
                  if (isLiveCellGroup && t.response_type === 'yes_no' && r === 'no') return true;
                  return !!r;
                }).length;
                const allGroupDone = groupVisible.length > 0 && groupDone === groupVisible.length;
                const lcAllChecked = lcSubTasks.length > 0 && lcSubTasks.every(t => vatResponses[t.id]?.response === 'checked');
                return (
                  <div key={groupName || 'ungrouped'} style={{ marginBottom: groupName ? '6px' : '0', border: groupName ? '1px solid var(--border)' : 'none', borderRadius: groupName ? 'var(--radius-md)' : 0, overflow: 'hidden' }}>
                    {groupName && (
                    <button onClick={toggleGroup} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: allGroupDone ? '#EAF7F0' : 'var(--bg-secondary)', border: 'none', cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--border)' : 'none', textAlign: 'left', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: allGroupDone ? '#27AE60' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName}</span>
                        {allGroupDone && <span style={{ fontSize: '10px', fontWeight: 600, color: '#27AE60', background: '#D5F5E3', padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>Complete</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', color: allGroupDone ? '#27AE60' : 'var(--text-muted)' }}>{groupDone}/{groupVisible.length}</span>
                        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }} />
                      </div>
                    </button>
                    )}
                    {isOpen && <div style={{ padding: groupName ? '10px 12px' : '4px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {groupTasks.map((task, taskIdx) => {
                      if (gateTask && taskIdx > gateIdx && gateResp !== 'yes') return null;
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
                              {!task.sop_trigger && task.conditional_text && !task.conditional_text.startsWith('http') && task.conditional_text !== 'on_yes' && (
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
                                    <textarea value={exc.note || ''} onChange={e => handleSopNote(task.id, e.target.value)} placeholder="Describe the exception and corrective action taken…" rows={2}
                                      style={{ width: '100%', padding: '5px 8px', border: '1px solid #F5CBA7', borderRadius: 'var(--radius-sm)', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white', marginBottom: 6 }} />
                                    {exc.photoPreview && (
                                      <img src={exc.photoPreview} alt="SOP correction" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 4, marginBottom: 6 }} />
                                    )}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'white', border: '1px solid #F5CBA7', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', color: '#E67E22', fontWeight: 500 }}>
                                        <Upload size={12} /> {exc.photo ? 'Change photo' : 'Upload photo *'}
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleSopPhotoSelect(task.id, e.target.files[0])} />
                                      </label>
                                      <button onClick={() => handleSopSubmit(task)} disabled={!exc.note?.trim() || !exc.photo || exc.submitting}
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
                    {isLiveCellGroup && !lcParentResp && (
                      <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>Select Yes or No above to continue.</div>
                    )}
                    {isLiveCellGroup && lcParentResp === 'no' && (
                      <div style={{ padding: '10px 14px', background: '#EAF7F0', borderRadius: 'var(--radius-md)', border: '1px solid #A9DFBF', fontSize: '13px', color: '#27AE60', fontWeight: 500, marginTop: '4px' }}>✓ No new live cell material this week — protocol steps not required.</div>
                    )}
                    {isLiveCellGroup && lcParentResp === 'yes' && !lcAllChecked && (
                      <div style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--danger)', fontWeight: 500, marginTop: '2px' }}>All protocol steps must be confirmed to complete this task.</div>
                    )}
                    {isLiveCellGroup && lcParentResp === 'yes' && lcAllChecked && (
                      <div style={{ padding: '10px 14px', background: '#EAF7F0', borderRadius: 'var(--radius-md)', border: '1px solid #A9DFBF', fontSize: '13px', color: '#27AE60', fontWeight: 500, marginTop: '4px' }}>✓ All quarantine protocol steps confirmed.</div>
                    )}
                    </div>}
                  </div>
                );
              };

              return visibleByAuditArea.map(([auditArea, gnMap]) => {
                if (!auditArea) {
                  return [...gnMap.entries()].map(([gn, gt]) => renderSectionGroup(gn, gt));
                }
                const aaKey = `__aa__${auditArea}`;
                const aaOpen = vatExpandedAuditAreas.has(aaKey);
                const toggleAA = () => setVatExpandedAuditAreas(prev => { const n = new Set(prev); n.has(aaKey) ? n.delete(aaKey) : n.add(aaKey); return n; });
                const aaTasks = [...gnMap.values()].flat();
                const aaTotal = aaTasks.length;
                const aaDone = aaTasks.filter(t => { const r = vatResponses[t.id]?.response; return !!r; }).length;
                const allAaDone = aaTotal > 0 && aaDone === aaTotal;
                return (
                  <div key={auditArea} style={{ marginBottom: 10 }}>
                    <button onClick={toggleAA} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: allAaDone ? '#D5F5E3' : 'var(--purple-primary)', border: 'none', borderRadius: aaOpen ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: allAaDone ? '#27AE60' : 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{auditArea}</span>
                        {allAaDone && <span style={{ fontSize: '10px', fontWeight: 600, color: '#27AE60', background: 'white', padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>Complete</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', color: allAaDone ? '#27AE60' : 'rgba(255,255,255,0.8)' }}>{aaDone}/{aaTotal}</span>
                        <ChevronDown size={14} style={{ transform: aaOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: allAaDone ? '#27AE60' : 'rgba(255,255,255,0.8)' }} />
                      </div>
                    </button>
                    {aaOpen && (
                      <div style={{ border: '1px solid var(--purple-primary)', borderTop: 'none', borderRadius: '0 0 var(--radius-md) var(--radius-md)', padding: '8px 8px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[...gnMap.entries()].map(([gn, gt]) => renderSectionGroup(gn, gt))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
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
    const categories = tree.map(n => n.cat);
    const activeCat = (step1Cat && categories.includes(step1Cat)) ? step1Cat : categories[0] || '';
    const catNode = tree.find(n => n.cat === activeCat);
    const freqs = catNode?.freqs || [];
    const activeFreq = (step1Freq && freqs.includes(step1Freq)) ? step1Freq : freqs[0] || '';
    const areas = getAuditAreasForLeaf(activeCat, activeFreq);

    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Select task scope</div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
          {categories.map(cat => {
            const sel = tasks.filter(t => t.category === cat && selectedTaskIds.has(t.id)).length;
            const isActive = cat === activeCat;
            return (
              <button key={cat} onClick={() => { setStep1Cat(cat); setStep1Freq(''); setExpandedGroups(new Set()); }}
                style={{ padding: '6px 16px', borderRadius: 20, cursor: 'pointer', userSelect: 'none',
                         background: isActive ? 'rgba(123,63,160,0.12)' : 'var(--bg-primary)',
                         color: isActive ? 'var(--purple-primary)' : 'var(--text-primary)',
                         fontWeight: isActive ? 700 : 500, fontSize: 13,
                         border: isActive ? '1px solid rgba(123,63,160,0.3)' : '1px solid var(--border)' }}>
                {cat}
                {sel > 0 && (
                  <span style={{ marginLeft: 6, background: 'var(--purple-primary)', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{sel}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Frequency pills */}
        {freqs.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {freqs.map(freq => {
              const count = tasksInLeaf(activeCat, freq).length;
              const selCount = selectedInLeaf(activeCat, freq).length;
              const isActive = freq === activeFreq;
              return (
                <button key={freq} onClick={() => { setStep1Freq(freq); setExpandedGroups(new Set()); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', userSelect: 'none',
                           border: `1px solid ${isActive ? 'var(--purple-primary)' : 'var(--border)'}`,
                           background: isActive ? 'rgba(123,63,160,0.08)' : 'var(--bg-primary)',
                           color: isActive ? 'var(--purple-primary)' : 'var(--text-secondary)',
                           fontWeight: isActive ? 700 : 400, fontSize: 12 }}>
                  <Clock size={11} />
                  {FREQ_LABEL[freq]}
                  <span style={{ background: isActive ? 'var(--purple-primary)' : 'var(--bg-secondary)', color: isActive ? 'white' : 'var(--text-muted)', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                    {selCount > 0 ? `${selCount}/${count}` : count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Audit area bars → group sub-rows → individual tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {areas.map(area => {
            const areaAllIds = area.groups.flatMap(g => g.tasks.map(t => t.id));
            const areaSelCount = areaAllIds.filter(id => selectedTaskIds.has(id)).length;
            const areaAllSel = areaSelCount === areaAllIds.length;
            const areaKey = `area::${area.name}`;
            const isAreaExpanded = expandedGroups.has(areaKey);
            const selectAllArea = () => {
              setSelectedTaskIds(prev => { const n = new Set(prev); areaAllSel ? areaAllIds.forEach(id => n.delete(id)) : areaAllIds.forEach(id => n.add(id)); return n; });
            };
            return (
              <div key={area.name} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(123,63,160,0.3)' }}>
                {/* Audit area header */}
                <div onClick={() => setExpandedGroups(prev => { const n = new Set(prev); n.has(areaKey) ? n.delete(areaKey) : n.add(areaKey); return n; })}
                  style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10, cursor: 'pointer', background: 'var(--purple-primary)', color: 'white', userSelect: 'none' }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{area.name}</span>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>{areaSelCount}/{areaAllIds.length}</span>
                  <button onClick={e => { e.stopPropagation(); selectAllArea(); }}
                    style={{ background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', color: 'white', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                    {areaAllSel ? 'Deselect all' : 'Select all'}
                  </button>
                  <ChevronDown size={14} style={{ flexShrink: 0, transform: isAreaExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                </div>

                {/* Group sub-rows */}
                {isAreaExpanded && area.groups.map(g => {
                  const gIds = g.tasks.map(t => t.id);
                  const gSelCount = gIds.filter(id => selectedTaskIds.has(id)).length;
                  const gAllSel = gSelCount === gIds.length;
                  const grpKey = `grp::${area.name}::${g.name}`;
                  const isGrpExpanded = expandedGroups.has(grpKey);
                  const isSingleGroup = area.groups.length === 1 && g.name === area.name;
                  return (
                    <div key={g.name} style={{ borderTop: '1px solid var(--border)' }}>
                      {/* Show group header only if there are multiple groups or group name differs from area */}
                      {!isSingleGroup && (
                        <div onClick={() => setExpandedGroups(prev => { const n = new Set(prev); n.has(grpKey) ? n.delete(grpKey) : n.add(grpKey); return n; })}
                          style={{ display: 'flex', alignItems: 'center', padding: '8px 16px 8px 28px', gap: 10, cursor: 'pointer', background: gSelCount > 0 ? 'rgba(123,63,160,0.04)' : 'var(--bg-secondary)', userSelect: 'none' }}>
                          <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-muted)', transform: isGrpExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {g.name}
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>{gIds.length} task{gIds.length !== 1 ? 's' : ''}{gSelCount > 0 ? ` · ${gSelCount} selected` : ''}</span>
                          </span>
                          <button onClick={e => { e.stopPropagation(); selectAllGroup(g); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple-primary)', fontSize: 11, fontWeight: 600, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                            {gAllSel ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>
                      )}
                      {/* Individual tasks — show when group expanded OR when it's a single group (auto-expand) */}
                      {(isSingleGroup || isGrpExpanded) && g.tasks.map(t => (
                        <div key={t.id} onClick={() => toggleTask(t.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10,
                                   padding: isSingleGroup ? '8px 16px 8px 28px' : '7px 16px 7px 48px',
                                   borderTop: '1px solid var(--border)',
                                   background: selectedTaskIds.has(t.id) ? 'rgba(123,63,160,0.04)' : 'var(--bg-primary)',
                                   cursor: 'pointer', userSelect: 'none' }}>
                          <input type="checkbox" checked={selectedTaskIds.has(t.id)} onChange={() => {}}
                            style={{ width: 13, height: 13, accentColor: 'var(--purple-primary)', flexShrink: 0, pointerEvents: 'none' }} />
                          <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.title}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {areas.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 8 }}>
              No tasks found for this selection
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 13, color: selectedTaskIds.size ? 'var(--purple-primary)' : 'var(--text-muted)', fontWeight: selectedTaskIds.size ? 600 : 400 }}>
            {selectedTaskIds.size > 0 ? `${selectedTaskIds.size} task${selectedTaskIds.size !== 1 ? 's' : ''} selected` : 'No tasks selected — use Select all or click individual tasks'}
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
      const ga = ta?.group_name || '';
      const gb = tb?.group_name || '';
      if (ga !== gb) return ga.localeCompare(gb);
      const na = ta?.title || '';
      const nb = tb?.title || '';
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
              const taskLabel = taskDef?.title || taskDef?.group_name || taskId;
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{taskLabel}</span>
                    {taskDef?.group_name && (
                      <span style={{ fontSize: 11, color: 'var(--purple-primary)', background: 'rgba(123,63,160,0.1)', padding: '1px 7px', borderRadius: 10, flexShrink: 0 }}>{taskDef.group_name}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
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
    if (!oneOffForm.title.trim() || oneOffForm.assigneeIds.length === 0) {
      setOneOffError('Please enter a title and assign to at least one person.');
      return;
    }
    setOneOffSaving(true);
    setOneOffError('');
    const rows = oneOffForm.assigneeIds.map(uid => ({
      title: oneOffForm.title.trim(),
      description: oneOffForm.description.trim() || null,
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
    setOneOffForm({ title: '', description: '', assigneeIds: [], dueDate: '', showOnPublic: false });
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

    // People who have at least one task
    const peopleWithTasks = profiles.filter(p => oneOffTasks.some(t => t.assigned_to === p.id));


    // Search + person filter for task list below
    const searchQ = oneOffSearch.trim().toLowerCase();
    const tasksForTab = oneOffTasks.filter(t => {
      if (oneOffPersonTab !== 'all' && t.assigned_to !== oneOffPersonTab) return false;
      if (searchQ && !t.title.toLowerCase().includes(searchQ) && !(t.description || '').toLowerCase().includes(searchQ)) return false;
      return true;
    });
    const pendingForTab = tasksForTab.filter(t => t.status !== 'done');
    const doneForTab    = tasksForTab.filter(t => t.status === 'done');

    const TaskRow = ({ task }) => {
      const isDone = task.status === 'done';
      const isOverdue = !isDone && task.due_date && task.due_date < todayStr;
      const isConfirmDelete = confirmDeleteOneOff === task.id;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: 8, border: `1px solid ${isOverdue ? '#fca5a5' : 'var(--border)'}`, opacity: isDone ? 0.55 : 1 }}>
          <input type="checkbox" checked={isDone} onChange={() => handleOneOffToggleDone(task)}
            style={{ width: 15, height: 15, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--purple-primary)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
            {task.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</div>}
          </div>
          {oneOffPersonTab === 'all' && task.assignee?.full_name && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{task.assignee.full_name}</span>
          )}
          {task.show_on_public_dashboard && <Globe size={12} color="var(--purple-primary)" style={{ flexShrink: 0 }} />}
          {task.due_date ? (
            <span style={{ fontSize: 11, color: isOverdue ? '#ef4444' : 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap', fontWeight: isOverdue ? 600 : 400 }}>
              {fmtDate(task.due_date)}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              Assigned {task.created_at ? fmtDate(task.created_at.slice(0, 10)) : ''}
            </span>
          )}
          {isOverdue && <AlertTriangle size={11} color="#ef4444" style={{ flexShrink: 0 }} />}
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
    };

    return (
      <div>

        {/* ── CREATE FORM ── */}
        <div style={{ marginBottom: 24, padding: 20, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Create Ad hoc Task</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task Name</label>
                {(() => { const wc = oneOffForm.title.trim() ? oneOffForm.title.trim().split(/\s+/).length : 0; return wc > 8 ? <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⚠ {wc}/8 words — keep it short</span> : wc > 0 ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wc}/8 words</span> : null; })()}
              </div>
              <input value={oneOffForm.title} onChange={e => setOneOffForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Short task name (8 words max)"
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${oneOffForm.title.trim().split(/\s+/).filter(Boolean).length > 8 ? '#f59e0b' : 'var(--border)'}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Task Description <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <textarea value={oneOffForm.description} onChange={e => setOneOffForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Full details, context, or instructions" rows={2}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Due Date</label>
              <input type="date" value={oneOffForm.dueDate} onChange={e => setOneOffForm(p => ({ ...p, dueDate: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
              <input type="checkbox" id="one-off-public" checked={oneOffForm.showOnPublic}
                onChange={e => setOneOffForm(p => ({ ...p, showOnPublic: e.target.checked }))}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--purple-primary)' }} />
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
                  }))} style={{ padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: selected ? 600 : 400, cursor: 'pointer', border: `1.5px solid ${selected ? 'var(--purple-primary)' : 'var(--border)'}`, background: selected ? 'var(--purple-faint)' : 'transparent', color: selected ? 'var(--purple-primary)' : 'var(--text-secondary)' }}>
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

        {/* ── TASK LIST (person subtabs + search) ── */}
        {oneOffLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
        ) : oneOffTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>No ad hoc tasks yet.</div>
        ) : (
          <div>
            {/* Search */}
            <div style={{ marginBottom: 14 }}>
              <input value={oneOffSearch} onChange={e => setOneOffSearch(e.target.value)}
                placeholder="Search tasks across all users…"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Person subtabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 16, flexWrap: 'wrap' }}>
              {[{ id: 'all', label: 'All', count: oneOffTasks.length }, ...peopleWithTasks.map(p => ({ id: p.id, label: fmtName(p.full_name), count: oneOffTasks.filter(t => t.assigned_to === p.id).length }))].map(tab => (
                <button key={tab.id} onClick={() => setOneOffPersonTab(tab.id)} style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: oneOffPersonTab === tab.id ? 'var(--purple-primary)' : 'var(--text-muted)', borderBottom: `2px solid ${oneOffPersonTab === tab.id ? 'var(--purple-primary)' : 'transparent'}`, marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {tab.label}
                  <span style={{ fontSize: 11, background: oneOffPersonTab === tab.id ? 'var(--purple-faint)' : 'var(--bg-secondary)', color: oneOffPersonTab === tab.id ? 'var(--purple-primary)' : 'var(--text-muted)', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Task rows */}
            {pendingForTab.length === 0 && doneForTab.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                {searchQ ? 'No tasks match your search.' : 'No tasks for this person.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingForTab.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                      Pending · {pendingForTab.length}
                    </div>
                    {pendingForTab.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).map(t => <TaskRow key={t.id} task={t} />)}
                  </>
                )}
                {doneForTab.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '12px 0 4px' }}>
                      Completed · {doneForTab.length}
                    </div>
                    {doneForTab.sort((a, b) => (b.due_date || '').localeCompare(a.due_date || '')).map(t => <TaskRow key={t.id} task={t} />)}
                  </>
                )}
              </div>
            )}
          </div>
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
    const steps = ['Scope', 'Recurrent Tasks', 'Assignees', 'Date range', 'Occurrences', 'Preview'];
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
    ...(canManage ? [
      { id: 'view-all',     label: 'Recurrent Tasks' },
      { id: 'oneoff',       label: 'Ad hoc Tasks' },
      { id: 'calendar',     label: 'Calendar' },
      { id: 'productivity', label: 'Productivity' },
      { id: 'assigned',     label: 'Recurrent Task Assignments', badge: unassignedCount || null },
    ] : []),
    { id: 'my-tasks', label: 'My Tasks', badge: null },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Task assignment</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Recurrent tasks · admin view</p>
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
      {canManage && tab === 'view-all' && (
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

      {canManage && tab === 'calendar' && (
        <div style={card}>
          {renderCalendar()}
        </div>
      )}

      {canManage && tab === 'productivity' && (
        <div style={card}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Task Productivity Evaluations</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              Score 0–100 based on % of tasks completed on time. Recurrent = MISC/PM/Equipment. Ad hoc = all other assigned tasks.
            </div>
          </div>
          {renderProductivity()}
        </div>
      )}

      {canManage && tab === 'assigned' && (
        <div style={card}>
          {renderAssignedTab()}
        </div>
      )}

      {tab === 'my-tasks' && (
        <div style={card}>
          {renderMyTasksTab()}
        </div>
      )}

      {canManage && tab === 'oneoff' && (
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
