import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Send, User, Calendar, Clock, ChevronDown, CheckCircle, AlertTriangle } from 'lucide-react';

const FREQUENCY_COLORS = {
  daily: { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  weekly: { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  biweekly: { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
  monthly: { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  yearly: { bg: '#FDEDEC', text: '#E74C3C', border: '#F1948A' },
};

export default function AssignTasks({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [activeFrequency, setActiveFrequency] = useState('daily');
  const [activeCategory, setActiveCategory] = useState('MISC');
  const [cycleStart, setCycleStart] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: taskData }, { data: memberData }] = await Promise.all([
      supabase.from('tasks_definitions').select('*').eq('status', 'published').order('frequency').order('category'),
      supabase.from('profiles').select('*').order('full_name')
    ]);
    setTasks(taskData || []);
    setMembers(memberData || []);
    setLoading(false);
  }

  function getCycleEnd(start, frequency) {
    const d = new Date(start);
    if (frequency === 'daily') d.setDate(d.getDate() + 1);
    else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'biweekly') d.setDate(d.getDate() + 14);
    else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }

  function handleAssign(taskId, memberId) {
    setAssignments(prev => ({ ...prev, [taskId]: memberId }));
  }

  function assignAllToMember(memberId) {
    const filtered = tasks.filter(t => t.frequency === activeFrequency && t.category === activeCategory);
    const newAssignments = {};
    filtered.forEach(t => { newAssignments[t.id] = memberId; });
    setAssignments(prev => ({ ...prev, ...newAssignments }));
  }

  async function handleSendAssignments() {
    const filtered = tasks.filter(t => t.frequency === activeFrequency && t.category === activeCategory);
    const toAssign = filtered.filter(t => assignments[t.id]);

    if (toAssign.length === 0) {
      setError('Please assign at least one task before sending.');
      return;
    }

    setSending(true);
    setError('');
    const cycleEnd = getCycleEnd(cycleStart, activeFrequency);

    try {
      // Save assignments to Supabase
      for (const task of toAssign) {
        await supabase.from('task_assignments').insert([{
          task_definition_id: task.id,
          assigned_to: assignments[task.id],
          assigned_by: userId,
          cycle_start: cycleStart,
          cycle_end: cycleEnd,
          status: 'pending'
        }]);
      }

      // Build email payload
      const emailAssignments = toAssign.map(task => {
        const member = members.find(m => m.id === assignments[task.id]);
        return {
          memberId: member.id,
          memberEmail: member.email,
          memberName: member.full_name,
          taskTitle: task.title
        };
      });

      // Send emails via backend
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/send-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: emailAssignments, cycleStart, cycleEnd, assignedBy: userId })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      setSent(true);
      setAssignments({});
      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      setError('Failed to send assignments. Please try again.');
      console.error(err);
    }

    setSending(false);
  }

  const filteredTasks = tasks.filter(t =>
    t.frequency === activeFrequency && t.category === activeCategory
  );
  const assignedCount = filteredTasks.filter(t => assignments[t.id]).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Assign Tasks</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Assign lab responsibilities to team members</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} color="var(--text-muted)" />
            <input type="date" value={cycleStart} onChange={e => setCycleStart(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }} />
          </div>
          <button onClick={handleSendAssignments} disabled={sending || assignedCount === 0} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 16px',
            background: sent ? 'var(--success)' : assignedCount === 0 ? 'var(--border)' : 'var(--purple-primary)',
            color: assignedCount === 0 ? 'var(--text-muted)' : 'white',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontWeight: 600, fontSize: '13px'
          }}>
            {sent ? <CheckCircle size={16} /> : <Send size={16} />}
            {sent ? 'Sent!' : sending ? 'Sending...' : `Send ${assignedCount > 0 ? `(${assignedCount})` : ''}`}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px', background: '#FEF0F0',
          border: '1px solid #FADBD8', borderRadius: 'var(--radius-md)',
          color: 'var(--danger)', fontSize: '13px', marginBottom: '16px'
        }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {sent && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px', background: '#EAF7F0',
          border: '1px solid #A9DFBF', borderRadius: 'var(--radius-md)',
          color: 'var(--success)', fontSize: '13px', marginBottom: '16px'
        }}>
          <CheckCircle size={14} /> Assignments saved and emails sent successfully!
        </div>
      )}

      {members.length > 0 && (
        <div style={{
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '14px 16px',
          marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Assign all to:</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {members.map(m => (
              <button key={m.id} onClick={() => assignAllToMember(m.id)} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--purple-faint)',
                color: 'var(--purple-primary)', fontSize: '12px', fontWeight: 500
              }}>
                {m.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {['MISC', 'PM'].map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: '8px 20px',
              background: activeCategory === cat ? 'var(--purple-primary)' : 'transparent',
              color: activeCategory === cat ? 'white' : 'var(--text-secondary)',
              border: 'none', fontWeight: 500, fontSize: '13px'
            }}>{cat}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['daily', 'weekly', 'biweekly', 'monthly', 'yearly'].map(freq => {
            const colors = FREQUENCY_COLORS[freq];
            const count = tasks.filter(t => t.frequency === freq && t.category === activeCategory).length;
            return (
              <button key={freq} onClick={() => setActiveFrequency(freq)} style={{
                padding: '7px 14px', borderRadius: 'var(--radius-md)',
                border: `1px solid ${activeFrequency === freq ? colors.border : 'var(--border)'}`,
                background: activeFrequency === freq ? colors.bg : 'var(--bg-primary)',
                color: activeFrequency === freq ? colors.text : 'var(--text-secondary)',
                fontWeight: activeFrequency === freq ? 600 : 400,
                fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <Clock size={12} />
                {freq.charAt(0).toUpperCase() + freq.slice(1)}
                <span style={{
                  background: activeFrequency === freq ? colors.text : 'var(--border)',
                  color: activeFrequency === freq ? 'white' : 'var(--text-muted)',
                  borderRadius: '10px', padding: '0 6px', fontSize: '10px'
                }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {assignedCount} of {filteredTasks.length} tasks assigned
        </span>
      </div>

      {filteredTasks.length > 0 && (
        <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${(assignedCount / filteredTasks.length) * 100}%`,
            background: 'var(--purple-primary)', borderRadius: '2px', transition: 'width 0.3s ease'
          }} />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          No tasks found for this selection.
        </div>
      ) : (
        filteredTasks.map(task => (
          <div key={task.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '14px 16px',
            marginBottom: '8px', display: 'flex', alignItems: 'center',
            gap: '12px', boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{task.title}</p>
              {task.sop_trigger && (
                <span style={{
                  display: 'inline-block', marginTop: '4px', padding: '2px 8px',
                  background: '#FEF0F0', color: 'var(--danger)',
                  borderRadius: '12px', fontSize: '10px', fontWeight: 600
                }}>SOP Trigger</span>
              )}
            </div>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <User size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <select value={assignments[task.id] || ''} onChange={e => handleAssign(task.id, e.target.value)} style={{
                padding: '8px 32px 8px 30px',
                border: `1px solid ${assignments[task.id] ? 'var(--purple-primary)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                background: assignments[task.id] ? 'var(--purple-faint)' : 'var(--bg-primary)',
                color: assignments[task.id] ? 'var(--purple-primary)' : 'var(--text-muted)',
                fontSize: '13px', fontWeight: assignments[task.id] ? 500 : 400,
                outline: 'none', appearance: 'none', minWidth: '160px', cursor: 'pointer'
              }}>
                <option value="">Assign to...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
