import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Calendar, ChevronLeft, ChevronRight,
  Star, X, User, Edit2, Check, Plus
} from 'lucide-react';

const STATUS_STYLES = {
  scheduled: { bg: '#EBF5FB', text: '#2980B9', label: 'Scheduled' },
  completed: { bg: '#EAF7F0', text: '#27AE60', label: 'Completed' },
  cancelled: { bg: '#F2F3F4', text: '#9A9AB0', label: 'Cancelled' },
};

export default function LabMeetings({ userRole, userId, profile }) {
  const [meetings, setMeetings] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    meeting_date: '', presenter_id: '', guest_name: '',
    guest_title: '', is_sof: false, notes: '', status: 'scheduled'
  });
  const [filter, setFilter] = useState('upcoming');
  const [saving, setSaving] = useState(false);

  const canManage = userRole === 'admin' || userRole === 'pm';
  const canEditPresenter = userRole === 'admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: meetingData } = await supabase
      .from('lab_meetings')
      .select('*, presenter:profiles!lab_meetings_presenter_id_fkey(id, full_name, email)')
      .order('meeting_date');
    const { data: memberData } = await supabase
      .from('profiles').select('*').order('full_name');
    setMeetings(meetingData || []);
    setMembers(memberData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('lab_meetings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_meetings' }, () => {
        fetchData();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData]);

  async function handleSaveEdit(meetingId) {
    setSaving(true);
    const oldMeeting = meetings.find(m => m.id === meetingId);

    await supabase.from('lab_meetings').update({
      presenter_id: editForm.presenter_id || null,
      guest_name: editForm.guest_name || null,
      guest_title: editForm.guest_title || null,
      is_sof: editForm.is_sof,
      notes: editForm.notes || null,
      status: editForm.status,
      updated_at: new Date().toISOString()
    }).eq('id', meetingId);

    // Notify affected people if presenter changed
    const presenterChanged = oldMeeting.presenter_id !== editForm.presenter_id;
    if (presenterChanged) {
      const oldPresenter = members.find(m => m.id === oldMeeting.presenter_id);
      const newPresenter = members.find(m => m.id === editForm.presenter_id);
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/meeting-presenter-changed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingDate: oldMeeting.meeting_date,
          oldPresenterEmail: oldPresenter?.email,
          oldPresenterName: oldPresenter?.full_name,
          newPresenterEmail: newPresenter?.email,
          newPresenterName: newPresenter?.full_name,
          changedByName: profile?.full_name
        })
      });
    }

    setEditingId(null);
    setSaving(false);
    fetchData();
  }

  async function handleCancelMeeting(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    await supabase.from('lab_meetings').update({
      status: 'cancelled', updated_at: new Date().toISOString()
    }).eq('id', meetingId);

    // Email whole lab
    await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/meeting-cancelled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingDate: meeting.meeting_date,
        cancelledByName: profile?.full_name
      })
    });
    fetchData();
  }

  async function handleAddMeeting(e) {
    e.preventDefault();
    await supabase.from('lab_meetings').insert([{
      ...newMeeting,
      presenter_id: newMeeting.presenter_id || null,
      guest_name: newMeeting.guest_name || null,
      guest_title: newMeeting.guest_title || null,
    }]);

    // Email whole lab
    const presenter = members.find(m => m.id === newMeeting.presenter_id);
    await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/meeting-added`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingDate: newMeeting.meeting_date,
        presenterName: presenter?.full_name || newMeeting.guest_name || 'TBD',
        isSof: newMeeting.is_sof,
        addedByName: profile?.full_name
      })
    });

    setShowAddForm(false);
    setNewMeeting({ meeting_date: '', presenter_id: '', guest_name: '', guest_title: '', is_sof: false, notes: '', status: 'scheduled' });
    fetchData();
  }

  const today = new Date().toISOString().split('T')[0];

  const filteredMeetings = meetings.filter(m => {
    if (filter === 'upcoming') return m.meeting_date >= today && m.status !== 'cancelled';
    if (filter === 'past') return m.meeting_date < today;
    if (filter === 'cancelled') return m.status === 'cancelled';
    if (filter === 'sof') return m.is_sof;
    return true;
  });

  const nextMeeting = meetings.find(m => m.meeting_date >= today && m.status === 'scheduled');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Lab Meetings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Thursdays 1:30–3pm · Zoom: 987 7040 0275 · Passcode: 676073
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowAddForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
            background: 'var(--purple-primary)', color: 'white', border: 'none',
            borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px'
          }}><Plus size={16} /> Add Meeting</button>
        )}
      </div>

      {/* Next meeting banner */}
      {nextMeeting && (
        <div style={{
          background: 'var(--purple-faint)', border: '1px solid var(--purple-border)',
          borderRadius: 'var(--radius-md)', padding: '16px 20px',
          marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Calendar size={18} color="var(--purple-primary)" />
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--purple-primary)' }}>
                Next Meeting — {nextMeeting.meeting_date}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                {nextMeeting.is_sof ? '⭐ State of the Field · ' : ''}
                Presenter: {nextMeeting.presenter?.full_name || nextMeeting.guest_name || 'TBD'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'past', label: 'Past' },
          { id: 'sof', label: 'SOF' },
          { id: 'cancelled', label: 'Cancelled' },
          { id: 'all', label: 'All' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '7px 14px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: filter === f.id ? 'var(--purple-primary)' : 'var(--bg-primary)',
            color: filter === f.id ? 'white' : 'var(--text-secondary)',
            fontWeight: filter === f.id ? 600 : 400, fontSize: '12px'
          }}>{f.label}</button>
        ))}
      </div>

      {/* Meeting list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : filteredMeetings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          No meetings found.
        </div>
      ) : (
        filteredMeetings.map(meeting => {
          const statusStyle = STATUS_STYLES[meeting.status] || STATUS_STYLES.scheduled;
          const isEditing = editingId === meeting.id;
          const isPast = meeting.meeting_date < today;

          return (
            <div key={meeting.id} style={{
              background: 'var(--bg-card)',
              border: `1px solid ${meeting.is_sof ? 'var(--purple-border)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)', padding: '16px',
              marginBottom: '10px', boxShadow: 'var(--shadow-sm)',
              opacity: meeting.status === 'cancelled' ? 0.6 : 1
            }}>
              {!isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Date */}
                  <div style={{
                    width: '64px', textAlign: 'center', flexShrink: 0,
                    background: meeting.is_sof ? 'var(--purple-faint)' : 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)', padding: '8px'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: meeting.is_sof ? 'var(--purple-primary)' : 'var(--text-primary)' }}>
                      {new Date(meeting.meeting_date + 'T12:00:00').getDate()}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {new Date(meeting.meeting_date + 'T12:00:00').toLocaleString('default', { month: 'short' })}
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      {meeting.is_sof && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 8px', background: 'var(--purple-faint)', color: 'var(--purple-primary)', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                          <Star size={10} /> SOF
                        </span>
                      )}
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text }}>
                        {statusStyle.label}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {meeting.presenter?.full_name || meeting.guest_name || (meeting.status === 'cancelled' ? 'Cancelled' : 'TBD')}
                      </span>
                      {meeting.guest_title && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>— {meeting.guest_title}</span>
                      )}
                    </div>
                    {meeting.notes && (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{meeting.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {canEditPresenter && !isPast && meeting.status !== 'cancelled' && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => {
                        setEditingId(meeting.id);
                        setEditForm({
                          presenter_id: meeting.presenter_id || '',
                          guest_name: meeting.guest_name || '',
                          guest_title: meeting.guest_title || '',
                          is_sof: meeting.is_sof,
                          notes: meeting.notes || '',
                          status: meeting.status
                        });
                      }} title="Edit presenter" style={{
                        padding: '6px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)', background: 'var(--bg-primary)',
                        color: 'var(--text-muted)', display: 'flex', alignItems: 'center'
                      }}><Edit2 size={14} /></button>
                      <button onClick={() => handleCancelMeeting(meeting.id)} title="Cancel meeting" style={{
                        padding: '6px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid #FADBD8', background: '#FEF0F0',
                        color: 'var(--danger)', display: 'flex', alignItems: 'center'
                      }}><X size={14} /></button>
                    </div>
                  )}
                </div>
              ) : (
                /* Edit form */
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Editing: {meeting.meeting_date}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Presenter</label>
                      <select value={editForm.presenter_id} onChange={e => setEditForm(p => ({ ...p, presenter_id: e.target.value, guest_name: '' }))}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                        <option value="">Select presenter...</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                        <option value="guest">Guest</option>
                      </select>
                    </div>
                    {editForm.presenter_id === 'guest' && (
                      <>
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Guest Name</label>
                          <input value={editForm.guest_name} onChange={e => setEditForm(p => ({ ...p, guest_name: e.target.value }))}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Title (optional)</label>
                          <input value={editForm.guest_title} onChange={e => setEditForm(p => ({ ...p, guest_title: e.target.value }))}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      </>
                    )}
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Status</label>
                      <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Notes</label>
                      <input value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '18px', flexShrink: 0 }}>
                      <input type="checkbox" id={`sof-${meeting.id}`} checked={editForm.is_sof}
                        onChange={e => setEditForm(p => ({ ...p, is_sof: e.target.checked }))}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--purple-primary)' }} />
                      <label htmlFor={`sof-${meeting.id}`} style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>SOF</label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingId(null)} style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px' }}>Cancel</button>
                    <button onClick={() => handleSaveEdit(meeting.id)} disabled={saving} style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                      borderRadius: 'var(--radius-md)', border: 'none',
                      background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600
                    }}><Check size={14} /> {saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Add Meeting Modal */}
      {showAddForm && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '480px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Meeting</h2>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</label>
                <input type="date" value={newMeeting.meeting_date} onChange={e => setNewMeeting(p => ({ ...p, meeting_date: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Presenter</label>
                <select value={newMeeting.presenter_id} onChange={e => setNewMeeting(p => ({ ...p, presenter_id: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="">Select...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  <option value="guest">Guest</option>
                </select>
              </div>
            </div>

            {newMeeting.presenter_id === 'guest' && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Guest Name</label>
                  <input value={newMeeting.guest_name} onChange={e => setNewMeeting(p => ({ ...p, guest_name: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title (optional)</label>
                  <input value={newMeeting.guest_title} onChange={e => setNewMeeting(p => ({ ...p, guest_title: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes (optional)</label>
              <input value={newMeeting.notes} onChange={e => setNewMeeting(p => ({ ...p, notes: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <input type="checkbox" id="new-sof" checked={newMeeting.is_sof}
                onChange={e => setNewMeeting(p => ({ ...p, is_sof: e.target.checked }))}
                style={{ width: '16px', height: '16px', accentColor: 'var(--purple-primary)' }} />
              <label htmlFor="new-sof" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>State of the Field (SOF)</label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddForm(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleAddMeeting} disabled={!newMeeting.meeting_date} style={{
                padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                background: !newMeeting.meeting_date ? 'var(--border)' : 'var(--purple-primary)',
                color: !newMeeting.meeting_date ? 'var(--text-muted)' : 'white', fontWeight: 600
              }}>Add Meeting</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
