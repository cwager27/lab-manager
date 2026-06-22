import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Palmtree } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTimeAway(); }, []);

  async function fetchTimeAway() {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data } = await supabase
      .from('vacation_requests')
      .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name)')
      .eq('status', 'approved')
      .lte('start_date', thirtyDays)
      .gte('end_date', today)
      .order('start_date');

    const all = data || [];
    setOutToday(all.filter(r => r.start_date <= today && r.end_date >= today));
    setUpcoming(all.filter(r => r.start_date > today));
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

          {/* Upcoming */}
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
        </div>
      )}
    </div>
  );
}
