import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Upload, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const SOP_CATEGORIES = ['Cell Culture', 'Equipment', 'Sample Handling', 'Safety', 'Administrative', 'Data Management', 'Other'];
const STATUS_STYLES = {
  active:         { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  archived:       { bg: 'var(--bg-secondary)', text: 'var(--text-muted)', border: 'var(--border)' },
  'under review': { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
};

const EMPTY_FORM = {
  title: '', sop_number: '', category: 'Cell Culture', version: 'v1.0',
  description: '', content: '', effective_date: '', review_date: '',
  file_url: '', file_name: '', benchling_url: '', status: 'active',
};

export default function SOPsTab({ sops, userId, fetchSOPs, canManage }) {
  const [showForm, setShowForm] = useState(false);
  const [editingSOP, setEditingSOP] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState(null);
  const [editingContentId, setEditingContentId] = useState(null);
  const [contentDraft, setContentDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const setF = patch => setForm(p => ({ ...p, ...patch }));

  async function handleSave() {
    setSaving(true);
    const payload = { ...form, updated_by: userId, updated_at: new Date().toISOString() };
    if (editingSOP) {
      await supabase.from('lab_sops').update(payload).eq('id', editingSOP.id);
    } else {
      await supabase.from('lab_sops').insert([{ ...payload, created_by: userId }]);
    }
    setShowForm(false);
    setEditingSOP(null);
    setForm(EMPTY_FORM);
    setSaving(false);
    fetchSOPs();
  }

  async function handleDelete(id) {
    if (window.confirm('Delete this SOP?')) {
      await supabase.from('lab_sops').delete().eq('id', id);
      fetchSOPs();
    }
  }

  async function handleSaveContent(id) {
    await supabase.from('lab_sops').update({ content: contentDraft, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', id);
    setEditingContentId(null);
    fetchSOPs();
  }

  async function handleFileUpload(id, file) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `sop-files/${id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('lab-files').upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
      await supabase.from('lab_sops').update({ file_url: urlData.publicUrl, file_name: file.name, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', id);
      fetchSOPs();
    }
  }

  const grouped = SOP_CATEGORIES.reduce((acc, cat) => {
    const items = sops.filter(s => s.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  const other = sops.filter(s => !SOP_CATEGORIES.includes(s.category));
  if (other.length > 0) grouped['Other'] = [...(grouped['Other'] || []), ...other];

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)' };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div>
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => { setEditingSOP(null); setForm(EMPTY_FORM); setShowForm(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={16} /> Add SOP
          </button>
        </div>
      )}

      {sops.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          No SOPs added yet.{canManage ? ' Click Add SOP to get started.' : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid var(--purple-border)', margin: '0 0 10px' }}>{category}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(sop => {
                  const isExpanded = expandedId === sop.id;
                  const isEditingContent = editingContentId === sop.id;
                  const today = new Date();
                  const reviewDate = sop.review_date ? new Date(sop.review_date) : null;
                  const daysLeft = reviewDate ? Math.ceil((reviewDate - today) / (1000 * 60 * 60 * 24)) : null;
                  const isOverdue = daysLeft !== null && daysLeft < 0;
                  const isDueSoon = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0;
                  const statusStyle = STATUS_STYLES[sop.status] || STATUS_STYLES.active;

                  return (
                    <div key={sop.id} style={{ background: 'var(--bg-card)', border: `1px solid ${isOverdue ? '#FADBD8' : isDueSoon ? '#FAD7A0' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            {sop.sop_number && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{sop.sop_number}</span>
                            )}
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{sop.title}</span>
                            {sop.version && (
                              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{sop.version}</span>
                            )}
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 10, background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                              {sop.status || 'active'}
                            </span>
                            {isOverdue && <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#FDEDEC', color: '#E74C3C' }}>Review Overdue</span>}
                            {isDueSoon && !isOverdue && <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#FEF9E7', color: '#F39C12' }}>Review Due Soon</span>}
                          </div>
                          {sop.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 4px' }}>{sop.description}</p>}
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {sop.effective_date && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Effective: {sop.effective_date}</span>}
                            {sop.review_date && <span style={{ fontSize: 11, color: isOverdue ? '#E74C3C' : isDueSoon ? '#F39C12' : 'var(--text-muted)' }}>Review: {sop.review_date}</span>}
                            {sop.benchling_url && <a href={sop.benchling_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#27AE60', fontWeight: 500 }}>📗 Benchling</a>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                          {sop.file_url && (
                            <a href={sop.file_url} target="_blank" rel="noopener noreferrer" style={{ padding: 6, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--purple-primary)', display: 'flex', alignItems: 'center' }}>
                              <FileText size={14} />
                            </a>
                          )}
                          {canManage && (
                            <>
                              <label style={{ padding: 6, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Upload document">
                                <Upload size={14} />
                                <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => handleFileUpload(sop.id, e.target.files[0])} />
                              </label>
                              <button onClick={() => { setEditingSOP(sop); setForm({ title: sop.title, sop_number: sop.sop_number || '', category: sop.category || 'Cell Culture', version: sop.version || 'v1.0', description: sop.description || '', content: sop.content || '', effective_date: sop.effective_date || '', review_date: sop.review_date || '', file_url: sop.file_url || '', file_name: sop.file_name || '', benchling_url: sop.benchling_url || '', status: sop.status || 'active' }); setShowForm(true); }}
                                style={{ padding: 6, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDelete(sop.id)}
                                style={{ padding: 6, borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          <button onClick={() => { setExpandedId(isExpanded ? null : sop.id); if (!isExpanded) { setContentDraft(sop.content || ''); setEditingContentId(null); } }}
                            style={{ padding: 6, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: isExpanded ? 'var(--purple-faint)' : 'var(--bg-primary)', color: isExpanded ? 'var(--purple-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: 16, background: 'var(--bg-secondary)' }}>
                          {isEditingContent ? (
                            <div>
                              <textarea value={contentDraft} onChange={e => setContentDraft(e.target.value)}
                                rows={10} placeholder="Write SOP content here..."
                                style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />
                              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <button onClick={() => handleSaveContent(sop.id)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditingContentId(null)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {sop.content
                                ? <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 12 }}>{sop.content}</div>
                                : <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 12 }}>No content added yet.</p>
                              }
                              {canManage && (
                                <button onClick={() => { setEditingContentId(sop.id); setContentDraft(sop.content || ''); }}
                                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                                  {sop.content ? 'Edit Content' : 'Add Content'}
                                </button>
                              )}
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
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: 32, width: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, margin: '0 0 20px' }}>{editingSOP ? 'Edit SOP' : 'Add SOP'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input value={form.title} onChange={e => setF({ title: e.target.value })} style={inputStyle} placeholder="e.g. Cell Counting Protocol" />
              </div>
              <div>
                <label style={labelStyle}>SOP Number</label>
                <input value={form.sop_number} onChange={e => setF({ sop_number: e.target.value })} style={inputStyle} placeholder="e.g. SOP-001" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={form.category} onChange={e => setF({ category: e.target.value })} style={inputStyle}>
                  {SOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Version</label>
                <input value={form.version} onChange={e => setF({ version: e.target.value })} style={inputStyle} placeholder="e.g. v1.0" />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Description</label>
              <input value={form.description} onChange={e => setF({ description: e.target.value })} style={inputStyle} placeholder="Brief summary of this SOP" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Effective Date</label>
                <input type="date" value={form.effective_date} onChange={e => setF({ effective_date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Review Date</label>
                <input type="date" value={form.review_date} onChange={e => setF({ review_date: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e => setF({ status: e.target.value })} style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="under review">Under Review</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Benchling URL</label>
                <input value={form.benchling_url} onChange={e => setF({ benchling_url: e.target.value })} style={inputStyle} placeholder="https://benchling.com/..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => { setShowForm(false); setEditingSOP(null); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={!form.title || saving} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: !form.title ? 'var(--border)' : 'var(--purple-primary)', color: !form.title ? 'var(--text-muted)' : 'white', fontWeight: 600, cursor: !form.title ? 'default' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save SOP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
