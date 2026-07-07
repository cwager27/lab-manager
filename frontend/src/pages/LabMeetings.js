import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, X, Star, AlertTriangle, CheckCircle } from 'lucide-react';

const STATUS_STYLES = {
  scheduled: { bg: '#EBF5FB', text: '#2980B9', label: 'Scheduled' },
  completed: { bg: '#EAF7F0', text: '#27AE60', label: 'Completed' },
  cancelled: { bg: '#F2F3F4', text: '#9A9AB0', label: 'Cancelled' },
};

const EMPTY_MEETING = {
  meeting_date: '', presenter_id: '', guest_name: '', guest_title: '',
  is_sof: false, sof_topic: '', notes: '', status: 'scheduled',
};

function isOnVacationFn(memberId, date, vacations) {
  if (!memberId || !date) return false;
  return vacations.some(v => v.requested_by === memberId && v.start_date <= date && v.end_date >= date);
}

function getFairPresenter(meetings, members, date, vacations, excludeId = null) {
  const counts = {};
  members.forEach(m => { counts[m.id] = 0; });
  meetings
    .filter(m => m.status !== 'cancelled' && m.presenter_id)
    .forEach(m => { counts[m.presenter_id] = (counts[m.presenter_id] || 0) + 1; });
  const available = members.filter(m =>
    m.id !== excludeId && !isOnVacationFn(m.id, date, vacations)
  );
  if (!available.length) return null;
  return [...available].sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0))[0];
}

