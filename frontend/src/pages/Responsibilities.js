import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Send, CheckCircle, XCircle,
  AlertTriangle, Upload, ChevronDown,
  ChevronUp, Clock, Search
} from 'lucide-react';

const FREQUENCY_COLORS = {
  daily: { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  weekly: { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  biweekly: { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
  monthly: { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  yearly: { bg: '#FDEDEC', text: '#E74C3C', border: '#F1948A' },
};

function TaskItem({ task, response, existingResponse, onResponse, onPhotoUpload, canEdit, profile }) {
  const [expanded, setExpanded] = useState(false);
  const isNo = response?.response === 'no';

  async function handleSopPhoto(file) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `sop-photos/${task.id}/${Date.now()}-${safeName}`;
    const { data, error } = await supabase.storage.from('lab-files').upload(path, file);
    if (error) { console.error('Upload error:', error); return; }
    if (data) {
      const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
      onPhotoUpload(task.id, urlData.publicUrl, true);

      // Send SOP alert email
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/sop-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: task.title,
          photoUrl: urlData.publicUrl,
          submittedByName: profile?.full_name || 'Lab Member',
          submittedByEmail: profile?.email || ''
        })
      });
    }
  }

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', marginBottom: '8px',
      overflow: 'hidden', boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px' }}>
        {canEdit && (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginTop: '2px' }}>
            {(task.response_type === 'yes_no' || task.response_type === 'yes_no_na') ? (
              <>
                <button onClick={() => onResponse(task.id, 'yes')} title="Yes" style={{
                  width: '28px', height: '28px', borderRadius: '50%', border: '2px solid',
                  borderColor: response?.response === 'yes' ? 'var(--success)' : 'var(--border)',
                  background: response?.response === 'yes' ? 'var(--success)' : 'transparent',
                  color: response?.response === 'yes' ? 'white' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><CheckCircle size={14} /></button>
                <button onClick={() => { onResponse(task.id, 'no'); setExpanded(true); }} title="No" style={{
                  width: '28px', height: '28px', borderRadius: '50%', border: '2px solid',
                  borderColor: response?.response === 'no' ? 'var(--danger)' : 'var(--border)',
                  background: response?.response === 'no' ? 'var(--danger)' : 'transparent',
                  color: response?.response === 'no' ? 'white' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><XCircle size={14} /></button>
                {task.response_type === 'yes_no_na' && (
                  <button onClick={() => onResponse(task.id, 'na')} title="N/A" style={{
                    padding: '0 8px', height: '28px', borderRadius: '14px', border: '2px solid',
                    borderColor: response?.response === 'na' ? 'var(--text-muted)' : 'var(--border)',
                    background: response?.response === 'na' ? 'var(--text-muted)' : 'transparent',
                    color: response?.response === 'na' ? 'white' : 'var(--text-muted)',
                    fontSize: '10px', fontWeight: 600
                  }}>N/A</button>
                )}
              </>
            ) : task.response_type === 'checkbox' ? (
              <button onClick={() => onResponse(task.id, response?.response === 'checked' ? '' : 'checked')} title="Check off" style={{
                width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', border: '2px solid',
                borderColor: response?.response === 'checked' ? 'var(--purple-primary)' : 'var(--border)',
                background: response?.response === 'checked' ? 'var(--purple-primary)' : 'transparent',
                color: response?.response === 'checked' ? 'white' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}><CheckCircle size={14} /></button>
            ) : (
              <label title="Upload photo" style={{
                width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
                border: '2px solid var(--border)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer'
              }}>
                <Upload size={14} />
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => onPhotoUpload(task.id, e.target.files[0])} />
              </label>
            )}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: '13px',
            color: response?.response === 'yes' || response?.response === 'checked' ? 'var(--text-muted)' : 'var(--text-primary)',
            textDecoration: response?.response === 'yes' || response?.response === 'checked' ? 'line-through' : 'none',
            lineHeight: 1.5
          }}>{task.title}</p>
          {task.sop_trigger && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              marginTop: '4px', padding: '2px 8px', background: '#FEF0F0',
              color: 'var(--danger)', borderRadius: '12px', fontSize: '10px', fontWeight: 600
            }}><AlertTriangle size={10} /> SOP Trigger</span>
          )}
        </div>
        {isNo && task.conditional_text && (
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', flexShrink: 0 }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
        {existingResponse && (
  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
    <span style={{ fontSize: '11px', color: 'var(--success)' }}>✓</span>
    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
      Completed by {existingResponse.assignment?.profile?.full_name || 'Unknown'} on {new Date(existingResponse.responded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </span>
  </div>
)}
      </div>
      {isNo && expanded && task.conditional_text && (
        <div style={{ padding: '12px 16px', background: '#FEF0F0', borderTop: '1px solid #FADBD8' }}>
          <p style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 500, marginBottom: '10px' }}>
            <AlertTriangle size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            {task.conditional_text}
          </p>
          {canEdit && (
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Upload correction photo:</p>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', background: 'white', border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer'
              }}>
                <Upload size={12} /> Choose Photo
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => handleSopPhoto(e.target.files[0])} />
              </label>
              {response?.sop_photo_url && (
                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--success)' }}>
                  Photo uploaded and sent to PM
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Responsibilities({ userRole, userId, profile }) {
  const [tasks, setTasks] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [responses, setResponses] = useState({});
  const [existingResponses, setExistingResponses] = useState({});
  const [activeFrequency, setActiveFrequency] = useState('daily');
  const [activeCategory, setActiveCategory] = useState('MISC');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '', category: 'MISC', frequency: 'daily',
    response_type: 'yes_no', sop_trigger: false, conditional_text: ''
  });

  const canManage = userRole === 'admin' || userRole === 'pm';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [userId]);

  async function fetchData() {
    setLoading(true);
    let taskQuery = supabase
      .from('tasks_definitions').select('*').eq('status', 'published')
      .order('category').order('frequency');

    const { data: taskData } = await taskQuery;

    const { data: assignmentData } = await supabase
      .from('task_assignments').select('*')
      .eq('assigned_to', userId).eq('status', 'pending');

    const { data: responseData } = await supabase
      .from('task_responses')
      .select('*, assignment:task_assignments(assigned_to, profile:profiles(full_name))')
      .order('responded_at', { ascending: false });

    const responseMap = {};
    for (const r of (responseData || [])) {
      if (!responseMap[r.task_definition_id]) {
        responseMap[r.task_definition_id] = r;
      }
    }

    setTasks(taskData || []);
    setMyAssignments(assignmentData || []);
    setExistingResponses(responseMap);
    setLoading(false);
  }

  function handleResponse(taskId, value) {
    setResponses(prev => ({ ...prev, [taskId]: { ...prev[taskId], response: value } }));
  }

  function handlePhotoUpload(taskId, urlOrFile, isSop = false) {
    if (typeof urlOrFile === 'string') {
      setResponses(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], [isSop ? 'sop_photo_url' : 'photo_url']: urlOrFile }
      }));
    }
  }

  async function handleSubmitChecklist() {
    const assignment = myAssignments.find(a =>
      tasks.filter(t => t.frequency === activeFrequency && t.category === activeCategory)
        .some(t => t.id === a.task_definition_id)
    );

    const responseArray = filteredTasks.map(task => ({
      taskId: task.id,
      taskTitle: task.title,
      response: responses[task.id]?.response || '',
      conditionalResponse: responses[task.id]?.conditional_response || '',
      photoUrl: responses[task.id]?.photo_url || '',
      sopPhotoUrl: responses[task.id]?.sop_photo_url || '',
    }));

    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/submit-checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: assignment?.id || null,
          responses: responseArray,
          submittedBy: userId,
          submittedByName: profile?.full_name || 'Lab Member',
          cycleStart: new Date().toISOString().split('T')[0]
        })
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setResponses({});
        setTimeout(() => setSubmitted(false), 4000);
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
    setSubmitting(false);
  }

  async function handleAddTask(e) {
    e.preventDefault();
    const { error } = await supabase
      .from('tasks_definitions').insert([{ ...newTask, status: 'pending_review' }]);
    if (!error) {
      setShowNewTaskForm(false);
      setNewTask({ title: '', category: 'MISC', frequency: 'daily', response_type: 'yes_no', sop_trigger: false, conditional_text: '' });
      fetchData();
    }
  }

  const assignedTaskIds = new Set(myAssignments.map(a => a.task_definition_id));

  const filteredTasks = tasks.filter(t =>
    t.frequency === activeFrequency && t.category === activeCategory &&
    (searchQuery === '' || t.title.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (canManage || assignedTaskIds.has(t.id))
  );

  const completedCount = filteredTasks.filter(t =>
    responses[t.id]?.response && responses[t.id]?.response !== ''
  ).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Lab Responsibilities</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Consistent lab tasks and equipment maintenance</p>
        </div>
        {canManage && (
          <button onClick={() => setShowNewTaskForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
            background: 'var(--purple-primary)', color: 'white', border: 'none',
            borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', boxShadow: 'var(--shadow-sm)'
          }}><Plus size={16} /> Add Task</button>
        )}
      </div>

      {submitted && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
          background: '#EAF7F0', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-md)',
          color: 'var(--success)', fontSize: '13px', marginBottom: '16px'
        }}>
          <CheckCircle size={14} /> Checklist submitted! The PM has been notified.
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '8px 12px'
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '8px 14px',
          fontSize: '12px', color: 'var(--text-secondary)'
        }}>
          <CheckCircle size={14} color="var(--success)" />
          {completedCount} / {filteredTasks.length} completed
        </div>
      </div>

      {filteredTasks.length > 0 && (
        <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${(completedCount / filteredTasks.length) * 100}%`,
            background: 'var(--purple-primary)', borderRadius: '2px', transition: 'width 0.3s ease'
          }} />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          {assignedTaskIds.size === 0 && !canManage
            ? 'You have not been assigned any tasks in this section yet.'
            : 'No tasks found for this selection.'}
        </div>
      ) : (
        <>
          {filteredTasks.map(task => (
            <TaskItem key={task.id} task={task} response={responses[task.id]} existingResponse={existingResponses[task.id]}
              onResponse={handleResponse} onPhotoUpload={handlePhotoUpload}
              canEdit={true} profile={profile} />
          ))}
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSubmitChecklist} disabled={submitting} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
              background: submitted ? 'var(--success)' : 'var(--purple-primary)',
              color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
              fontWeight: 600, fontSize: '14px', boxShadow: 'var(--shadow-md)'
            }}>
              {submitted ? <CheckCircle size={16} /> : <Send size={16} />}
              {submitting ? 'Submitting...' : submitted ? 'Submitted!' : 'Submit Checklist'}
            </button>
          </div>
        </>
      )}

      {showNewTaskForm && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '520px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add New Task</h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task Description</label>
              <textarea value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
                <select value={newTask.category} onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="MISC">MISC</option>
                  <option value="PM">PM</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Frequency</label>
                <select value={newTask.frequency} onChange={e => setNewTask(p => ({ ...p, frequency: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Response Type</label>
                <select value={newTask.response_type} onChange={e => setNewTask(p => ({ ...p, response_type: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="yes_no">Yes / No</option>
                  <option value="yes_no_na">Yes / No / N/A</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="photo">Photo Upload</option>
                </select>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '22px' }}>
                <input type="checkbox" id="sop" checked={newTask.sop_trigger}
                  onChange={e => setNewTask(p => ({ ...p, sop_trigger: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--purple-primary)' }} />
                <label htmlFor="sop" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>SOP Trigger</label>
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conditional Follow-up (shown when marked No)</label>
              <textarea value={newTask.conditional_text} onChange={e => setNewTask(p => ({ ...p, conditional_text: e.target.value }))}
                rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewTaskForm(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleAddTask} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600 }}>Submit for Review</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
