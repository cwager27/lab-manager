import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Upload, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const CATEGORIES = ['General', 'Benchling', 'IBC', 'IACUC', 'Human Studies', 'Safety', 'Other'];

const EMPTY_FORM = {
  title: '', category: 'General', description: '',
  content: '', review_date: '', file_url: '', file_name: ''
};

export default function PoliciesTab({ policies, userId, fetchPolicies }) {
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState(null);
  const [editingContentId, setEditingContentId] = useState(null);
  const [contentDraft, setContentDraft] = useState('');
  const [, setUploadingFile] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    if (editingPolicy) {
      await supabase.from('lab_policies').update({ ...form, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', editingPolicy.id);
    } else {
      await supabase.from('lab_policies').insert([{ ...form, created_by: userId, updated_by: userId }]);
    }
    setShowForm(false);
    setEditingPolicy(null);
    setForm(EMPTY_FORM);
    setSaving(false);
    fetchPolicies();
  }

  async function handleDelete(id) {
    if (window.confirm('Delete this policy?')) {
      await supabase.from('lab_policies').delete().eq('id', id);
      fetchPolicies();
    }
  }

  async function handleSaveContent(policyId) {
    await supabase.from('lab_policies').update({ content: contentDraft, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', policyId);
    setEditingContentId(null);
    fetchPolicies();
  }

  async function handleFileUpload(policyId, file) {
    if (!file) return;
    setUploadingFile(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `policy-files/${policyId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('lab-files').upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
      await supabase.from('lab_policies').update({ file_url: urlData.publicUrl, file_name: file.name, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', policyId);
      fetchPolicies();
    }
    setUploadingFile(false);
  }

  const groupedPolicies = CATEGORIES.reduce((acc, cat) => {
    const catPolicies = policies.filter(p => p.category === cat);
    if (catPolicies.length > 0) acc[cat] = catPolicies;
    return acc;
  }, {});

  const uncategorized = policies.filter(p => !CATEGORIES.includes(p.category));
  if (uncategorized.length > 0) groupedPolicies['Other'] = [...(groupedPolicies['Other'] || []), ...uncategorized];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button onClick={() => { setEditingPolicy(null); setForm(EMPTY_FORM); setShowForm(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px' }}>
          <Plus size={16} /> Add Policy
        </button>
      </div>

      {policies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          No policies added yet. Click Add Policy to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(groupedPolicies).map(([category, catPolicies]) => (
            <div key={category}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--purple-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', paddingBottom: '6px', borderBottom: '2px solid var(--purple-border)' }}>{category}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {catPolicies.map(policy => {
                  const isExpanded = expandedId === policy.id;
                  const isEditingContent = editingContentId === policy.id;
                  const today = new Date();
                  const reviewDate = policy.review_date ? new Date(policy.review_date) : null;
                  const daysLeft = reviewDate ? Math.ceil((reviewDate - today) / (1000 * 60 * 60 * 24)) : null;
                  const isOverdue = daysLeft !== null && daysLeft < 0;
                  const isDueSoon = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0;

                  return (
                    <div key={policy.id} style={{ background: 'var(--bg-card)', border: `1px solid ${isOverdue ? '#FADBD8' : isDueSoon ? '#FAD7A0' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{policy.title}</h4>
                            {isOverdue && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#FDEDEC', color: '#E74C3C' }}>Review Overdue</span>}
                            {isDueSoon && !isOverdue && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#FEF9E7', color: '#F39C12' }}>Review Due Soon</span>}
                          </div>
                          {policy.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 4px' }}>{policy.description}</p>}
                          {policy.review_date && <p style={{ fontSize: '11px', color: isOverdue ? '#E74C3C' : isDueSoon ? '#F39C12' : 'var(--text-muted)', margin: 0 }}>Review date: {policy.review_date}</p>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                          {policy.file_url && (
                            <a href={policy.file_url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--purple-primary)', display: 'flex', alignItems: 'center' }}>
                              <FileText size={14} />
                            </a>
                          )}
                          <label style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Upload document">
                            <Upload size={14} />
                            <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => handleFileUpload(policy.id, e.target.files[0])} />
                          </label>
                          <button onClick={() => { setEditingPolicy(policy); setForm({ title: policy.title, category: policy.category || 'General', description: policy.description || '', content: policy.content || '', review_date: policy.review_date || '', file_url: policy.file_url || '', file_name: policy.file_name || '' }); setShowForm(true); }}
                            style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(policy.id)}
                            style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
                          <button onClick={() => { setExpandedId(isExpanded ? null : policy.id); if (!isExpanded) { setContentDraft(policy.content || ''); setEditingContentId(null); } }}
                            style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: isExpanded ? 'var(--purple-faint)' : 'var(--bg-primary)', color: isExpanded ? 'var(--purple-primary)' : 'var(--text-muted)' }}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '16px', background: 'var(--bg-secondary)' }}>
                          {isEditingContent ? (
                            <div>
                              <textarea value={contentDraft} onChange={e => setContentDraft(e.target.value)}
                                rows={10} placeholder="Write policy content here..."
                                style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <button onClick={() => handleSaveContent(policy.id)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '12px', fontWeight: 600 }}>Save</button>
                                <button onClick={() => setEditingContentId(null)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px' }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {policy.content ? (
                                <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '12px' }}>{policy.content}</div>
                              ) : (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '12px' }}>No content added yet.</p>
                              )}
                              <button onClick={() => { setEditingContentId(policy.id); setContentDraft(policy.content || ''); }}
                                style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                {policy.content ? 'Edit Content' : 'Add Content'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '500px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>{editingPolicy ? 'Edit Policy' : 'Add Policy'}</h2>
            {[
              { label: 'Title', key: 'title', required: true },
              { label: 'Description', key: 'description' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}{field.required ? ' *' : ''}</label>
                <input value={form[field.key]} onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Review Date</label>
              <input type="date" value={form.review_date} onChange={e => setForm(p => ({ ...p, review_date: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditingPolicy(null); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleSave} disabled={!form.title || saving} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: !form.title ? 'var(--border)' : 'var(--purple-primary)', color: !form.title ? 'var(--text-muted)' : 'white', fontWeight: 600 }}>
                {saving ? 'Saving...' : 'Save Policy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
