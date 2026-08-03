import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, CheckCircle, XCircle, Clock, Calendar, User, Upload, Send } from 'lucide-react';

const CATEGORY_COLORS = {
  'Daily AM': { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  'Daily PM': { bg: '#EAF4FB', text: '#1A6FA8', border: '#85C1E9' },
  'Weekly': { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  'Biweekly': { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
  'Monthly': { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  'MISC': { bg: '#F2F3F4', text: '#5A5A7A', border: '#CCD1D1' },
};

const STATUS_STYLES = {
  requested: { bg: '#F5EEF8', text: '#7B3FA0', label: 'Requested' },
  pending: { bg: '#FEF9E7', text: '#F39C12', label: 'Pending' },
  in_progress: { bg: '#EBF5FB', text: '#2980B9', label: 'In Progress' },
  submitted: { bg: '#EAF7F0', text: '#27AE60', label: 'Completed' },
  overdue: { bg: '#FDEDEC', text: '#E74C3C', label: 'Overdue' },
  denied: { bg: '#FDEDEC', text: '#E74C3C', label: 'Denied' },
};

export default function SporadicTasks({ userRole, userId, profile }) {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [responses, setResponses] = useState({});
  const [newTask, setNewTask] = useState({
    title: '', description: '', category: 'MISC',
    assigned_to: '', due_date: '', response_type: 'yes_no'
  });

  const canManage = userRole === 'admin' || userRole === 'pm';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [userId]);

  async function fetchData() {
    setLoading(true);
    let query = supabase
      .from('sporadic_tasks')
      .select('*, assignee:profiles!sporadic_tasks_assigned_to_fkey(full_name, email), assigner:profiles!sporadic_tasks_assigned_by_fkey(full_name)')
      .order('due_date');
    if (!canManage) {
      query = query.or(`assigned_to.eq.${userId},assigned_by.eq.${userId}`);
    }
    const { data: taskData } = await query;
    const { data: memberData } = await supabase.from('profiles').select('*').order('full_name');
    setTasks(taskData || []);
    setMembers(memberData || []);
    setLoading(false);
  }

  function isOverdue(dueDate, status) {
    return status !== 'submitted' && status !== 'denied' && dueDate < new Date().toISOString().split('T')[0];
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    const status = canManage ? 'pending' : 'requested';
    const { data, error } = await supabase
      .from('sporadic_tasks')
      .insert([{ ...newTask, assigned_by: userId, status }])
      .select('*, assignee:profiles!sporadic_tasks_assigned_to_fkey(full_name, email)')
      .single();
    if (!error && data) {
      if (canManage && data.assignee) {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/send-sporadic-assignment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskTitle: data.title, taskDescription: data.description,
            category: data.category, dueDate: data.due_date,
            memberEmail: data.assignee.email, memberName: data.assignee.full_name,
            assignedByName: profile?.full_name || 'Lab Manager'
          })
        });
      }
      setShowNewTaskForm(false);
      setNewTask({ title: '', description: '', category: 'MISC', assigned_to: '', due_date: '', response_type: 'yes_no' });
      fetchData();
    }
  }

  async function handleApproveRequest(task) {
    await supabase.from('sporadic_tasks').update({ status: 'pending' }).eq('id', task.id);
    const member = members.find(m => m.id === task.assigned_to);
    if (member) {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/send-sporadic-assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: task.title, taskDescription: task.description,
          category: task.category, dueDate: task.due_date,
          memberEmail: member.email, memberName: member.full_name,
          assignedByName: profile?.full_name || 'Lab Manager'
        })
      });
    }
    fetchData();
  }

  async function handleDenyRequest(taskId) {
    await supabase.from('sporadic_tasks').update({ status: 'denied' }).eq('id', taskId);
    fetchData();
  }

  async function handleResponse(taskId, value) {
    setResponses(prev => ({ ...prev, [taskId]: { ...prev[taskId], response: value } }));
    await supabase.from('sporadic_tasks').update({ status: 'in_progress' }).eq('id', taskId);
  }

  async function handleSubmitTask(task) {
    const response = responses[task.id];
    if (!response?.response) { alert('Please provide a response before submitting.'); return; }
    await supabase.from('sporadic_tasks').update({
      status: 'submitted', response: response.response,
      photo_url: response.photo_url || null, submitted_at: new Date().toISOString()
    }).eq('id', task.id);
    await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/sporadic-submitted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskTitle: task.title, memberName: profile?.full_name || 'Lab Member',
        response: response.response, assignedByName: task.assigner?.full_name || 'Lab Manager'
      })
    });
    fetchData();
  }

  async function handlePhotoUpload(taskId, file) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `sporadic-photos/${taskId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('lab-files').upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
      setResponses(prev => ({ ...prev, [taskId]: { ...prev[taskId], photo_url: urlData.publicUrl } }));
    }
  }

  const filteredTasks = tasks.filter(t => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'requested') return t.status === 'requested';
    if (activeFilter === 'pending') return t.status === 'pending' || t.status === 'in_progress';
    if (activeFilter === 'completed') return t.status === 'submitted';
    if (activeFilter === 'overdue') return isOverdue(t.due_date, t.status);
    return true;
  });

  const overdueCount = tasks.filter(t => isOverdue(t.due_date, t.status)).length;
  const requestedCount = tasks.filter(t => t.status === 'requested').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Sporadic Tasks</h1>
        </div>
        <button onClick={() => setShowNewTaskForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
          background: 'var(--purple-primary)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px'
        }}><Plus size={16} /> {canManage ? 'New Task' : 'Request Task'}</button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total', value: tasks.length, color: 'var(--purple-primary)', bg: 'var(--purple-faint)' },
          { label: 'Pending', value: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length, color: '#2980B9', bg: '#EBF5FB' },
          { label: 'Completed', value: tasks.filter(t => t.status === 'submitted').length, color: '#27AE60', bg: '#EAF7F0' },
          { label: 'Overdue', value: overdueCount, color: '#E74C3C', bg: '#FDEDEC' },
        ].map(stat => (
          <div key={stat.label} style={{ flex: 1, background: stat.bg, borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: stat.color, marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'all', label: 'All Tasks' },
          { id: 'requested', label: `Requests${requestedCount > 0 ? ` (${requestedCount})` : ''}` },
          { id: 'pending', label: 'Pending' },
          { id: 'completed', label: 'Completed' },
          { id: 'overdue', label: `Overdue${overdueCount > 0 ? ` (${overdueCount})` : ''}` },
        ].map(f => (
          <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{
            padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: activeFilter === f.id ? 'var(--purple-primary)' : 'var(--bg-primary)',
            color: activeFilter === f.id ? 'white' : 'var(--text-secondary)',
            fontWeight: activeFilter === f.id ? 600 : 400, fontSize: '12px'
          }}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          No tasks found.
        </div>
      ) : filteredTasks.map(task => {
        const overdue = isOverdue(task.due_date, task.status);
        const status = overdue ? 'overdue' : task.status;
        const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;
        const catColors = CATEGORY_COLORS[task.category] || CATEGORY_COLORS['MISC'];
        const response = responses[task.id];
        const isAssignedToMe = task.assigned_to === userId;

        return (
          <div key={task.id} style={{
            background: 'var(--bg-card)', border: `1px solid ${overdue ? '#FADBD8' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '12px', boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{task.title}</h3>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: catColors.bg, color: catColors.text, border: `1px solid ${catColors.border}` }}>{task.category}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text }}>{statusStyle.label}</span>
                </div>
                {task.description && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 8px' }}>{task.description}</p>}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: overdue ? 'var(--danger)' : 'var(--text-muted)' }}><Calendar size={12} /> Due: {task.due_date}</span>
                  {task.assignee && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}><User size={12} /> {task.assignee.full_name}</span>}
                  {task.assigner && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}><Clock size={12} /> By {task.assigner.full_name}</span>}
                </div>
              </div>
            </div>

            {isAssignedToMe && task.status !== 'submitted' && task.status !== 'requested' && task.status !== 'denied' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {(task.response_type === 'yes_no' || task.response_type === 'yes_no_na') ? (
                  <>
                    <button onClick={() => handleResponse(task.id, 'yes')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '2px solid', borderColor: response?.response === 'yes' ? 'var(--success)' : 'var(--border)', background: response?.response === 'yes' ? 'var(--success)' : 'transparent', color: response?.response === 'yes' ? 'white' : 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}><CheckCircle size={14} /> Yes</button>
                    <button onClick={() => handleResponse(task.id, 'no')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '2px solid', borderColor: response?.response === 'no' ? 'var(--danger)' : 'var(--border)', background: response?.response === 'no' ? 'var(--danger)' : 'transparent', color: response?.response === 'no' ? 'white' : 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}><XCircle size={14} /> No</button>
                    {task.response_type === 'yes_no_na' && <button onClick={() => handleResponse(task.id, 'na')} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '2px solid', borderColor: response?.response === 'na' ? 'var(--text-muted)' : 'var(--border)', background: response?.response === 'na' ? 'var(--text-muted)' : 'transparent', color: response?.response === 'na' ? 'white' : 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>N/A</button>}
                  </>
                ) : task.response_type === 'checkbox' ? (
                  <button onClick={() => handleResponse(task.id, response?.response === 'checked' ? '' : 'checked')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '2px solid', borderColor: response?.response === 'checked' ? 'var(--purple-primary)' : 'var(--border)', background: response?.response === 'checked' ? 'var(--purple-primary)' : 'transparent', color: response?.response === 'checked' ? 'white' : 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}><CheckCircle size={14} /> Mark Complete</button>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }}>
                    <Upload size={14} /> Upload Photo
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhotoUpload(task.id, e.target.files[0])} />
                  </label>
                )}
                {response?.photo_url && <span style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={11} /> Photo uploaded</span>}
                {response?.response && <button onClick={() => handleSubmitTask(task)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, marginLeft: 'auto' }}><Send size={14} /> Submit</button>}
              </div>
            )}

            {canManage && task.status === 'requested' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>
                  Requested by {task.assigner?.full_name} · Suggested: {members.find(m => m.id === task.assigned_to)?.full_name || 'No suggestion'}
                </span>
                <button onClick={() => handleApproveRequest(task)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#EAF7F0', color: '#27AE60', fontSize: '12px', fontWeight: 600 }}>Approve</button>
                <button onClick={() => handleDenyRequest(task.id)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#FDEDEC', color: '#E74C3C', fontSize: '12px', fontWeight: 600 }}>Deny</button>
              </div>
            )}

            {task.status === 'submitted' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} color="var(--success)" />
                <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>Completed — Response: {task.response}</span>
              </div>
            )}
          </div>
        );
      })}

      {showNewTaskForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '520px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>{canManage ? 'Create Sporadic Task' : 'Request a Task'}</h2>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task Name</label>
                {(() => { const wc = newTask.title.trim() ? newTask.title.trim().split(/\s+/).length : 0; return wc > 8 ? <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>⚠ {wc}/8 words — keep it short</span> : wc > 0 ? <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{wc}/8 words</span> : null; })()}
              </div>
              <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Short task name (8 words max)" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${newTask.title.trim().split(/\s+/).filter(Boolean).length > 8 ? '#f59e0b' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description (optional)</label>
              <textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
                <select value={newTask.category} onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option>Daily AM</option><option>Daily PM</option><option>Weekly</option><option>Biweekly</option><option>Monthly</option><option>MISC</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Response Type</label>
                <select value={newTask.response_type} onChange={e => setNewTask(p => ({ ...p, response_type: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="yes_no">Yes / No</option><option value="yes_no_na">Yes / No / N/A</option><option value="checkbox">Checkbox</option><option value="photo">Photo Upload</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{canManage ? 'Assign To' : 'Suggested Assignee (optional)'}</label>
                <select value={newTask.assigned_to} onChange={e => setNewTask(p => ({ ...p, assigned_to: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="">{canManage ? 'Select member...' : 'No suggestion'}</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Date</label>
                <input type="date" value={newTask.due_date} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewTaskForm(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleCreateTask} disabled={!newTask.title || !newTask.due_date} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: !newTask.title || !newTask.due_date ? 'var(--border)' : 'var(--purple-primary)', color: !newTask.title || !newTask.due_date ? 'var(--text-muted)' : 'white', fontWeight: 600 }}>{canManage ? 'Create & Assign' : 'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