export default function LabMeetings({ userRole, userId, profile }) {
  const [labMeetings, setLabMeetings] = useState([]);
  const [adhocMeetings, setAdhocMeetings] = useState([]);
  const [members, setMembers] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [labFilter, setLabFilter] = useState('upcoming');
  const [adhocFilter, setAdhocFilter] = useState('upcoming');
  const [showAddForm, setShowAddForm] = useState(null);
  const [newMeeting, setNewMeeting] = useState(EMPTY_MEETING);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue] = useState('');
  const [guestNameEdit, setGuestNameEdit] = useState('');
  const [vacWarn, setVacWarn] = useState(null);

  const canEdit = userRole === 'pm' || profile?.full_name?.toLowerCase().startsWith('mia');
  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [{ data: allMeetings }, { data: memberData }, { data: vacData }] = await Promise.all([
      supabase.from('lab_meetings').select('*, presenter:profiles!lab_meetings_presenter_id_fkey(id, full_name, email)').order('meeting_date'),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('vacation_requests').select('*').eq('status', 'approved'),
    ]);
    const all = allMeetings || [];
    setLabMeetings(all.filter(m => m.meeting_type !== 'adhoc_meeting'));
    setAdhocMeetings(all.filter(m => m.meeting_type === 'adhoc_meeting'));
    setMembers(memberData || []);
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
  }

  async function commitEdit(id, field, value, table) {
    const meeting = getMeetings(table).find(m => m.id === id);
    if (!meeting) return;

    const update = { updated_at: new Date().toISOString() };

    if (field === 'presenter_id') {
      if (value === 'guest') {
        update.presenter_id = null;
        update.guest_name = guestNameEdit || null;
        update.guest_title = null;
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
    fetchData(true);
  }

  async function handleCancelMeeting(id, table) {
    const meeting = getMeetings(table).find(m => m.id === id);
    await supabase.from(tblName()).update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
    await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/meeting-cancelled`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingDate: meeting?.meeting_date, cancelledByName: profile?.full_name }),
    });
    fetchData(true);
  }

  async function handleAddMeeting(e) {
    e.preventDefault();
    if (!showAddForm || !newMeeting.meeting_date) return;
    setSaving(true);

    const meetings = getMeetings(showAddForm);
    let presenterId = newMeeting.presenter_id || null;
    if (!presenterId && newMeeting.presenter_id !== 'guest') {
      const fair = getFairPresenter(meetings, members, newMeeting.meeting_date, vacations);
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
    if (filter === 'upcoming') return meetings.filter(m => m.meeting_date >= today);
    if (filter === 'past') return meetings.filter(m => m.meeting_date < today);
    if (filter === 'cancelled') return meetings.filter(m => m.status === 'cancelled');
    if (filter === 'sof') return meetings.filter(m => m.is_sof);
    return meetings;
  }

  function renderRow(meeting, table) {
    const ec = editingCell;
    const editing = (field) => ec?.id === meeting.id && ec?.field === field && ec?.table === table;
    const presenterName = meeting.presenter?.full_name || meeting.guest_name || '';
    const onVac = meeting.presenter_id && isOnVacationFn(meeting.presenter_id, meeting.meeting_date, vacations);
    const statusStyle = STATUS_STYLES[meeting.status] || STATUS_STYLES.scheduled;
    const isPast = meeting.meeting_date < today;

    return (
      <div key={meeting.id} style={{
        display: 'grid', gridTemplateColumns: '74px 1fr 28px 80px 1fr 22px',
        gap: '6px', padding: '5px 8px', alignItems: 'center',
        background: meeting.is_sof ? 'var(--purple-faint)' : 'var(--bg-card)',
        border: `1px solid ${meeting.is_sof ? 'var(--purple-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', marginBottom: '3px', fontSize: '12px',
        opacity: meeting.status === 'cancelled' ? 0.55 : 1,
      }}>

        {/* Date */}
        {editing('meeting_date') ? (
          <input type="date" autoFocus value={cellValue} onChange={e => setCellValue(e.target.value)}
            onBlur={() => commitEdit(meeting.id, 'meeting_date', cellValue, table)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(meeting.id, 'meeting_date', cellValue, table); if (e.key === 'Escape') setEditingCell(null); }}
            style={{ fontSize: '11px', padding: '2px 3px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
        ) : (
          <span onClick={() => startEdit(meeting.id, 'meeting_date', meeting.meeting_date, table)}
            style={{ cursor: canEdit ? 'pointer' : 'default', color: isPast ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 500 }}
            title={canEdit ? 'Click to edit' : ''}>
            {new Date(meeting.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
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
                style={{ fontSize: '12px', padding: '2px 3px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%' }}>
                <option value="">TBD</option>
                {members.map(m => {
                  const ov = isOnVacationFn(m.id, meeting.meeting_date, vacations);
                  return <option key={m.id} value={m.id}>{m.full_name}{ov ? ' ⚠' : ''}</option>;
                })}
                <option value="guest">Guest speaker</option>
              </select>
              {cellValue === 'guest' && (
                <input autoFocus placeholder="Guest name…" value={guestNameEdit}
                  onChange={e => setGuestNameEdit(e.target.value)}
                  onBlur={() => commitEdit(meeting.id, 'presenter_id', 'guest', table)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(meeting.id, 'presenter_id', 'guest', table); if (e.key === 'Escape') setEditingCell(null); }}
                  style={{ fontSize: '12px', padding: '2px 6px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%', marginTop: '4px', boxSizing: 'border-box' }} />
              )}
            </div>
          ) : (
            <span onClick={() => startEdit(meeting.id, 'presenter_id', meeting.presenter_id || (meeting.guest_name ? 'guest' : ''), table, meeting.guest_name || '')}
              title={onVac ? '⚠ Out of office — click to reassign' : (canEdit ? 'Click to edit' : '')}
              style={{ cursor: canEdit ? 'pointer' : 'default', fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: onVac ? '#E67E22' : 'var(--text-primary)' }}>
              {presenterName
                ? <>
                    {presenterName}{onVac && <AlertTriangle size={11} style={{ marginLeft: '3px', verticalAlign: 'middle' }} />}
                    {meeting.presenter_id && meeting.confirmation_status !== 'confirmed' && (
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: 400, color: '#E67E22', marginTop: '1px' }}>Invite pending acceptance</span>
                    )}
                  </>
                : <em style={{ color: 'var(--text-muted)', fontWeight: 400 }}>TBD</em>}
            </span>
          )}
        </div>

        {/* SOF star */}
        <button onClick={canEdit ? async () => {
          await supabase.from(tblName()).update({ is_sof: !meeting.is_sof, updated_at: new Date().toISOString() }).eq('id', meeting.id);
          fetchData(true);
        } : undefined}
          disabled={!canEdit} title={canEdit ? (meeting.is_sof ? 'Remove SOF' : 'Mark SOF') : (meeting.is_sof ? 'SOF' : '')}
          style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !meeting.is_sof && !canEdit ? 0 : 1 }}>
          <Star size={13} color={meeting.is_sof ? '#7B3FA0' : 'var(--border)'} fill={meeting.is_sof ? '#7B3FA0' : 'none'} />
        </button>

        {/* Status */}
        {editing('status') ? (
          <select autoFocus value={cellValue}
            onChange={async e => { setCellValue(e.target.value); await commitEdit(meeting.id, 'status', e.target.value, table); }}
            onBlur={() => setEditingCell(null)}
            style={{ fontSize: '11px', padding: '2px 3px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%' }}>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        ) : (
          <span onClick={() => startEdit(meeting.id, 'status', meeting.status, table)}
            title={canEdit ? 'Click to edit' : ''} style={{ cursor: canEdit ? 'pointer' : 'default', display: 'inline-block', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text }}>
            {statusStyle.label}
          </span>
        )}

        {/* Notes */}
        <div style={{ overflow: 'hidden', minWidth: 0 }}>
          {editing('notes') ? (
            <input autoFocus value={cellValue} onChange={e => setCellValue(e.target.value)}
              onBlur={() => commitEdit(meeting.id, 'notes', cellValue, table)}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(meeting.id, 'notes', cellValue, table); if (e.key === 'Escape') setEditingCell(null); }}
              style={{ fontSize: '12px', padding: '2px 6px', border: '1px solid var(--purple-primary)', borderRadius: '4px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          ) : (
            <span onClick={() => startEdit(meeting.id, 'notes', meeting.notes || '', table)}
              title={meeting.notes || (canEdit ? 'Click to add note' : '')}
              style={{ cursor: canEdit ? 'pointer' : 'default', display: 'block', color: meeting.notes ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: meeting.notes ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {meeting.notes || (canEdit ? '+ note' : '—')}
            </span>
          )}
        </div>

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
    const next = meetings.find(m => m.meeting_date >= today && m.status === 'scheduled');
    const isLab = table === 'lab';

    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {isLab ? 'Lab Meetings' : 'Ad-hoc Meetings'}
            </h2>
            {isLab && <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '2px 0 0' }}>Thu 1:30–3pm · Zoom 987 7040 0275 · pw 676073</p>}
          </div>
          {canEdit && (
            <button onClick={() => { setShowAddForm(table); setNewMeeting(EMPTY_MEETING); }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '12px' }}>
              <Plus size={12} /> Add
            </button>
          )}
        </div>

        {next && (
          <div style={{ background: 'var(--purple-faint)', border: '1px solid var(--purple-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: '10px', fontSize: '12px', color: 'var(--purple-primary)' }}>
            <strong>Next:</strong> {new Date(next.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {next.presenter?.full_name || next.guest_name || 'TBD'}{next.is_sof ? ' · ⭐ SOF' : ''}
          </div>
        )}

        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {[{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }, { id: 'sof', label: 'SOF' }, { id: 'cancelled', label: 'Cancelled' }, { id: 'all', label: 'All' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: '3px 9px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: filter === f.id ? 'var(--purple-primary)' : 'var(--bg-primary)', color: filter === f.id ? 'white' : 'var(--text-secondary)', fontWeight: filter === f.id ? 600 : 400, fontSize: '11px' }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '74px 1fr 28px 80px 1fr 22px', gap: '6px', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: '4px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>Date</span><span>Presenter</span><span>SOF</span><span>Status</span><span>Notes</span><span />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '12px' }}>No meetings.</div>
        ) : filtered.map(m => renderRow(m, table))}
      </div>
    );
  }

  // Suggested presenter for add form
  const suggested = showAddForm && newMeeting.meeting_date
    ? getFairPresenter(getMeetings(showAddForm), members, newMeeting.meeting_date, vacations)
    : null;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Team Meetings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Lab and ad-hoc meeting schedules</p>
      </div>

      {vacWarn && (
        <div style={{ background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#E67E22' }}>
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
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '18px' }}>Add {showAddForm === 'lab' ? 'Lab' : 'Ad-hoc'} Meeting</h2>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Date</label>
                <input type="date" value={newMeeting.meeting_date} onChange={e => setNewMeeting(p => ({ ...p, meeting_date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Presenter
                  {suggested && !newMeeting.presenter_id && <span style={{ color: 'var(--purple-primary)', fontWeight: 400, textTransform: 'none', fontSize: '10px', marginLeft: '6px' }}>suggested: {suggested.full_name}</span>}
                </label>
                <select value={newMeeting.presenter_id}
                  onChange={e => {
                    const val = e.target.value;
                    if (val && val !== 'guest' && isOnVacationFn(val, newMeeting.meeting_date, vacations)) {
                      warnVacation(val, newMeeting.meeting_date);
                    }
                    setNewMeeting(p => ({ ...p, presenter_id: val }));
                  }}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="">{suggested ? `Auto: ${suggested.full_name}` : 'Select…'}</option>
                  {members.map(m => {
                    const ov = isOnVacationFn(m.id, newMeeting.meeting_date, vacations);
                    return <option key={m.id} value={m.id}>{m.full_name}{ov ? ' ⚠ out' : ''}</option>;
                  })}
                  <option value="guest">Guest speaker</option>
                </select>
              </div>
            </div>

            {newMeeting.presenter_id === 'guest' && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Guest Name</label>
                  <input value={newMeeting.guest_name} onChange={e => setNewMeeting(p => ({ ...p, guest_name: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Title (optional)</label>
                  <input value={newMeeting.guest_title} onChange={e => setNewMeeting(p => ({ ...p, guest_title: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Notes (optional)</label>
              <input value={newMeeting.notes} onChange={e => setNewMeeting(p => ({ ...p, notes: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: newMeeting.is_sof ? '12px' : '20px' }}>
              <input type="checkbox" id="add-sof" checked={newMeeting.is_sof} onChange={e => setNewMeeting(p => ({ ...p, is_sof: e.target.checked }))} style={{ width: '15px', height: '15px', accentColor: 'var(--purple-primary)' }} />
              <label htmlFor="add-sof" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>State of the Field (SOF)</label>
            </div>

            {newMeeting.is_sof && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>SOF Topic</label>
                <input value={newMeeting.sof_topic || ''} onChange={e => setNewMeeting(p => ({ ...p, sof_topic: e.target.value }))}
                  placeholder="e.g. APOBEC3A detection methods"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {vacWarn && (
              <div style={{ background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '14px', fontSize: '12px', color: '#E67E22', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <AlertTriangle size={13} /> {vacWarn}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAddForm(null); setNewMeeting(EMPTY_MEETING); }} style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '13px' }}>Cancel</button>
              <button onClick={handleAddMeeting} disabled={!newMeeting.meeting_date || saving}
                style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: !newMeeting.meeting_date ? 'var(--border)' : 'var(--purple-primary)', color: !newMeeting.meeting_date ? 'var(--text-muted)' : 'white', fontWeight: 600, fontSize: '13px' }}>
                {saving ? 'Adding…' : 'Add Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
