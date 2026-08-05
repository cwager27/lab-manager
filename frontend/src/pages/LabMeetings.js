import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fmtName, sortByLast } from '../lib/nameUtils';
import { Plus, X, Star, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

const ZOOM_KEY_OPTIONS = ['Meeting ID', 'Passcode', 'Webinar ID', 'Other'];
const ZOOM_SHORT = { 'Meeting ID': 'ID', 'Passcode': 'PW', 'Webinar ID': 'WID' };

function buildZoomInfo(fields) {
  const valid = (fields || [])
    .map(f => ({ key: f.key === 'Other' ? (f.customKey || 'Other') : f.key, value: f.value }))
    .filter(f => f.value && f.value.trim());
  return valid.length ? JSON.stringify(valid) : null;
}

function formatZoomInfo(jsonStr) {
  if (!jsonStr) return '';
  try {
    const parsed = JSON.parse(jsonStr);
    return parsed.filter(f => f.value).map(f => `${ZOOM_SHORT[f.key] || f.key}: ${f.value}`).join(' · ');
  } catch { return jsonStr; }
}

function parseZoomInfo(jsonStr) {
  if (!jsonStr) return [{ key: 'Meeting ID', value: '', customKey: '' }];
  try {
    const parsed = JSON.parse(jsonStr);
    return parsed.map(f => ({
      key: ZOOM_KEY_OPTIONS.includes(f.key) ? f.key : 'Other',
      value: f.value,
      customKey: ZOOM_KEY_OPTIONS.includes(f.key) ? '' : f.key,
    }));
  } catch { return [{ key: 'Meeting ID', value: '', customKey: '' }]; }
}

const STATUS_STYLES = {
  scheduled: { bg: '#EBF5FB', text: '#2980B9', label: 'Scheduled' },
  completed: { bg: '#EAF7F0', text: '#27AE60', label: 'Completed' },
  cancelled: { bg: '#F2F3F4', text: '#9A9AB0', label: 'Cancelled' },
};

const EMPTY_MEETING = {
  meeting_date: '', presenter_id: '', guest_name: '', guest_title: '',
  is_sof: false, sof_topic: '', notes: '', status: 'scheduled',
  zoom_link: '', zoom_info_fields: [{ key: 'Meeting ID', value: '', customKey: '' }],
};

function isOnVacationFn(memberId, date, vacations) {
  if (!memberId || !date) return false;
  return vacations.some(v => v.requested_by === memberId && v.start_date <= date && v.end_date >= date);
}

function isHoliday(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  if (month === 7 && day === 4) return 'Independence Day';
  if (month === 12 && day === 25) return 'Christmas';
  if (month === 11 && d.getDay() === 4) {
    const firstDow = new Date(year, 10, 1).getDay();
    const firstThu = firstDow <= 4 ? 5 - firstDow : 12 - firstDow;
    if (day === firstThu + 21) return 'Thanksgiving';
  }
  return null;
}

// Rotor: picks presenter who went longest ago (or never) among is_presenter members.
// Never picks the immediately previous presenter (no back-to-back).
// `history` = all non-cancelled lab meetings up to (not including) target date.
function getRotorPresenter(history, presenters, date, vacations, excludeId = null) {
  if (isHoliday(date)) return null;
  const valid = history
    .filter(m => m.status !== 'cancelled' && m.presenter_id)
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));

  const lastDate = {};
  valid.forEach(m => { lastDate[m.presenter_id] = m.meeting_date; });

  // The most recent non-cancelled presenter before this date
  const prevPresenterId = valid.length ? valid[valid.length - 1].presenter_id : null;

  const sortFn = (a, b) => {
    const la = lastDate[a.id], lb = lastDate[b.id];
    if (!la && !lb) return (a.full_name || '').localeCompare(b.full_name || '');
    if (!la) return -1;
    if (!lb) return 1;
    return la.localeCompare(lb);
  };

  // Prefer someone who isn't the previous presenter
  const preferred = presenters.filter(p =>
    p.id !== excludeId && p.id !== prevPresenterId && !isOnVacationFn(p.id, date, vacations)
  );
  if (preferred.length) return [...preferred].sort(sortFn)[0];

  // Fallback: allow previous presenter only if no one else is available
  const fallback = presenters.filter(p =>
    p.id !== excludeId && !isOnVacationFn(p.id, date, vacations)
  );
  return fallback.length ? [...fallback].sort(sortFn)[0] : null;
}

