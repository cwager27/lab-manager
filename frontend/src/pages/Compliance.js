import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import StudiesTab from './StudiesTab';
import PoliciesTab from './PoliciesTab';
import {
  Plus, Send, CheckCircle, XCircle,
  AlertTriangle, Upload, ChevronDown,
  ChevronUp, Search, Shield, User
} from 'lucide-react';

const SECTION_COLORS = {
  'Human and Animal Materials': { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
  'IBC Compliance': { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  'IBC': { bg: '#EAF4FB', text: '#1A6FA8', border: '#85C1E9' },
  'IRB': { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  'IACUC': { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
};

function TaskItem({ task, response, onResponse, onPhotoUpload, canEdit, assigneeName }) {
  const [expanded, setExpanded] = useState(false);
  const isNo = response?.response === 'no';
  const titleWithName = task.title.replace(/\[name\]/g, assigneeName || 'PM');

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
            color: response?.response === 'yes' ? 'var(--text-muted)' : 'var(--text-primary)',
            textDecoration: response?.response === 'yes' ? 'line-through' : 'none',
            lineHeight: 1.5
          }}>{titleWithName}</p>
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
      </div>

      {isNo && expanded && task.conditional_text && (
        <div style={{ padding: '12px 16px', background: '#FEF0F0', borderTop: '1px solid #FADBD8' }}>
          <p style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 500, marginBottom: '10px' }}>
            <AlertTriangle size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            {task.conditional_text}
          </p>
          {canEdit && task.sop_trigger && (
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Upload correction photo:</p>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                background: 'white', border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer'
              }}>
                <Upload size={12} /> Choose Photo
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => onPhotoUpload(task.id, e.target.files[0], true)} />
              </label>
              {response?.sop_photo_url && (
                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--success)' }}>Photo uploaded and sent to PM</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Compliance({ userRole, userId, profile }) {
  const [tasks, setTasks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [members, setMembers] = useState([]);
  const [responses, setResponses] = useState({});
  const [activeSection, setActiveSection] = useState('all');
  const [activeTab, setActiveTab] = useState('checklist');
  const [studies, setStudies] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [showStudyForm, setShowStudyForm] = useState(false);
  const [editingStudy, setEditingStudy] = useState(null);
  const [studyForm, setStudyForm] = useState({
    study_name: '', irb_number: '', irb_exception: false,
    tissues_held: false, ilab_exists: false, ilab_link: '',
    team_members: [], certificate_expiry: '', notes: ''
});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState({
    assigned_to: '', sections: [], cycle_start: new Date().toISOString().split('T')[0],
    cycle_end: ''
  });

  const canManage = userRole === 'admin' || userRole === 'pm';
  const sections = ['Human and Animal Materials', 'IBC Compliance', 'IBC', 'IRB', 'IACUC'];

  useEffect(() => { fetchData(); }, [userId]);

  async function fetchData() {
    setLoading(true);
    const [{ data: taskData }, { data: assignmentData }, { data: memberData }, { data: studyData }, { data: policyData }] = await Promise.all([
      supabase.from('compliance_tasks').select('*').eq('status', 'published').order('sort_order'),
      supabase.from('compliance_assignments').select('*, assignee:profiles!compliance_assignments_assigned_to_fkey(full_name, email)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('compliance_studies').select('*').order('study_name'),
      supabase.from('lab_policies').select('*').order('category').order('title')
    ]);
    setTasks(taskData || []);
    setAssignments(assignmentData || []);
    setMembers(memberData || []);
    setStudies(studyData || []);
    setPolicies(policyData || []);
    setLoading(false);
  }

  function handleResponse(taskId, value) {
    setResponses(prev => ({ ...prev, [taskId]: { ...prev[taskId], response: value } }));
  }

  async function handlePhotoUpload(taskId, file, isSop = false) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `compliance-photos/${taskId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('lab-files').upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
      setResponses(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], [isSop ? 'sop_photo_url' : 'photo_url']: urlData.publicUrl }
      }));
      if (isSop) {
        const task = tasks.find(t => t.id === taskId);
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/sop-alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskTitle: task?.title,
            photoUrl: urlData.publicUrl,
            submittedByName: profile?.full_name || 'Lab Member',
            submittedByEmail: profile?.email || ''
          })
        });
      }
    }
  }

  async function handleSubmitChecklist() {
    const myAssignment = assignments.find(a => a.assigned_to === userId && a.status === 'pending');
    const responseArray = filteredTasks.map(task => ({
      taskId: task.id,
      taskTitle: task.title,
      response: responses[task.id]?.response || '',
      photoUrl: responses[task.id]?.photo_url || '',
      sopPhotoUrl: responses[task.id]?.sop_photo_url || '',
    }));

    setSubmitting(true);
    try {
      if (myAssignment) {
        await supabase.from('compliance_assignments').update({
          status: 'submitted', submitted_at: new Date().toISOString()
        }).eq('id', myAssignment.id);

        for (const r of responseArray) {
          await supabase.from('compliance_responses').insert([{
            assignment_id: myAssignment.id,
            task_id: r.taskId,
            response: r.response,
            photo_url: r.photoUrl || null,
            sop_photo_url: r.sopPhotoUrl || null,
          }]);
        }

        await supabase.from('compliance_archives').insert([{
          assignment_id: myAssignment.id,
          archived_data: { responses: responseArray, submittedBy: userId, submittedByName: profile?.full_name }
        }]);
      }

      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/submit-checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: myAssignment?.id || null,
          responses: responseArray,
          submittedBy: userId,
          submittedByName: profile?.full_name || 'Lab Member',
          cycleStart: new Date().toISOString().split('T')[0]
        })
      });

      setSubmitted(true);
      setResponses({});
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      console.error('Submit error:', err);
    }
    setSubmitting(false);
  }

  async function handleSendAssignment(e) {
    e.preventDefault();
    const cycleEnd = assignForm.cycle_end || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const { data, error } = await supabase.from('compliance_assignments').insert([{
      assigned_to: assignForm.assigned_to,
      assigned_by: userId,
      sections: assignForm.sections.length > 0 ? assignForm.sections : sections,
      cycle_start: assignForm.cycle_start,
      cycle_end: cycleEnd,
      status: 'pending'
    }]).select('*, assignee:profiles!compliance_assignments_assigned_to_fkey(full_name, email)').single();

    if (!error && data) {
      const member = members.find(m => m.id === assignForm.assigned_to);
      const assignedSections = assignForm.sections.length > 0 ? assignForm.sections : sections;
      const assignedTasks = tasks.filter(t => assignedSections.includes(t.section));

      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/send-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: assignedTasks.map(t => ({
            memberId: member?.id,
            memberEmail: member?.email,
            memberName: member?.full_name,
            taskTitle: t.title
          })),
          cycleStart: assignForm.cycle_start,
          cycleEnd: cycleEnd,
          assignedBy: userId
        })
      });

      setShowAssignForm(false);
      setAssignForm({ assigned_to: '', sections: [], cycle_start: new Date().toISOString().split('T')[0], cycle_end: '' });
      fetchData();
    }
  }
  async function handleSaveStudy(e) {
    e.preventDefault();
    if (editingStudy) {
      await supabase.from('compliance_studies').update({ ...studyForm, updated_at: new Date().toISOString() }).eq('id', editingStudy.id);
    } else {
      await supabase.from('compliance_studies').insert([{ ...studyForm, created_by: userId }]);
    }
    setShowStudyForm(false);
    setEditingStudy(null);
    setStudyForm({ study_name: '', irb_number: '', irb_exception: false, tissues_held: false, ilab_exists: false, ilab_link: '', team_members: [], certificate_expiry: '', notes: '' });
    fetchData();
  }

  async function handleDeleteStudy(id) {
    if (window.confirm('Remove this study?')) {
      await supabase.from('compliance_studies').delete().eq('id', id);
      fetchData();
    }
  }

  async function handleCertUpload(studyId, file) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `compliance-certs/${studyId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('lab-files').upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
      await supabase.from('compliance_studies').update({ certificate_url: urlData.publicUrl }).eq('id', studyId);

      // Auto-complete any open sporadic tasks for this study's certificate renewal
      const { data: study } = await supabase.from('compliance_studies').select('study_name').eq('id', studyId).single();
      if (study) {
        const taskTitle = `Renew compliance certificate: ${study.study_name}`;
        await supabase.from('sporadic_tasks')
          .update({ status: 'submitted', submitted_at: new Date().toISOString() })
          .ilike('title', `${taskTitle}%`)
          .neq('status', 'submitted');
      }

      fetchData();
    }
  }

  const myAssignment = assignments.find(a => a.assigned_to === userId && a.status === 'pending');
  const myAssignedSections = myAssignment?.sections || [];

  const filteredTasks = tasks.filter(t => {
    const sectionMatch = activeSection === 'all' || t.section === activeSection;
    const searchMatch = searchQuery === '' || t.title.toLowerCase().includes(searchQuery.toLowerCase());
    const assignmentMatch = canManage || myAssignedSections.length === 0 || myAssignedSections.includes(t.section);
    return sectionMatch && searchMatch && assignmentMatch;
  });

  const completedCount = filteredTasks.filter(t => responses[t.id]?.response && responses[t.id]?.response !== '').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Compliance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>IBC, IRB, IACUC and lab materials compliance tracking</p>
        </div>
        {activeTab === 'checklist' && canManage && (
          <button onClick={() => setShowAssignForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
            background: 'var(--purple-primary)', color: 'white', border: 'none',
            borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px'
          }}><Plus size={16} /> Assign Checklist</button>
        )}
        {activeTab === 'studies' && (
          <button onClick={() => { setEditingStudy(null); setStudyForm({ study_name: '', irb_number: '', irb_exception: false, tissues_held: false, ilab_exists: false, ilab_link: '', team_members: [], certificate_expiry: '', notes: '' }); setShowStudyForm(true); }} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
            background: 'var(--purple-primary)', color: 'white', border: 'none',
            borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px'
          }}><Plus size={16} /> Add Study</button>
        )}
      </div>

      {/* Top-level tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '20px', width: 'fit-content' }}>
        {[
          { id: 'checklist', label: 'Compliance Checklist' },
          { id: 'studies', label: 'Studies' },
          { id: 'policies', label: 'Lab Policies' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px 20px',
            background: activeTab === tab.id ? 'var(--purple-primary)' : 'transparent',
            color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
            border: 'none', fontWeight: activeTab === tab.id ? 600 : 400, fontSize: '13px'
          }}>{tab.label}</button>
        ))}
      </div>
       
      {activeTab === 'checklist' && (
        <>
      {/* My assignment banner */}
      {myAssignment && (
        <div style={{
          background: 'var(--purple-faint)', border: '1px solid var(--purple-border)',
          borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={16} color="var(--purple-primary)" />
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--purple-primary)' }}>
                Compliance Checklist Assigned
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                Sections: {myAssignment.sections?.join(', ')} · Due: {myAssignment.cycle_end}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent assignments for PM */}
      {canManage && assignments.length > 0 && (
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>Recent Assignments</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {assignments.slice(0, 5).map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={13} color="var(--text-muted)" />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{a.assignee?.full_name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.sections?.join(', ')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.cycle_start} → {a.cycle_end}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                    background: a.status === 'submitted' ? '#EAF7F0' : '#FEF9E7',
                    color: a.status === 'submitted' ? '#27AE60' : '#F39C12'
                  }}>{a.status === 'submitted' ? 'Completed' : 'Pending'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {submitted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: '#EAF7F0', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '13px', marginBottom: '16px' }}>
          <CheckCircle size={14} /> Checklist submitted! The PM has been notified.
        </div>
      )}

      {/* Section filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveSection('all')} style={{
          padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
          background: activeSection === 'all' ? 'var(--purple-primary)' : 'var(--bg-primary)',
          color: activeSection === 'all' ? 'white' : 'var(--text-secondary)',
          fontWeight: activeSection === 'all' ? 600 : 400, fontSize: '12px'
        }}>All</button>
        {sections.map(section => {
          const colors = SECTION_COLORS[section] || {};
          const count = tasks.filter(t => t.section === section).length;
          return (
            <button key={section} onClick={() => setActiveSection(section)} style={{
              padding: '7px 14px', borderRadius: 'var(--radius-md)',
              border: `1px solid ${activeSection === section ? colors.border : 'var(--border)'}`,
              background: activeSection === section ? colors.bg : 'var(--bg-primary)',
              color: activeSection === section ? colors.text : 'var(--text-secondary)',
              fontWeight: activeSection === section ? 600 : 400, fontSize: '12px',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              {section}
              <span style={{
                background: activeSection === section ? colors.text : 'var(--border)',
                color: activeSection === section ? 'white' : 'var(--text-muted)',
                borderRadius: '10px', padding: '0 6px', fontSize: '10px'
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search compliance items..."
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <CheckCircle size={14} color="var(--success)" />
          {completedCount} / {filteredTasks.length} completed
        </div>
      </div>

      {filteredTasks.length > 0 && (
        <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(completedCount / filteredTasks.length) * 100}%`, background: 'var(--purple-primary)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
        </div>
      )}

      {/* Tasks grouped by section */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          {sections.filter(s => activeSection === 'all' || activeSection === s).map(section => {
            const sectionTasks = filteredTasks.filter(t => t.section === section);
            if (sectionTasks.length === 0) return null;
            const colors = SECTION_COLORS[section] || {};
            return (
              <div key={section} style={{ marginBottom: '24px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', background: colors.bg || 'var(--bg-secondary)',
                  border: `1px solid ${colors.border || 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', marginBottom: '10px'
                }}>
                  <Shield size={14} color={colors.text || 'var(--text-secondary)'} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text || 'var(--text-primary)' }}>{section}</span>
                  <span style={{ fontSize: '11px', color: colors.text, opacity: 0.7 }}>{sectionTasks.length} items</span>
                </div>
                {sectionTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    response={responses[task.id]}
                    onResponse={handleResponse}
                    onPhotoUpload={handlePhotoUpload}
                    canEdit={true}
                    assigneeName={profile?.full_name}
                  />
                ))}
              </div>
            );
          })}

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
        </>
      )}

      {activeTab === 'studies' && (
        <StudiesTab studies={studies} members={members} canManage={canManage}
          showStudyForm={showStudyForm} setShowStudyForm={setShowStudyForm}
          editingStudy={editingStudy} setEditingStudy={setEditingStudy}
          studyForm={studyForm} setStudyForm={setStudyForm}
          onSave={handleSaveStudy} onDelete={handleDeleteStudy} onCertUpload={handleCertUpload}
          userId={userId} fetchStudies={fetchData}
        />
      )}

      {activeTab === 'policies' && (
        <PoliciesTab policies={policies} userId={userId} fetchPolicies={fetchData} />
      )}

      {/* Assign Form Modal */}
      {showAssignForm && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '520px', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Assign Compliance Checklist</h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assign To</label>
              <select value={assignForm.assigned_to} onChange={e => setAssignForm(p => ({ ...p, assigned_to: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                <option value="">Select member...</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sections (leave empty to assign all)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sections.map(section => {
                  const colors = SECTION_COLORS[section] || {};
                  const isSelected = assignForm.sections.includes(section);
                  return (
                    <button key={section} onClick={() => {
                      setAssignForm(p => ({
                        ...p,
                        sections: isSelected ? p.sections.filter(s => s !== section) : [...p.sections, section]
                      }));
                    }} style={{
                      padding: '8px 14px', borderRadius: 'var(--radius-md)', textAlign: 'left',
                      border: `1px solid ${isSelected ? colors.border : 'var(--border)'}`,
                      background: isSelected ? colors.bg : 'transparent',
                      color: isSelected ? colors.text : 'var(--text-secondary)',
                      fontWeight: isSelected ? 600 : 400, fontSize: '13px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                      {section}
                      <span style={{ fontSize: '11px' }}>{tasks.filter(t => t.section === section).length} items</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cycle Start</label>
                <input type="date" value={assignForm.cycle_start} onChange={e => setAssignForm(p => ({ ...p, cycle_start: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cycle End</label>
                <input type="date" value={assignForm.cycle_end} onChange={e => setAssignForm(p => ({ ...p, cycle_end: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAssignForm(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleSendAssignment} disabled={!assignForm.assigned_to} style={{
                padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                background: !assignForm.assigned_to ? 'var(--border)' : 'var(--purple-primary)',
                color: !assignForm.assigned_to ? 'var(--text-muted)' : 'white', fontWeight: 600
              }}>Assign & Notify</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
