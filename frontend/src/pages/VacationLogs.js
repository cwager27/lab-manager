import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Calendar, CheckCircle, XCircle,
  Clock, User, MessageSquare, Palmtree
} from 'lucide-react';

const LEAVE_TYPES = ['Vacation', 'Sick', 'Personal'];

const STATUS_STYLES = {
  pending: { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0', label: 'Pending' },
  approved: { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF', label: 'Approved' },
  denied: { bg: '#FDEDEC', text: '#E74C3C', border: '#F1948A', label: 'Denied' },
};

const LEAVE_COLORS = {
  Vacation: { bg: '#EBF5FB', text: '#2980B9' },
  Sick: { bg: '#FDEDEC', text: '#E74C3C' },
  Personal: { bg: '#F5EEF8', text: '#7B3FA0' },
};

export default function VacationLogs({ userRole, userId, profile }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [form, setForm] = useState({
    start_date: '',
    end_date: '',
    leave_type: 'Vacation',
    comments: ''
  });

  const isAdmin = userRole === 'admin';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchRequests(); }, [userId]);

  async function fetchRequests() {
    setLoading(true);
    let query = supabase
      .from('vacation_requests')
      .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name, email)')
      .order('created_at', { ascending: false });
    
    if (!isAdmin) {
      query = query.eq('requested_by', userId);
    }
    
    const { data } = await query;
    setRequests(data || []);
    setLoading(false);
  }

  async function handleSubmitRequest(e) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('vacation_requests')
      .insert([{ ...form, requested_by: userId }])
      .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name, email)')
      .single();

    if (!error && data) {
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
          comments: data.comments || ''
        })
      });

      setShowForm(false);
      setForm({ start_date: '', end_date: '', leave_type: 'Vacation', comments: '' });
      fetchRequests();
    }
  }

  async function handleReview(requestId, status) {
    const { error } = await supabase
      .from('vacation_requests')
      .update({
        status,
        reviewer_comment: reviewerComment,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString()
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
          reviewerComment: reviewerComment || ''
        })
      });

      setReviewingId(null);
      setReviewerComment('');
      fetchRequests();
    }
  }

  function getDayCount(start, end) {
    const diff = new Date(end) - new Date(start);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  const myRequests = requests.filter(r => r.requested_by === userId);
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');

  const filteredRequests = requests.filter(r => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'mine') return r.requested_by === userId;
    if (activeFilter === 'pending') return r.status === 'pending';
    if (activeFilter === 'approved') return r.status === 'approved';
    return true;
  });

  // Who is currently out
  const today = new Date().toISOString().split('T')[0];
  const currentlyOut = approvedRequests.filter(r =>
    r.start_date <= today && r.end_date >= today
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Vacation Logs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Request and track time off</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
          background: 'var(--purple-primary)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px'
        }}><Plus size={16} /> Request Time Off</button>
      </div>

      {/* Currently out banner */}
      {currentlyOut.length > 0 && (
        <div style={{
          background: '#FEF9E7', border: '1px solid #FAD7A0',
          borderRadius: 'var(--radius-md)', padding: '14px 16px',
          marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <Palmtree size={16} color="#F39C12" />
          <span style={{ fontSize: '13px', color: '#F39C12', fontWeight: 500 }}>
            Currently out of office: {currentlyOut.map(r => r.requester?.full_name).join(', ')}
          </span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'My Requests', value: myRequests.length, color: 'var(--purple-primary)', bg: 'var(--purple-faint)' },
          { label: 'Pending', value: pendingRequests.length, color: '#F39C12', bg: '#FEF9E7' },
          { label: 'Approved', value: approvedRequests.length, color: '#27AE60', bg: '#EAF7F0' },
          { label: 'Out Today', value: currentlyOut.length, color: '#2980B9', bg: '#EBF5FB' },
        ].map(stat => (
          <div key={stat.label} style={{
            flex: 1, background: stat.bg, borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: stat.color, marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'all', label: 'All Requests' },
          { id: 'mine', label: 'My Requests' },
          { id: 'pending', label: `Pending ${pendingRequests.length > 0 ? `(${pendingRequests.length})` : ''}` },
          { id: 'approved', label: 'Approved' },
        ].map(f => (
          <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{
            padding: '7px 14px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: activeFilter === f.id ? 'var(--purple-primary)' : 'var(--bg-primary)',
            color: activeFilter === f.id ? 'white' : 'var(--text-secondary)',
            fontWeight: activeFilter === f.id ? 600 : 400, fontSize: '12px'
          }}>{f.label}</button>
        ))}
      </div>

      {/* Request list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : filteredRequests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          No vacation requests found.
        </div>
      ) : (
        filteredRequests.map(request => {
          const statusStyle = STATUS_STYLES[request.status] || STATUS_STYLES.pending;
          const leaveColor = LEAVE_COLORS[request.leave_type] || LEAVE_COLORS.Vacation;
          const days = getDayCount(request.start_date, request.end_date);
          const isReviewing = reviewingId === request.id;

          return (
            <div key={request.id} style={{
              background: 'var(--bg-card)', border: `1px solid ${request.status === 'pending' && isAdmin ? '#FAD7A0' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)', padding: '16px',
              marginBottom: '12px', boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {request.requester?.full_name}
                      </span>
                    </div>
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

                {/* Admin actions */}
                {isAdmin && request.status === 'pending' && !isReviewing && (
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => setReviewingId(request.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                      background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                      fontSize: '12px', fontWeight: 500
                    }}><MessageSquare size={13} /> Review</button>
                    <button onClick={() => handleReview(request.id, 'approved')} style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px',
                      borderRadius: 'var(--radius-md)', border: 'none',
                      background: '#EAF7F0', color: '#27AE60',
                      fontSize: '12px', fontWeight: 600
                    }}><CheckCircle size={13} /> Approve</button>
                    <button onClick={() => handleReview(request.id, 'denied')} style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px',
                      borderRadius: 'var(--radius-md)', border: 'none',
                      background: '#FDEDEC', color: '#E74C3C',
                      fontSize: '12px', fontWeight: 600
                    }}><XCircle size={13} /> Deny</button>
                  </div>
                )}
              </div>

              {/* Review with comment */}
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
                      background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px'
                    }}>Cancel</button>
                    <button onClick={() => handleReview(request.id, 'approved')} style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 14px',
                      borderRadius: 'var(--radius-md)', border: 'none',
                      background: '#EAF7F0', color: '#27AE60', fontSize: '12px', fontWeight: 600
                    }}><CheckCircle size={13} /> Approve</button>
                    <button onClick={() => handleReview(request.id, 'denied')} style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 14px',
                      borderRadius: 'var(--radius-md)', border: 'none',
                      background: '#FDEDEC', color: '#E74C3C', fontSize: '12px', fontWeight: 600
                    }}><XCircle size={13} /> Deny</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Request Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '480px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Request Time Off</h2>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</label>
                <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leave Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {LEAVE_TYPES.map(type => (
                  <button key={type} onClick={() => setForm(p => ({ ...p, leave_type: type }))} style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
                    border: `2px solid ${form.leave_type === type ? 'var(--purple-primary)' : 'var(--border)'}`,
                    background: form.leave_type === type ? 'var(--purple-faint)' : 'transparent',
                    color: form.leave_type === type ? 'var(--purple-primary)' : 'var(--text-secondary)',
                    fontWeight: form.leave_type === type ? 600 : 400, fontSize: '13px'
                  }}>{type}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comments <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <textarea value={form.comments} onChange={e => setForm(p => ({ ...p, comments: e.target.value }))}
                placeholder="Any additional context..."
                rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleSubmitRequest} disabled={!form.start_date || !form.end_date} style={{
                padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                background: !form.start_date || !form.end_date ? 'var(--border)' : 'var(--purple-primary)',
                color: !form.start_date || !form.end_date ? 'var(--text-muted)' : 'white',
                fontWeight: 600
              }}>Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
