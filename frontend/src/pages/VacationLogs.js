import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Calendar, CheckCircle, XCircle,
  Clock, User, MessageSquare, Palmtree, Trash2, AlertTriangle
} from 'lucide-react';

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

const NO_APPROVAL_REQUIRED = new Set([
  'Sick Leave',
  'Medical Leave',
  'Jury Duty/Voting',
]);

const LEAVE_TYPES = [
  'Vacation',
  'Sick Leave',
  'Parental Leave',
  'Bereavement',
  'Medical Leave',
  'Jury Duty/Voting',
  'Volunteer/Community Service',
  'Work from Home',
];

const STATUS_STYLES = {
  pending: { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0', label: 'Pending' },
  approved: { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF', label: 'Approved' },
  denied: { bg: '#FDEDEC', text: '#E74C3C', border: '#F1948A', label: 'Denied' },
};

const LEAVE_COLORS = {
  'Vacation':                    { bg: '#FEE2E2', text: '#B91C1C' },
  'Sick Leave':                  { bg: '#FFEDD5', text: '#C2410C' },
  'Parental Leave':              { bg: '#FEF9C3', text: '#92400E' },
  'Bereavement':                 { bg: '#DCFCE7', text: '#166534' },
  'Medical Leave':               { bg: '#CFFAFE', text: '#155E75' },
  'Jury Duty/Voting':            { bg: '#DBEAFE', text: '#1D4ED8' },
  'Volunteer/Community Service': { bg: '#EDE9FE', text: '#6D28D9' },
  'Work from Home':              { bg: '#FCE7F3', text: '#BE185D' },
};

const EMPTY_FORM = {
  start_date: '',
  end_date: '',
  leave_type: 'Vacation',
  other_reason: '',
  comments: '',
};

export default function VacationLogs({ userRole, userId, profile }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState('requests');
  const [summaryData, setSummaryData] = useState(null);
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [overlapWarning, setOverlapWarning] = useState(null);

  const isAdmin = userRole === 'admin';
  const canSeeAll = isAdmin || userRole === 'pm';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchRequests(); }, [userId]);

  async function fetchRequests() {
    setLoading(true);
    let query = supabase
      .from('vacation_requests')
      .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name, email)')
      .order('created_at', { ascending: false });
    if (!canSeeAll) query = query.eq('requested_by', userId);
    const { data } = await query;
    setRequests(data || []);
    setLoading(false);
  }

  async function fetchSummaries() {
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const [{ data: members }, { data: reqs }] = await Promise.all([
      supabase.from('profiles').select('full_name').not('full_name', 'is', null).order('full_name'),
      supabase
        .from('vacation_requests')
        .select('start_date, end_date, leave_type, requester:profiles!vacation_requests_requested_by_fkey(full_name)')
        .in('status', ['pending', 'approved'])
        .lte('start_date', yearEnd)
        .gte('end_date', yearStart),
    ]);

    const clamp = (start, end) => {
      const s = start < yearStart ? yearStart : start;
      const e = end > yearEnd ? yearEnd : end;
      return Math.max(0, Math.ceil((new Date(e) - new Date(s)) / 86400000) + 1);
    };

    const summary = {};
    for (const m of (members || [])) summary[m.full_name] = {};
    for (const req of (reqs || [])) {
      const name = req.requester?.full_name;
      if (!name) continue;
      if (!summary[name]) summary[name] = {};
      const days = clamp(req.start_date, req.end_date);
      summary[name][req.leave_type] = (summary[name][req.leave_type] || 0) + days;
    }
    setSummaryData(summary);
  }

  async function autoReassignMeetings(requestedBy, startDate, endDate, requesterName) {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auto-reassign-meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedBy, startDate, endDate, requesterName }),
      });
    } catch (err) {
      console.error('Auto-reassign failed:', err);
    }
  }

  async function handleSubmitRequest(e) {
    e.preventDefault();
    const autoApprove = NO_APPROVAL_REQUIRED.has(form.leave_type);
    const leaveTypeLabel = form.leave_type;

    const payload = {
      requested_by: userId,
      start_date: form.start_date,
      end_date: form.end_date,
      leave_type: leaveTypeLabel,
      comments: form.comments,
      ...(autoApprove ? {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      } : {}),
    };

    const { data, error } = await supabase
      .from('vacation_requests')
      .insert([payload])
      .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name, email)')
      .single();

    if (!error && data && !autoApprove) {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vacation-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: data.id,
          memberName: profile?.full_name || 'Lab Member',
          memberEmail: profile?.email,
          startDate: data.start_date,
          endDate: data.end_date,
          leaveType: data.leave_type,
          comments: data.comments || '',
        }),
      });
    }

    if (!error && data && autoApprove) {
      await autoReassignMeetings(userId, form.start_date, form.end_date, profile?.full_name || 'Lab Member');
    }

    if (!error) {
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchRequests();
      if (summaryData !== null) fetchSummaries();
    }
  }

  async function handleReview(requestId, status) {
    const { error } = await supabase
      .from('vacation_requests')
      .update({
        status,
        reviewer_comment: reviewerComment,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (!error) {
      const request = requests.find(r => r.id === requestId);
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vacation-reviewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberEmail: request.requester.email,
          memberName: request.requester.full_name,
          status,
          startDate: request.start_date,
          endDate: request.end_date,
          leaveType: request.leave_type,
          reviewerComment: reviewerComment || '',
        }),
      });

      if (status === 'approved') {
        await autoReassignMeetings(request.requested_by, request.start_date, request.end_date, request.requester.full_name);
      }

      setReviewingId(null);
      setReviewerComment('');
      fetchRequests();
    }
  }

  async function handleDelete(requestId) {
    await supabase.from('vacation_requests').delete().eq('id', requestId);
    fetchRequests();
  }

  function getDayCount(start, end) {
    const diff = new Date(end) - new Date(start);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const today = new Date().toISOString().split('T')[0];
  const currentlyOut = approvedRequests.filter(r => r.start_date <= today && r.end_date >= today);

  // Overlap detection — only meaningful when viewing all requests (admin/PM)
  const overlapMap = {};
  if (canSeeAll) {
    const nonDenied = requests.filter(r => r.status !== 'denied');
    for (let i = 0; i < nonDenied.length; i++) {
      for (let j = i + 1; j < nonDenied.length; j++) {
        const rA = nonDenied[i];
        const rB = nonDenied[j];
        if (rA.requested_by === rB.requested_by) continue;
        if (rA.start_date <= rB.end_date && rB.start_date <= rA.end_date) {
          const overlapStart = rA.start_date > rB.start_date ? rA.start_date : rB.start_date;
          const overlapEnd   = rA.end_date   < rB.end_date   ? rA.end_date   : rB.end_date;
          if (!overlapMap[rA.id]) overlapMap[rA.id] = [];
          if (!overlapMap[rB.id]) overlapMap[rB.id] = [];
          overlapMap[rA.id].push({ name: rB.requester?.full_name || 'Unknown', overlapStart, overlapEnd, theirStart: rB.start_date, theirEnd: rB.end_date });
          overlapMap[rB.id].push({ name: rA.requester?.full_name || 'Unknown', overlapStart, overlapEnd, theirStart: rA.start_date, theirEnd: rA.end_date });
        }
      }
    }
  }


  const needsApproval = !NO_APPROVAL_REQUIRED.has(form.leave_type);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Time Off</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Submit and track time away from the lab</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
          background: 'var(--purple-primary)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px',
        }}><Plus size={16} /> Request Time Away</button>
      </div>

      {currentlyOut.length > 0 && (
        <div style={{
          background: '#FEF9E7', border: '1px solid #FAD7A0',
          borderRadius: 'var(--radius-md)', padding: '14px 16px',
          marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <Palmtree size={16} color="#F39C12" />
          <span style={{ fontSize: '13px', color: '#F39C12', fontWeight: 500 }}>
            Currently out: {currentlyOut.map(r => r.requester?.full_name).join(', ')}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total', value: requests.length, color: 'var(--purple-primary)', bg: 'var(--purple-faint)' },
          { label: 'Pending', value: pendingRequests.length, color: '#F39C12', bg: '#FEF9E7' },
          { label: 'Approved', value: approvedRequests.length, color: '#27AE60', bg: '#EAF7F0' },
          { label: 'Out Today', value: currentlyOut.length, color: '#2980B9', bg: '#EBF5FB' },
        ].map(stat => (
          <div key={stat.label} style={{
            flex: 1, background: stat.bg, borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: stat.color, marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {canSeeAll && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {[
            { id: 'requests', label: 'All Requests' },
            { id: 'summaries', label: `Summaries — ${new Date().getFullYear()}` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'summaries' && !summaryData) fetchSummaries();
              }}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? 'var(--purple-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--purple-primary)' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'summaries' && canSeeAll ? (
        summaryData === null ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading summaries...</div>
        ) : Object.keys(summaryData).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
            No approved or pending requests for {new Date().getFullYear()}.
          </div>
        ) : (() => {
          const allTypes = LEAVE_TYPES;
          const allPeople = Object.keys(summaryData).sort();
          const getTotal = n => Object.values(summaryData[n] || {}).reduce((s, v) => s + v, 0);
          const visible = selectedPeople.length === 0 ? allPeople : allPeople.filter(p => selectedPeople.includes(p));
          const sorted = [...visible].sort((a, b) => {
            const dir = sortDir === 'asc' ? 1 : -1;
            if (sortCol === 'name') return dir * a.localeCompare(b);
            if (sortCol === 'total') return (dir * (getTotal(a) - getTotal(b))) || a.localeCompare(b);
            const av = (summaryData[a] || {})[sortCol] || 0;
            const bv = (summaryData[b] || {})[sortCol] || 0;
            return (dir * (av - bv)) || a.localeCompare(b);
          });
          const toggleSort = col => {
            if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
            else { setSortCol(col); setSortDir('desc'); }
          };
          const arrow = col => sortCol === col
            ? <span style={{ marginLeft: 3, fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
            : <span style={{ marginLeft: 3, fontSize: 10, opacity: 0.3 }}>↕</span>;
          return (
            <div>
              {filterOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setFilterOpen(false)} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', position: 'relative' }}>
                <button
                  onClick={() => setFilterOpen(o => !o)}
                  style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Filter people
                  {selectedPeople.length > 0 && (
                    <span style={{ background: 'var(--purple-primary)', color: 'white', borderRadius: '10px', padding: '1px 6px', fontSize: '11px', fontWeight: 700 }}>{selectedPeople.length}</span>
                  )}
                </button>
                {selectedPeople.length > 0 && (
                  <button onClick={() => setSelectedPeople([])} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>Clear</button>
                )}
                {filterOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: '8px 0', minWidth: '200px', maxHeight: '240px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', gap: '12px', padding: '6px 12px 8px', borderBottom: '1px solid var(--border)' }}>
                      <button onClick={() => setSelectedPeople([])} style={{ fontSize: '11px', color: 'var(--purple-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Show all</button>
                      <button onClick={() => setSelectedPeople([...allPeople])} style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>None</button>
                    </div>
                    {allPeople.map(name => {
                      const checked = selectedPeople.length === 0 || selectedPeople.includes(name);
                      return (
                        <label key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            if (selectedPeople.length === 0) {
                              setSelectedPeople(allPeople.filter(p => p !== name));
                            } else if (checked) {
                              const next = selectedPeople.filter(p => p !== name);
                              setSelectedPeople(next.length === 0 ? [] : next);
                            } else {
                              const next = [...selectedPeople, name];
                              setSelectedPeople(next.length === allPeople.length ? [] : next);
                            }
                          }} />
                          {name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th onClick={() => toggleSort('name')} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                        Person {arrow('name')}
                      </th>
                      {allTypes.map(type => {
                        const c = LEAVE_COLORS[type] || { bg: '#F2F3F4', text: '#626567' };
                        return (
                          <th key={type} onClick={() => toggleSort(type)} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: c.text, fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', background: c.bg }}>
                            {type} {arrow(type)}
                          </th>
                        );
                      })}
                      <th onClick={() => toggleSort('total')} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                        Total {arrow('total')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((name, i) => {
                      const row = summaryData[name] || {};
                      const total = getTotal(name);
                      return (
                        <tr key={name} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{name}</td>
                          {allTypes.map(type => {
                            const days = row[type] || 0;
                            const c = LEAVE_COLORS[type] || { bg: '#F2F3F4', text: '#626567' };
                            return (
                              <td key={type} style={{ padding: '10px 14px', textAlign: 'center', color: days > 0 ? c.text : 'var(--text-muted)', fontWeight: days > 0 ? 600 : 400 }}>
                                {days > 0 ? `${days}d` : '—'}
                              </td>
                            );
                          })}
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--purple-primary)' }}>{total}d</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          No time away requests found.
        </div>
      ) : (
        requests.map(request => {
          const statusStyle = STATUS_STYLES[request.status] || STATUS_STYLES.pending;
          const leaveColor = LEAVE_COLORS[request.leave_type] || LEAVE_COLORS['Other'];
          const days = getDayCount(request.start_date, request.end_date);
          const isReviewing = reviewingId === request.id;
          const overlaps = overlapMap[request.id];
          const hasOverlap = !!(overlaps && overlaps.length > 0);
          const warningOpen = overlapWarning === request.id;

          return (
            <div key={request.id} style={{ position: 'relative',
              background: hasOverlap ? '#FFF5F5' : 'var(--bg-card)',
              border: `1px solid ${hasOverlap ? '#E74C3C' : request.status === 'pending' && isAdmin ? '#FAD7A0' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)', padding: '16px',
              marginBottom: '12px', boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                      <User size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {request.requester?.full_name}
                      </span>
                      {hasOverlap && (
                        <button
                          onClick={() => setOverlapWarning(warningOpen ? null : request.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#92400E', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <AlertTriangle size={11} color="#D97706" />
                          {overlaps.length} overlap{overlaps.length > 1 ? 's' : ''}
                        </button>
                      )}
                    </div>
                    {(request.requested_by === userId || (isAdmin && request.status !== 'approved')) && (
                      <button onClick={() => handleDelete(request.id)}
                        title="Remove this request"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <Trash2 size={14} />
                      </button>
                    )}
                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: leaveColor.bg, color: leaveColor.text }}>
                      {request.leave_type}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                      {statusStyle.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: request.comments ? '8px' : '0' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <Calendar size={13} />
                      {request.start_date} → {request.end_date}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--purple-primary)', fontWeight: 500 }}>
                      <Clock size={13} />
                      {days} day{days !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {request.comments && (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '8px 0 0', fontStyle: 'italic' }}>
                      "{request.comments}"
                    </p>
                  )}

                  {request.reviewer_comment && (
                    <div style={{ marginTop: '10px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${statusStyle.text}` }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                        <MessageSquare size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        {request.reviewer_comment}
                      </p>
                    </div>
                  )}
                </div>

                {isAdmin && request.status === 'pending' && !isReviewing && (
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => setReviewingId(request.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                      background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                      fontSize: '12px', fontWeight: 500,
                    }}><MessageSquare size={13} /> Review</button>
                    <button onClick={() => handleReview(request.id, 'approved')} style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px',
                      borderRadius: 'var(--radius-md)', border: 'none',
                      background: '#EAF7F0', color: '#27AE60', fontSize: '12px', fontWeight: 600,
                    }}><CheckCircle size={13} /> Approve</button>
                    <button onClick={() => handleReview(request.id, 'denied')} style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px',
                      borderRadius: 'var(--radius-md)', border: 'none',
                      background: '#FDEDEC', color: '#E74C3C', fontSize: '12px', fontWeight: 600,
                    }}><XCircle size={13} /> Deny</button>
                  </div>
                )}
              </div>

              {warningOpen && overlaps && (
                <div style={{ position: 'absolute', left: 16, top: '100%', marginTop: 6, zIndex: 50, background: 'white', border: '1px solid #E74C3C', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.15)', padding: '14px 18px', minWidth: 300, maxWidth: 420 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#E74C3C', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={12} color="#E74C3C" /> Overlapping time off
                  </div>
                  {overlaps.map((o, idx) => (
                    <div key={idx} style={{ padding: '8px 0', borderTop: idx > 0 ? '1px solid #FDEDEC' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{o.name}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Away: {fmtDate(o.theirStart)} → {fmtDate(o.theirEnd)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#E74C3C' }}>Overlap: {fmtDate(o.overlapStart)} → {fmtDate(o.overlapEnd)}</span>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setOverlapWarning(null)} style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Dismiss</button>
                </div>
              )}

              {isReviewing && (
                <div style={{ marginTop: '12px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Add Comment (optional)
                  </label>
                  <textarea
                    value={reviewerComment}
                    onChange={e => setReviewerComment(e.target.value)}
                    placeholder="Add a note to the lab member..."
                    rows={2}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setReviewingId(null); setReviewerComment(''); }} style={{
                      padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px',
                    }}>Cancel</button>
                    <button onClick={() => handleReview(request.id, 'approved')} style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 14px',
                      borderRadius: 'var(--radius-md)', border: 'none',
                      background: '#EAF7F0', color: '#27AE60', fontSize: '12px', fontWeight: 600,
                    }}><CheckCircle size={13} /> Approve</button>
                    <button onClick={() => handleReview(request.id, 'denied')} style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 14px',
                      borderRadius: 'var(--radius-md)', border: 'none',
                      background: '#FDEDEC', color: '#E74C3C', fontSize: '12px', fontWeight: 600,
                    }}><XCircle size={13} /> Deny</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {overlapWarning && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOverlapWarning(null)} />}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '500px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Request Time Away</h2>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</label>
                <input type="date" value={form.start_date}
                  max={form.end_date || undefined}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(p => ({ ...p, start_date: val, end_date: p.end_date && p.end_date < val ? val : p.end_date }));
                  }}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</label>
                <input type="date" value={form.end_date}
                  min={form.start_date || undefined}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(p => ({ ...p, end_date: val, start_date: p.start_date && p.start_date > val ? val : p.start_date }));
                  }}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type of Leave</label>
              <select
                value={form.leave_type}
                onChange={e => setForm(p => ({ ...p, leave_type: e.target.value, other_reason: '' }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                {LEAVE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {NO_APPROVAL_REQUIRED.has(form.leave_type) && (
                <p style={{ fontSize: '12px', color: '#27AE60', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={12} /> This type does not require approval and will be logged automatically.
                </p>
              )}
              {needsApproval && (
                <p style={{ fontSize: '12px', color: '#F39C12', marginTop: '6px' }}>
                  This request will be sent for approval.
                </p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comments <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <textarea value={form.comments} onChange={e => setForm(p => ({ ...p, comments: e.target.value }))}
                placeholder="Any additional context..."
                rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button
                onClick={handleSubmitRequest}
                disabled={!form.start_date || !form.end_date}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                  background: (!form.start_date || !form.end_date) ? 'var(--border)' : 'var(--purple-primary)',
                  color: (!form.start_date || !form.end_date) ? 'var(--text-muted)' : 'white',
                  fontWeight: 600,
                }}
              >
                {needsApproval ? 'Submit for Approval' : 'Log Time Away'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