export default function LabMeetings({ userRole, userId, profile }) {
  const [labMeetings, setLabMeetings] = useState([]);
  const [adhocMeetings, setAdhocMeetings] = useState([]);
  const [members, setMembers] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [labFilter, setLabFilter] = useState(String(new Date().getFullYear()));
  const [adhocFilter, setAdhocFilter] = useState('upcoming');
  const [showAddForm, setShowAddForm] = useState(null);
  const [newMeeting, setNewMeeting] = useState(EMPTY_MEETING);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue] = useState('');
  const [guestNameEdit, setGuestNameEdit] = useState('');
  const [guestTitleEdit, setGuestTitleEdit] = useState('');
  const [vacWarn, setVacWarn] = useState(null);
  const [editingZoomInfo, setEditingZoomInfo] = useState(null);

  const canEdit = userRole === 'pm' || profile?.full_name?.toLowerCase().startsWith('mia');
  const today = new Date().toISOString().split('T')[0];
  const presenters = members.filter(m => m.is_presenter);
  const fixingRef = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [{ data: allMeetings }, { data: memberData }, { data: vacData }] = await Promise.all([
      supabase.from('lab_meetings').select('*, presenter:profiles!lab_meetings_presenter_id_fkey(id, full_name, email)').order('meeting_date'),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('vacation_requests').select('*').eq('status', 'approved'),
    ]);
    if (fixingRef.current) return; // suppress realtime updates while fixRotation is writing
    const all = allMeetings || [];
    setLabMeetings(all.filter(m => m.meeting_type !== 'adhoc_meeting'));
    setAdhocMeetings(all.filter(m => m.meeting_type === 'adhoc_meeting'));
    setMembers(sortByLast(memberData || []));
    setVacations(vacData || []);
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ch = supabase.channel('lab_mt').on('postgres_changes', { event: '*', schema: 'public', table: 'lab_meetings' }, fetchData).subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchData]);

  function tblName() { return 'lab_meetings'; }
  function getMeetings(table) { return table === 'lab' ? labMeetings : adhocMeetings; }

  function warnVacation(memberId, date) {
    const vac = vacations.find(v => v.requested_by === memberId && v.start_date <= date && v.end_date >= date);
    if (vac) {
      const name = members.find(m => m.id === memberId)?.full_name || 'This person';
      setVacWarn(`⚠ ${name} is out ${vac.start_date} – ${vac.end_date}. Assignment saved.`);
      setTimeout(() => setVacWarn(null), 6000);
    }
  }

  function startEdit(id, field, value, table, extra) {
    if (!canEdit) return;
    setEditingCell({ id, field, table });
    setCellValue(value ?? '');
    if (extra !== undefined) setGuestNameEdit(extra);
    if (field === 'presenter_id') {
      const mtg = getMeetings(table).find(m => m.id === id);
      setGuestTitleEdit(mtg?.guest_title || '');
    }
  }

  async function commitEdit(id, field, value, table) {
    const meeting = getMeetings(table).find(m => m.id === id);
    if (!meeting) return;

    const update = { updated_at: new Date().toISOString() };

    if (field === 'presenter_id') {
      if (value === 'guest') {
        update.presenter_id = null;
        update.guest_name = guestNameEdit || null;
        update.guest_title = guestTitleEdit || null;
      } else {
        update.presenter_id = value || null;
        update.guest_name = null;
        if (value) warnVacation(value, meeting.meeting_date);
      }
    } else {
      update[field] = value || null;
    }

    await supabase.from(tblName()).update(update).eq('id', id);

    if (field === 'presenter_id' && value !== (meeting.presenter_id || '')) {
      const oldP = members.find(m => m.id === meeting.presenter_id);
      const newP = members.find(m => m.id === (value !== 'guest' ? value : null));
      if (oldP || newP) {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/meeting-presenter-changed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingDate: meeting.meeting_date,
            oldPresenterEmail: oldP?.email, oldPresenterName: oldP?.full_name,
            newPresenterEmail: newP?.email,
            newPresenterName: newP?.full_name || (value === 'guest' ? guestNameEdit : ''),
            changedByName: profile?.full_name,
          }),
        });
      }
    }

    setEditingCell(null);
    setCellValue('');

    // After a lab presenter swap, re-sequence all future TBD lab meetings
    if (field === 'presenter_id' && table === 'lab' && value !== (meeting.presenter_id || '')) {
      const updatedAll = [...labMeetings, ...adhocMeetings].map(m =>
        m.id === id ? { ...m, presenter_id: update.presenter_id ?? null, guest_name: update.guest_name ?? null } : m
      );
      await resequenceFutureMeetings(meeting.meeting_date, updatedAll);
    }

    fetchData(true);
  }

  // Full reset from a chosen date: clears and re-runs the cycle, leaving earlier meetings untouched.
  async function fixRotation() {
    const fromDate = window.prompt(
      'Re-assign all lab meetings from this date onwards (YYYY-MM-DD).\n\nMeetings before this date are left untouched.',
      today
    );
    if (!fromDate || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate.trim())) return;
    const cleanDate = fromDate.trim();

    const pool = presenters.length ? presenters : members;
    if (!pool.length) { alert('No members found. Please refresh and try again.'); return; }

    const toFix = labMeetings
      .filter(m => m.status === 'scheduled' && m.meeting_date >= cleanDate)
      .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
    if (!toFix.length) { alert(`No scheduled meetings found on or after ${cleanDate}.`); return; }

    // Compute planned assignments first (preview before writing)
    let working = labMeetings.map(m =>
      toFix.find(f => f.id === m.id) ? { ...m, presenter_id: null } : m
    );
    const plan = [];
    for (const mtg of toFix) {
      const holiday = isHoliday(mtg.meeting_date);
      if (holiday) { plan.push({ mtg, next: null, holiday }); continue; }
      const history = working.filter(m => m.meeting_date < mtg.meeting_date);
      const next = getRotorPresenter(history, pool, mtg.meeting_date, vacations);
      plan.push({ mtg, next, holiday: null });
      if (next) working = working.map(m => m.id === mtg.id ? { ...m, presenter_id: next.id } : m);
    }

    const preview = plan.slice(0, 12).map(({ mtg, next, holiday }) =>
      `${mtg.meeting_date}: ${holiday ? `🏖 ${holiday}` : (next?.full_name || 'TBD (no one available)')}`
    ).join('\n');
    const poolNames = pool.map(p => p.full_name).join(', ');
    if (!window.confirm(
      `Pool (${pool.length}): ${poolNames}\n\nPlanned assignments:\n${preview}${plan.length > 12 ? `\n…and ${plan.length - 12} more` : ''}\n\nApply?`
    )) return;

    // Lock out realtime-triggered fetchData calls during writes so they can't clobber the result
    fixingRef.current = true;
    setSaving(true);
    try {
      await Promise.all(toFix.map(m =>
        supabase.from('lab_meetings').update({ presenter_id: null, updated_at: new Date().toISOString() }).eq('id', m.id)
      ));
      await Promise.all(plan
        .filter(({ next }) => next)
        .map(({ mtg, next }) =>
          supabase.from('lab_meetings').update({ presenter_id: next.id, updated_at: new Date().toISOString() }).eq('id', mtg.id)
        )
      );
    } finally {
      fixingRef.current = false;
      setSaving(false);
    }

    // One clean fetch now that all writes are committed and the lock is released
    await fetchData(true);
  }

  // Re-assigns all future TBD lab meetings in cycle order after a change.
  async function resequenceFutureMeetings(fromDate, updatedMeetings) {
    const pool = presenters.length ? presenters : members;
    if (!pool.length) return;
    const futureTbd = updatedMeetings
      .filter(m => m.meeting_type !== 'adhoc_meeting' && m.status === 'scheduled' && !m.presenter_id && m.meeting_date >= fromDate)
      .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
    if (!futureTbd.length) return;
    let working = [...updatedMeetings];
    for (const mtg of futureTbd) {
      if (isHoliday(mtg.meeting_date)) continue;
      const history = working.filter(m => m.meeting_type !== 'adhoc_meeting' && m.meeting_date < mtg.meeting_date);
      const next = getRotorPresenter(history, pool, mtg.meeting_date, vacations);
      if (next) {
        await supabase.from('lab_meetings').update({ presenter_id: next.id, updated_at: new Date().toISOString() }).eq('id', mtg.id);
        working = working.map(m => m.id === mtg.id ? { ...m, presenter_id: next.id } : m);
      }
    }
  }

  async function handleCancelMeeting(id, table) {
    const meeting = getMeetings(table).find(m => m.id === id);
    if (!meeting) return;

    // Optimistic update: reflect cancellation in UI immediately
    const setter = table === 'lab' ? setLabMeetings : setAdhocMeetings;
    setter(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled', presenter_id: null } : m));

    // Persist cancellation to DB
    supabase.from(tblName()).update({
      status: 'cancelled', presenter_id: null, updated_at: new Date().toISOString(),
    }).eq('id', id);

    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/meeting-cancelled`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingDate: meeting.meeting_date, cancelledByName: profile?.full_name }),
    });

    if (table === 'lab' && meeting.presenter_id && meeting.meeting_date) {
      // Shift: cancelled presenter moves to next slot, everyone else pushes down one
      const futureSlots = labMeetings
        .filter(m => m.id !== id && m.status === 'scheduled' && m.meeting_date > meeting.meeting_date && !isHoliday(m.meeting_date))
        .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));

      if (futureSlots.length > 0) {
        const newQueue = [meeting.presenter_id, ...futureSlots.map(m => m.presenter_id).filter(Boolean)];
        const ts = new Date().toISOString();

        // Optimistic: update shifted assignments in local state immediately
        setLabMeetings(prev => prev.map(m => {
          const idx = futureSlots.findIndex(f => f.id === m.id);
          if (idx === -1) return m;
          const newPresenterId = newQueue[idx] ?? null;
          const presenter = newPresenterId ? members.find(mb => mb.id === newPresenterId) ?? null : null;
          return { ...m, presenter_id: newPresenterId, presenter: presenter ? { id: presenter.id, full_name: presenter.full_name, email: presenter.email } : null };
        }));

        // Persist shift to DB in background
        fixingRef.current = true;
        Promise.all(
          futureSlots.map((m, i) =>
            supabase.from('lab_meetings').update({ presenter_id: newQueue[i] ?? null, updated_at: ts }).eq('id', m.id)
          )
        ).finally(() => {
          fixingRef.current = false;
          fetchData(true);
        });
      } else {
        fetchData(true);
      }
    } else {
      fetchData(true);
    }
  }

  async function commitZoomInfo(meetingId, fields) {
    const json = buildZoomInfo(fields);
    await supabase.from(tblName()).update({ zoom_info: json, updated_at: new Date().toISOString() }).eq('id', meetingId);
    setEditingZoomInfo(null);
    fetchData(true);
  }

  async function handleAddMeeting(e) {
    e.preventDefault();
    if (!showAddForm || !newMeeting.meeting_date) return;
    setSaving(true);

    const meetings = getMeetings(showAddForm);
    let presenterId = newMeeting.presenter_id || null;
    if (!presenterId && newMeeting.presenter_id !== 'guest') {
      const pool = showAddForm === 'lab' ? (presenters.length ? presenters : members) : members;
      const fair = showAddForm === 'lab'
        ? getRotorPresenter(labMeetings, pool, newMeeting.meeting_date, vacations)
        : getRotorPresenter(meetings, pool, newMeeting.meeting_date, vacations);
      if (fair) presenterId = fair.id;
    }

    await supabase.from(tblName()).insert([{
      meeting_date: newMeeting.meeting_date,
      presenter_id: newMeeting.presenter_id === 'guest' ? null : (presenterId || null),
      guest_name: newMeeting.presenter_id === 'guest' ? (newMeeting.guest_name || null) : null,
      guest_title: newMeeting.presenter_id === 'guest' ? (newMeeting.guest_title || null) : null,
      is_sof: newMeeting.is_sof,
      sof_topic: newMeeting.sof_topic || null,
      notes: newMeeting.notes || null,
      status: 'scheduled',
      meeting_type: showAddForm === 'adhoc' ? 'adhoc_meeting' : 'lab_meeting',
      ...(showAddForm === 'adhoc' && {
        zoom_link: newMeeting.zoom_link || null,
        zoom_info: buildZoomInfo(newMeeting.zoom_info_fields),
      }),
    }]);

    const presenter = members.find(m => m.id === presenterId);
    await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/meeting-added`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingDate: newMeeting.meeting_date,
        presenterName: presenter?.full_name || newMeeting.guest_name || 'TBD',
        isSof: newMeeting.is_sof, addedByName: profile?.full_name,
      }),
    });

    setShowAddForm(null);
    setNewMeeting(EMPTY_MEETING);
    setSaving(false);
    fetchData(true);
  }

  function getFiltered(meetings, filter) {
    if (/^\d{4}$/.test(filter)) return meetings.filter(m => m.meeting_date?.startsWith(filter));
    if (filter === 'upcoming') return meetings.filter(m => m.meeting_date >= today);
    if (filter === 'past') return meetings.filter(m => m.meeting_date < today);
    if (filter === 'cancelled') return meetings.filter(m => m.status === 'cancelled');
    if (filter === 'sof') return meetings.filter(m => m.is_sof);
    return meetings;
  }

  function renderRow(meeting, table) {
    const ec = editingCell;
    const editing = (field) => ec?.id === meeting.id && ec?.field === field && ec?.table === table;
    const presenterName = fmtName(meeting.presenter?.full_name) || meeting.guest_name || '';
    const onVac = meeting.presenter_id && isOnVacationFn(meeting.presenter_id, meeting.meeting_date, vacations);
    const statusStyle = STATUS_STYLES[meeting.status] || STATUS_STYLES.scheduled;
    const isPast = meeting.meeting_date < today;
    const isAdhoc = table === 'adhoc';
    const gridTemplate = isAdhoc ? '70px 1fr 120px 80px 80px 48px 1fr 22px' : '74px 1fr 28px 80px 1fr 1fr 22px';
    const awayMembers = members.filter(m => vacations.some(v => v.requested_by === m.id && v.start_date <= meeting.meeting_date && v.end_date >= meeting.meeting_date));
    const holiday = !isAdhoc ? isHoliday(meeting.meeting_date) : null;

    return (
      <div key={meeting.id} style={{
        display: 'grid', gridTemplateColumns: gridTemplate,
        gap: isAdhoc ? '8px' : '6px', padding: '5px 8px', alignItems: isAdhoc ? 'start' : 'center',
        background: (!isAdhoc && meeting.is_sof) ? 'var(--purple-faint)' : 'var(--bg-card)',
        border: `1px solid ${(!isAdhoc && meeting.is_sof) ? 'var(--purple-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', marginBottom: '3px', fontSize: '17px',
        opacity: meeting.status === 'cancelled' ? 0.55 : 1,
      }}>

        {/* Date */}
        {editing('meeting_date') ? (
          <input type="date" autoFocus value={cellValue} onChange={e => setCellValue(e.target.value)}
            onBlur={() => commitEdit(meeting.id, 'meeting_date', cellValue, table)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(meeting.id, 'meeting_date', cellValue, table); if (e.key === 'Escape') setEditingCell(null); }}
            style={{ fontSize: '15px', padding: '2px 3px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
        ) : (
          <span onClick={() => startEdit(meeting.id, 'meeting_date', meeting.meeting_date, table)}
            style={{ cursor: canEdit ? 'pointer' : 'default', color: isPast ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 500 }}
            title={canEdit ? 'Click to edit' : ''}>
            {new Date(meeting.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}

        {/* Description (adhoc only, before Presenter) */}
        {isAdhoc && (
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            {editing('notes') ? (
              <input autoFocus value={cellValue} onChange={e => setCellValue(e.target.value)}
                onBlur={() => commitEdit(meeting.id, 'notes', cellValue, table)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(meeting.id, 'notes', cellValue, table); if (e.key === 'Escape') setEditingCell(null); }}
                style={{ fontSize: '17px', padding: '2px 6px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            ) : (
              <span onClick={() => startEdit(meeting.id, 'notes', meeting.notes || '', table)}
                title={meeting.notes || (canEdit ? 'Click to add description' : '')}
                style={{ cursor: canEdit ? 'pointer' : 'default', display: 'block', color: meeting.notes ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: meeting.notes ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {meeting.notes || (canEdit ? '+ description' : '—')}
              </span>
            )}
          </div>
        )}

        {/* Presenter */}
        <div style={{ overflow: 'hidden', minWidth: 0 }}>
          {editing('presenter_id') ? (
            <div>
              <select autoFocus value={cellValue}
                onChange={async e => {
                  const val = e.target.value;
                  setCellValue(val);
                  if (val !== 'guest') {
                    if (val && isOnVacationFn(val, meeting.meeting_date, vacations)) warnVacation(val, meeting.meeting_date);
                    await commitEdit(meeting.id, 'presenter_id', val, table);
                  }
                }}
                onBlur={() => { if (cellValue !== 'guest') setEditingCell(null); }}
                style={{ fontSize: '17px', padding: '2px 3px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%' }}>
                <option value="">TBD</option>
                {(isAdhoc ? members : (presenters.length ? presenters : members)).map(m => {
                  const ov = isOnVacationFn(m.id, meeting.meeting_date, vacations);
                  return <option key={m.id} value={m.id}>{fmtName(m.full_name)}{ov ? ' ⚠' : ''}</option>;
                })}
                <option value="guest">Guest speaker</option>
              </select>
              {cellValue === 'guest' && (
                <>
                  <input autoFocus placeholder="Guest name…" value={guestNameEdit}
                    onChange={e => setGuestNameEdit(e.target.value)}
                    onBlur={() => commitEdit(meeting.id, 'presenter_id', 'guest', table)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(meeting.id, 'presenter_id', 'guest', table); if (e.key === 'Escape') setEditingCell(null); }}
                    style={{ fontSize: '17px', padding: '2px 6px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%', marginTop: '4px', boxSizing: 'border-box' }} />
                  <input placeholder="Title (optional)" value={guestTitleEdit}
                    onChange={e => setGuestTitleEdit(e.target.value)}
                    onBlur={() => commitEdit(meeting.id, 'presenter_id', 'guest', table)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(meeting.id, 'presenter_id', 'guest', table); if (e.key === 'Escape') setEditingCell(null); }}
                    style={{ fontSize: '15px', padding: '2px 6px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%', marginTop: '3px', boxSizing: 'border-box' }} />
                </>
              )}
            </div>
          ) : (
            <span onClick={() => startEdit(meeting.id, 'presenter_id', meeting.presenter_id || (meeting.guest_name ? 'guest' : ''), table, meeting.guest_name || '')}
              title={onVac ? '⚠ Out of office — click to reassign' : (canEdit ? 'Click to edit' : '')}
              style={{ cursor: canEdit ? 'pointer' : 'default', fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: onVac ? '#E67E22' : 'var(--text-primary)' }}>
              {presenterName
                ? <>
                    {presenterName}{onVac && <AlertTriangle size={11} style={{ marginLeft: '3px', verticalAlign: 'middle' }} />}
                    {meeting.guest_title && (
                      <span style={{ display: 'block', fontSize: '14px', fontWeight: 400, color: 'var(--text-muted)', marginTop: '1px' }}>{meeting.guest_title}</span>
                    )}
                    {meeting.presenter_id && meeting.confirmation_status !== 'confirmed' && (
                      <span style={{ display: 'block', fontSize: '14px', fontWeight: 400, color: '#E67E22', marginTop: '1px' }}>Invite pending acceptance</span>
                    )}
                  </>
                : <em style={{ color: 'var(--text-muted)', fontWeight: 400 }}>TBD</em>}
            </span>
          )}
        </div>

        {/* SOF star (lab only) */}
        {!isAdhoc && <button onClick={canEdit ? async () => {
            await supabase.from(tblName()).update({ is_sof: !meeting.is_sof, updated_at: new Date().toISOString() }).eq('id', meeting.id);
            fetchData(true);
          } : undefined}
          disabled={!canEdit} title={canEdit ? (meeting.is_sof ? 'Remove SOF' : 'Mark SOF') : (meeting.is_sof ? 'SOF' : '')}
          style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !meeting.is_sof && !canEdit ? 0 : 1 }}>
          <Star size={13} color={meeting.is_sof ? '#7B3FA0' : 'var(--border)'} fill={meeting.is_sof ? '#7B3FA0' : 'none'} />
        </button>}

        {/* Status */}
        {editing('status') ? (
          <select autoFocus value={cellValue}
            onChange={async e => { setCellValue(e.target.value); await commitEdit(meeting.id, 'status', e.target.value, table); }}
            onBlur={() => setEditingCell(null)}
            style={{ fontSize: '15px', padding: '2px 3px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%' }}>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        ) : (
          <span onClick={() => startEdit(meeting.id, 'status', meeting.status, table)}
            title={canEdit ? 'Click to edit' : ''} style={{ cursor: canEdit ? 'pointer' : 'default', display: 'inline-block', padding: '2px 6px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text }}>
            {statusStyle.label}
          </span>
        )}

        {/* Away (adhoc only) */}
        {isAdhoc && (
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            {awayMembers.length > 0 ? (
              <span
                title={awayMembers.map(m => m.full_name).join(' · ')}
                style={{ fontSize: '14px', color: '#E67E22', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {awayMembers.map(m => m.full_name?.split(' ').pop() || m.full_name).join(', ')}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>—</span>
            )}
          </div>
        )}

        {/* Zoom Link (adhoc only) */}
        {isAdhoc && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {editing('zoom_link') ? (
              <input autoFocus value={cellValue} onChange={e => setCellValue(e.target.value)}
                onBlur={() => commitEdit(meeting.id, 'zoom_link', cellValue, table)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(meeting.id, 'zoom_link', cellValue, table); if (e.key === 'Escape') setEditingCell(null); }}
                placeholder="https://…"
                style={{ fontSize: '14px', padding: '2px 4px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            ) : meeting.zoom_link ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <a href={meeting.zoom_link} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#3B5BDB', display: 'flex', alignItems: 'center' }} title="Join Zoom">
                  <ExternalLink size={13} />
                </a>
                {canEdit && (
                  <span onClick={() => startEdit(meeting.id, 'zoom_link', meeting.zoom_link, table)}
                    style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1 }}>✎</span>
                )}
              </div>
            ) : canEdit ? (
              <span onClick={() => startEdit(meeting.id, 'zoom_link', '', table)}
                style={{ cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>+ link</span>
            ) : null}
          </div>
        )}

        {/* Zoom Info (adhoc only) — each field on its own line */}
        {isAdhoc && (
          <div style={{ minWidth: 0 }}>
            {meeting.zoom_info ? (() => {
              let fields = [];
              try { fields = JSON.parse(meeting.zoom_info).filter(f => f.value); } catch {}
              return (
                <div
                  onClick={() => canEdit && setEditingZoomInfo({ meetingId: meeting.id, fields: parseZoomInfo(meeting.zoom_info) })}
                  style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                  {fields.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 4, lineHeight: 1.6 }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {ZOOM_SHORT[f.key] || f.key}:
                      </span>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })() : canEdit ? (
              <span onClick={() => setEditingZoomInfo({ meetingId: meeting.id, fields: [{ key: 'Meeting ID', value: '', customKey: '' }] })}
                style={{ cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>+ info</span>
            ) : null}
          </div>
        )}

        {/* Away (lab only) */}
        {!isAdhoc && (
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            {holiday ? (
              <span style={{ fontSize: '14px', color: '#E74C3C', fontWeight: 600 }}>🏖 {holiday}</span>
            ) : awayMembers.length > 0 ? (
              <span title={awayMembers.map(m => m.full_name).join(' · ')}
                style={{ fontSize: '14px', color: '#E67E22', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {awayMembers.map(m => m.full_name?.split(' ').pop() || m.full_name).join(', ')}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>—</span>
            )}
          </div>
        )}

        {/* Notes (lab only — adhoc shows Description before Presenter) */}
        {!isAdhoc && (
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            {editing('notes') ? (
              <input autoFocus value={cellValue} onChange={e => setCellValue(e.target.value)}
                onBlur={() => commitEdit(meeting.id, 'notes', cellValue, table)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(meeting.id, 'notes', cellValue, table); if (e.key === 'Escape') setEditingCell(null); }}
                style={{ fontSize: '17px', padding: '2px 6px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            ) : (
              <span onClick={() => startEdit(meeting.id, 'notes', meeting.notes || '', table)}
                title={meeting.notes || (canEdit ? 'Click to add note' : '')}
                style={{ cursor: canEdit ? 'pointer' : 'default', display: 'block', color: meeting.notes ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: meeting.notes ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {meeting.notes || (canEdit ? '+ note' : '—')}
              </span>
            )}
          </div>
        )}

        {/* Cancel / Uncancel */}
        {canEdit ? (
          meeting.status === 'cancelled' ? (
            <button onClick={() => { supabase.from(tblName()).update({ status: 'scheduled', updated_at: new Date().toISOString() }).eq('id', meeting.id).then(() => fetchData(true)); }}
              title="Restore meeting"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={12} />
            </button>
          ) : (
            <button onClick={() => handleCancelMeeting(meeting.id, table)} title="Cancel meeting"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} />
            </button>
          )
        ) : <span />}
      </div>
    );
  }

  function renderPanel(table, filter, setFilter) {
    const meetings = getMeetings(table);
    const filtered = getFiltered(meetings, filter);
    const isLab = table === 'lab';

    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <h2 style={{ fontSize: '21px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {isLab ? 'Lab Meetings' : 'Ad-hoc Meetings'}
            </h2>
            {isLab && (
              <div style={{ display: 'flex', gap: '5px', marginTop: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', color: 'var(--text-muted)', marginRight: '2px' }}>Thu 1:30–3pm</span>
                <a href="https://zoom.us/j/98770400275" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'var(--purple-primary)', color: 'white', padding: '2px 9px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, textDecoration: 'none' }}>
                  <ExternalLink size={10} /> Join Zoom
                </a>
                <span style={{ background: 'var(--purple-primary)', color: 'white', padding: '2px 9px', borderRadius: '10px', fontSize: '15px', fontWeight: 600 }}>
                  ID: 987 7040 0275
                </span>
                <span style={{ background: 'var(--purple-primary)', color: 'white', padding: '2px 9px', borderRadius: '10px', fontSize: '15px', fontWeight: 600 }}>
                  PW: 676073
                </span>
              </div>
            )}
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {isLab && (
                <button onClick={fixRotation}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: 'transparent', color: 'var(--purple-primary)', border: '1px solid var(--purple-primary)', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '17px', cursor: 'pointer' }}>
                  Fix Rotation
                </button>
              )}
              <button onClick={() => { setShowAddForm(table); setNewMeeting(EMPTY_MEETING); }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '17px' }}>
                <Plus size={12} /> Add
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {isLab ? (() => {
            const curYear = new Date().getFullYear();
            const yearsWithData = new Set(meetings.map(m => m.meeting_date?.slice(0, 4)).filter(Boolean));
            yearsWithData.add(String(curYear));
            const years = [...yearsWithData]
              .filter(y => Number(y) >= curYear - 10 && Number(y) <= curYear)
              .sort((a, b) => Number(b) - Number(a));
            return years.map(year => (
              <button key={year} onClick={() => setFilter(year)} style={{ padding: '3px 9px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: filter === year ? 'var(--purple-primary)' : 'var(--bg-primary)', color: filter === year ? 'white' : 'var(--text-secondary)', fontWeight: filter === year ? 600 : 400, fontSize: '15px' }}>
                {year}
              </button>
            ));
          })() : [
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'past', label: 'Past' },
            { id: 'cancelled', label: 'Cancelled' },
            { id: 'all', label: 'All' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: '3px 9px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: filter === f.id ? 'var(--purple-primary)' : 'var(--bg-primary)', color: filter === f.id ? 'white' : 'var(--text-secondary)', fontWeight: filter === f.id ? 600 : 400, fontSize: '15px' }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: isLab ? '74px 1fr 28px 80px 1fr 1fr 22px' : '70px 1fr 120px 80px 80px 48px 1fr 22px', gap: isLab ? '6px' : '8px', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: '4px', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>Date</span>
          {!isLab && <span>Description</span>}
          <span>Presenter</span>
          {isLab && <span>SOF</span>}
          <span>Status</span>
          <span>Away</span>
          {!isLab && <span>Zoom Link</span>}
          {!isLab && <span>Zoom Info</span>}
          {isLab && <span>Notes</span>}
          <span />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '17px' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '17px' }}>No meetings.</div>
        ) : filtered.map(m => renderRow(m, table))}
      </div>
    );
  }

  // Suggested presenter for add form — uses rotor for lab, fair-count for adhoc
  const suggested = showAddForm && newMeeting.meeting_date
    ? showAddForm === 'lab'
      ? getRotorPresenter(labMeetings, presenters.length ? presenters : members, newMeeting.meeting_date, vacations)
      : (() => {
          const pool = members;
          const counts = {};
          pool.forEach(m => { counts[m.id] = 0; });
          adhocMeetings.filter(m => m.status !== 'cancelled' && m.presenter_id).forEach(m => { counts[m.presenter_id] = (counts[m.presenter_id] || 0) + 1; });
          const avail = pool.filter(m => !isOnVacationFn(m.id, newMeeting.meeting_date, vacations));
          return avail.length ? [...avail].sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0))[0] : null;
        })()
    : null;
  const suggestedHoliday = showAddForm === 'lab' && newMeeting.meeting_date ? isHoliday(newMeeting.meeting_date) : null;

  return (
    <div>

      {vacWarn && (
        <div style={{ background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: '#E67E22' }}>
          <AlertTriangle size={14} /> {vacWarn}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {renderPanel('adhoc', adhocFilter, setAdhocFilter)}
        <div style={{ height: '1px', background: 'var(--border)' }} />
        {renderPanel('lab', labFilter, setLabFilter)}
      </div>

      {/* Add Meeting Modal */}
      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '28px', width: '460px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '18px' }}>Add {showAddForm === 'lab' ? 'Lab' : 'Ad-hoc'} Meeting</h2>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Date</label>
                <input type="date" value={newMeeting.meeting_date} onChange={e => setNewMeeting(p => ({ ...p, meeting_date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '18px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Presenter
                  {suggested && !newMeeting.presenter_id && <span style={{ color: 'var(--purple-primary)', fontWeight: 400, textTransform: 'none', fontSize: '14px', marginLeft: '6px' }}>suggested: {fmtName(suggested.full_name)}</span>}
                </label>
                <select value={newMeeting.presenter_id}
                  onChange={e => {
                    const val = e.target.value;
                    if (val && val !== 'guest' && isOnVacationFn(val, newMeeting.meeting_date, vacations)) {
                      warnVacation(val, newMeeting.meeting_date);
                    }
                    setNewMeeting(p => ({ ...p, presenter_id: val }));
                  }}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '18px', outline: 'none' }}>
                  <option value="">{suggested ? `Auto: ${fmtName(suggested.full_name)}` : 'Select…'}</option>
                  {(showAddForm === 'lab' ? (presenters.length ? presenters : members) : members).map(m => {
                    const ov = isOnVacationFn(m.id, newMeeting.meeting_date, vacations);
                    return <option key={m.id} value={m.id}>{fmtName(m.full_name)}{ov ? ' ⚠ out' : ''}</option>;
                  })}
                  <option value="guest">Guest speaker</option>
                </select>
              </div>
            </div>

            {newMeeting.presenter_id === 'guest' && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Guest Name</label>
                  <input value={newMeeting.guest_name} onChange={e => setNewMeeting(p => ({ ...p, guest_name: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '18px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Title (optional)</label>
                  <input value={newMeeting.guest_title} onChange={e => setNewMeeting(p => ({ ...p, guest_title: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '18px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>{showAddForm === 'adhoc' ? 'Description (optional)' : 'Notes (optional)'}</label>
              <input value={newMeeting.notes} onChange={e => setNewMeeting(p => ({ ...p, notes: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '18px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {showAddForm === 'adhoc' && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Zoom Link (optional)</label>
                  <input type="url" value={newMeeting.zoom_link || ''} onChange={e => setNewMeeting(p => ({ ...p, zoom_link: e.target.value }))}
                    placeholder="https://zoom.us/j/…"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '18px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Zoom Sign-in Info (optional)</label>
                  {(newMeeting.zoom_info_fields || []).map((f, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                      <select value={f.key}
                        onChange={e => setNewMeeting(p => ({ ...p, zoom_info_fields: p.zoom_info_fields.map((x, i) => i === idx ? { ...x, key: e.target.value } : x) }))}
                        style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '17px', outline: 'none' }}>
                        {ZOOM_KEY_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                      {f.key === 'Other' && (
                        <input value={f.customKey || ''} placeholder="Label"
                          onChange={e => setNewMeeting(p => ({ ...p, zoom_info_fields: p.zoom_info_fields.map((x, i) => i === idx ? { ...x, customKey: e.target.value } : x) }))}
                          style={{ width: '80px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '17px', outline: 'none' }} />
                      )}
                      <input value={f.value} placeholder="Value"
                        onChange={e => setNewMeeting(p => ({ ...p, zoom_info_fields: p.zoom_info_fields.map((x, i) => i === idx ? { ...x, value: e.target.value } : x) }))}
                        style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '17px', outline: 'none' }} />
                      {idx > 0 && (
                        <button type="button" onClick={() => setNewMeeting(p => ({ ...p, zoom_info_fields: p.zoom_info_fields.filter((_, i) => i !== idx) }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {(newMeeting.zoom_info_fields || []).length < 3 && (
                    <button type="button" onClick={() => setNewMeeting(p => ({ ...p, zoom_info_fields: [...(p.zoom_info_fields || []), { key: 'Meeting ID', value: '', customKey: '' }] }))}
                      style={{ fontSize: '15px', color: 'var(--purple-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginBottom: '4px' }}>
                      + Add field
                    </button>
                  )}
                  {(() => {
                    const preview = formatZoomInfo(buildZoomInfo(newMeeting.zoom_info_fields));
                    return preview ? (
                      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 'var(--radius-md)', marginTop: '4px' }}>
                        {preview}
                      </div>
                    ) : null;
                  })()}
                </div>
              </>
            )}

            {showAddForm !== 'adhoc' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: newMeeting.is_sof ? '12px' : '20px' }}>
                  <input type="checkbox" id="add-sof" checked={newMeeting.is_sof} onChange={e => setNewMeeting(p => ({ ...p, is_sof: e.target.checked }))} style={{ width: '15px', height: '15px', accentColor: 'var(--purple-primary)' }} />
                  <label htmlFor="add-sof" style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 500 }}>State of the Field (SOF)</label>
                </div>
                {newMeeting.is_sof && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>SOF Topic</label>
                    <input value={newMeeting.sof_topic || ''} onChange={e => setNewMeeting(p => ({ ...p, sof_topic: e.target.value }))}
                      placeholder="e.g. APOBEC3A detection methods"
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '18px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}
              </>
            )}

            {suggestedHoliday && (
              <div style={{ background: '#FDEDEC', border: '1px solid #F1948A', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '14px', fontSize: '17px', color: '#E74C3C', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <AlertTriangle size={13} /> This date falls on {suggestedHoliday} — lab meetings are not scheduled on holidays.
              </div>
            )}
            {vacWarn && (
              <div style={{ background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '14px', fontSize: '17px', color: '#E67E22', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <AlertTriangle size={13} /> {vacWarn}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAddForm(null); setNewMeeting(EMPTY_MEETING); }} style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '18px' }}>Cancel</button>
              <button onClick={handleAddMeeting} disabled={!newMeeting.meeting_date || saving}
                style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: !newMeeting.meeting_date ? 'var(--border)' : 'var(--purple-primary)', color: !newMeeting.meeting_date ? 'var(--text-muted)' : 'white', fontWeight: 600, fontSize: '18px' }}>
                {saving ? 'Adding…' : 'Add Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Info Edit Modal */}
      {editingZoomInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '24px', width: '380px', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Edit Zoom Sign-in Info</h3>
            {editingZoomInfo.fields.map((f, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
                <select value={f.key}
                  onChange={e => setEditingZoomInfo(prev => ({ ...prev, fields: prev.fields.map((x, i) => i === idx ? { ...x, key: e.target.value } : x) }))}
                  style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '17px', outline: 'none' }}>
                  {ZOOM_KEY_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                {f.key === 'Other' && (
                  <input value={f.customKey || ''} placeholder="Label"
                    onChange={e => setEditingZoomInfo(prev => ({ ...prev, fields: prev.fields.map((x, i) => i === idx ? { ...x, customKey: e.target.value } : x) }))}
                    style={{ width: '70px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '17px', outline: 'none' }} />
                )}
                <input value={f.value} placeholder="Value"
                  onChange={e => setEditingZoomInfo(prev => ({ ...prev, fields: prev.fields.map((x, i) => i === idx ? { ...x, value: e.target.value } : x) }))}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '17px', outline: 'none' }} />
                {idx > 0 && (
                  <button type="button" onClick={() => setEditingZoomInfo(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            {editingZoomInfo.fields.length < 3 && (
              <button type="button" onClick={() => setEditingZoomInfo(prev => ({ ...prev, fields: [...prev.fields, { key: 'Meeting ID', value: '', customKey: '' }] }))}
                style={{ fontSize: '15px', color: 'var(--purple-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginBottom: '10px' }}>
                + Add field
              </button>
            )}
            {(() => {
              const preview = formatZoomInfo(buildZoomInfo(editingZoomInfo.fields));
              return (
                <div style={{ fontSize: '15px', color: preview ? 'var(--text-secondary)' : 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 'var(--radius-md)', marginBottom: '14px', fontStyle: preview ? 'normal' : 'italic' }}>
                  {preview || 'No info entered'}
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingZoomInfo(null)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '18px' }}>Cancel</button>
              <button onClick={() => commitZoomInfo(editingZoomInfo.meetingId, editingZoomInfo.fields)}
                style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600, fontSize: '18px' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
