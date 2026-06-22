import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Palmtree, Star, ClipboardList, AlertTriangle, Users, Mail, Phone, MapPin } from 'lucide-react';

const ROLE_LABELS = { admin: 'Supervisor', pm: 'Program Manager', member: 'Lab Member', intern: 'Intern' };
const ROLE_COLORS = {
  admin:  { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  pm:     { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  member: { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  intern: { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
};

function getDisplayName(c) {
  if (c.first_name || c.last_name) return [c.first_name, c.last_name].filter(Boolean).join(' ');
  return c.full_name || '';
}

const LEAVE_COLORS = {
  'Vacation':                  { bg: '#EBF5FB', text: '#2980B9' },
  'Sick Leave':                { bg: '#FDEDEC', text: '#E74C3C' },
  'Personal Days':             { bg: '#F5EEF8', text: '#7B3FA0' },
  'Holidays':                  { bg: '#EBF5FB', text: '#1A5276' },
  'Parental Leave':            { bg: '#FDF2F8', text: '#A93226' },
  'Bereavement':               { bg: '#F2F3F4', text: '#626567' },
  'Family & Medical Leave':    { bg: '#FDEDEC', text: '#C0392B' },
  'Sabbatical':                { bg: '#EAF7F0', text: '#1E8449' },
  'Jury Duty':                 { bg: '#EAF7F0', text: '#27AE60' },
  'Voting':                    { bg: '#EAF7F0', text: '#27AE60' },
  'Military Leave':            { bg: '#EBF5FB', text: '#2471A3' },
  'Volunteer/Community Service': { bg: '#EAFAF1', text: '#1E8449' },
  'Other':                     { bg: '#F2F3F4', text: '#626567' },
};

function leaveColor(type) {
  if (!type) return LEAVE_COLORS['Other'];
  const key = Object.keys(LEAVE_COLORS).find(k => type.startsWith(k));
  return key ? LEAVE_COLORS[key] : LEAVE_COLORS['Other'];
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

export default function Dashboard({ profile }) {
  const [outToday, setOutToday] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [labMeetings, setLabMeetings] = useState([]);
  const [adhocMeetings, setAdhocMeetings] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [taskFreq, setTaskFreq] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, [profile]);

  async function fetchAll() {
    if (!profile?.id) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [{ data: vacData }, { data: labData }, { data: adhocData }, { data: sporData }, { data: assignData }, { data: contactData }] = await Promise.all([
      supabase.from('vacation_requests')
        .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name)')
        .eq('status', 'approved').lte('start_date', thirtyDays).gte('end_date', today).order('start_date'),
      supabase.from('lab_meetings')
        .select('*, presenter:profiles!lab_meetings_presenter_id_fkey(full_name)')
        .eq('status', 'scheduled').gte('meeting_date', today).order('meeting_date').limit(2),
      supabase.from('adhoc_meetings')
        .select('*, presenter:profiles!adhoc_meetings_presenter_id_fkey(full_name)')
        .eq('status', 'scheduled').gte('meeting_date', today).order('meeting_date').limit(2),
      supabase.from('sporadic_tasks')
        .select('*, assigner:profiles!sporadic_tasks_assigned_by_fkey(full_name)')
        .eq('assigned_to', profile.id).in('status', ['pending', 'in_progress']).order('due_date'),
      supabase.from('task_assignments')
        .select('*, task:tasks_definitions(title, frequency, category)')
        .eq('assigned_to', profile.id).eq('status', 'pending'),
      supabase.from('lab_contacts').select('*').eq('status', 'active').order('sort_order').order('last_name').order('first_name'),
    ]);

    const all = vacData || [];
    setOutToday(all.filter(r => r.start_date <= today && r.end_date >= today));
    setUpcoming(all.filter(r => r.start_date > today));
    setLabMeetings(labData || []);
    setAdhocMeetings(adhocData || []);
    const assigns = assignData || [];
    setMyTasks(sporData || []);
    setMyAssignments(assigns);
    setContacts(contactData || []);
    // default to the first frequency that has assignments
    const freqOrder = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'];
    const firstFreq = freqOrder.find(f => assigns.some(a => a.task?.frequency === f));
    setTaskFreq(prev => prev || firstFreq || null);
    setLoading(false);
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '680px' }}>

          {/* Out today */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palmtree size={15} color="#F39C12" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Out of Office Today</span>
            </div>
            {outToday.length === 0 ? (
              <p style={{ padding: '16px 18px', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Everyone is in today.</p>
            ) : (
              <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {outToday.map(r => {
                  const color = leaveColor(r.leave_type);
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.requester?.full_name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: color.bg, color: color.text }}>
                          {r.leave_type}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <Calendar size={11} />
                          {formatDate(r.start_date)}{r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming time away */}
          {upcoming.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={15} color="var(--purple-primary)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Upcoming Time Away (next 30 days)</span>
              </div>
              <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcoming.map(r => {
                  const color = leaveColor(r.leave_type);
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.requester?.full_name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: color.bg, color: color.text }}>
                          {r.leave_type}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <Calendar size={11} />
                          {formatDate(r.start_date)}{r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* My Tasks */}
          {(() => {
            const today = new Date().toISOString().split('T')[0];
            const freqOrder = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'];
            const freqColors = {
              daily:    { bg: '#EBF5FB', text: '#2980B9', active: '#2980B9' },
              weekly:   { bg: '#EAF7F0', text: '#27AE60', active: '#27AE60' },
              biweekly: { bg: '#FEF9E7', text: '#F39C12', active: '#F39C12' },
              monthly:  { bg: '#F5EEF8', text: '#7B3FA0', active: '#7B3FA0' },
              yearly:   { bg: '#FDEDEC', text: '#E74C3C', active: '#E74C3C' },
            };
            const availableFreqs = freqOrder.filter(f => myAssignments.some(a => a.task?.frequency === f));
            const visibleAssignments = taskFreq
              ? myAssignments.filter(a => a.task?.frequency === taskFreq)
              : myAssignments;

            return (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                {/* Header */}
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ClipboardList size={15} color="var(--purple-primary)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>My Tasks</span>
                  </div>
                  {/* Frequency pills — only show if there are recurring assignments */}
                  {availableFreqs.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {availableFreqs.map(f => {
                        const c = freqColors[f];
                        const active = taskFreq === f;
                        const count = myAssignments.filter(a => a.task?.frequency === f).length;
                        return (
                          <button key={f} onClick={() => setTaskFreq(active ? null : f)} style={{
                            padding: '3px 9px', borderRadius: '12px', border: `1px solid ${active ? c.text : 'var(--border)'}`,
                            background: active ? c.bg : 'transparent',
                            color: active ? c.text : 'var(--text-muted)',
                            fontSize: '11px', fontWeight: active ? 600 : 400,
                          }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)} {count > 1 ? `(${count})` : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {/* Recurring assignments */}
                  {visibleAssignments.length > 0 && (
                    <>
                      {visibleAssignments.map(a => {
                        const overdue = a.cycle_end && a.cycle_end < today;
                        const c = freqColors[a.task?.frequency];
                        return (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>{a.task?.title || 'Task'}</span>
                            {!taskFreq && c && (
                              <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, background: c.bg, color: c.text, flexShrink: 0 }}>{a.task?.frequency}</span>
                            )}
                            {overdue && <AlertTriangle size={12} color="#E74C3C" title="Overdue" style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Divider between recurring and one-off if both present */}
                  {visibleAssignments.length > 0 && myTasks.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  )}

                  {/* One-off sporadic tasks */}
                  {myTasks.map(task => {
                    const overdue = task.due_date < today;
                    return (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>{task.title}</span>
                        <span style={{ fontSize: '11px', color: overdue ? '#E74C3C' : 'var(--text-muted)', flexShrink: 0 }}>Due {task.due_date}</span>
                        {overdue && <AlertTriangle size={12} color="#E74C3C" style={{ flexShrink: 0 }} />}
                      </div>
                    );
                  })}

                  {visibleAssignments.length === 0 && myTasks.length === 0 && (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                      {taskFreq ? `No ${taskFreq} tasks assigned.` : 'No tasks assigned to you right now.'}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Upcoming meetings row */}
          <div style={{ display: 'flex', gap: '16px' }}>
            {[
              { label: 'Next Lab Meetings', meetings: labMeetings },
              { label: 'Next Ad-hoc Meetings', meetings: adhocMeetings },
            ].map(({ label, meetings }) => (
              <div key={label} style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={15} color="var(--purple-primary)" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
                </div>
                {meetings.length === 0 ? (
                  <p style={{ padding: '14px 18px', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>None scheduled.</p>
                ) : (
                  <div style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {meetings.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {new Date(m.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                            {m.is_sof && <Star size={11} color="#7B3FA0" fill="#7B3FA0" />}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {m.presenter?.full_name || m.guest_name || <em>TBD</em>}
                          </div>
                        </div>
                        {m.is_sof && (
                          <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: 'var(--purple-faint)', color: 'var(--purple-primary)', flexShrink: 0 }}>SOF</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Lab Directory */}
          {contacts.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={15} color="var(--purple-primary)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Lab Directory</span>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {contacts.map(contact => {
                  const name = getDisplayName(contact);
                  const colors = ROLE_COLORS[contact.role] || ROLE_COLORS.member;
                  const initial = name.charAt(0).toUpperCase();
                  return (
                    <div key={contact.id} style={{ display: 'flex', gap: '12px', padding: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                      {/* Avatar */}
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: colors.bg, border: `2px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: colors.text }}>{initial}</span>
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                          <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                            {ROLE_LABELS[contact.role] || contact.role}
                          </span>
                        </div>
                        {contact.title && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>{contact.title}</p>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--purple-primary)', textDecoration: 'none' }}>
                              <Mail size={11} /> {contact.email}
                            </a>
                          )}
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                              <Phone size={11} /> {contact.phone}
                            </a>
                          )}
                          {contact.address && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <MapPin size={11} /> {contact.address}
                            </span>
                          )}
                        </div>
                        {contact.supervisor && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                            Supervisor: <span style={{ fontWeight: 600 }}>{contact.supervisor}</span>
                          </p>
                        )}
                        {contact.notes && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0', fontStyle: 'italic' }}>{contact.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
