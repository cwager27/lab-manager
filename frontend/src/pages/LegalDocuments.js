import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Search, X, Edit2, Trash2, ExternalLink, Copy, Check,
  Scale, ChevronDown, AlertCircle,
} from 'lucide-react';

const CATEGORIES = ['All', 'MTA', 'NDA', 'IRB', 'IBC', 'Contract', 'Grant Agreement', 'Data Use Agreement', 'Employment', 'Other'];

const CAT_COLORS = {
  MTA:                  { bg: '#EBF5FB', text: '#2471A3', border: '#AED6F1' },
  NDA:                  { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  IRB:                  { bg: '#EAF7F0', text: '#1E8449', border: '#A9DFBF' },
  IBC:                  { bg: '#FDEDEC', text: '#C0392B', border: '#F1948A' },
  Contract:             { bg: '#FEF9E7', text: '#B7770D', border: '#FAD7A0' },
  'Grant Agreement':    { bg: '#FDEBD0', text: '#C0392B', border: '#F0B27A' },
  'Data Use Agreement': { bg: '#F2F3F4', text: '#5D6D7E', border: '#CCD1D1' },
  Employment:           { bg: '#EBF5FB', text: '#1A5276', border: '#AED6F1' },
  Other:                { bg: '#F2F3F4', text: '#5D6D7E', border: '#CCD1D1' },
};

const STATUS_STYLES = {
  active:   { bg: '#EAF7F0', text: '#1E8449', border: '#A9DFBF', label: 'Active' },
  pending:  { bg: '#FEF9E7', text: '#B7770D', border: '#FAD7A0', label: 'Pending' },
  expired:  { bg: '#FDEDEC', text: '#C0392B', border: '#F1948A', label: 'Expired' },
  archived: { bg: '#F2F3F4', text: '#5D6D7E', border: '#CCD1D1', label: 'Archived' },
};

const EMPTY_FORM = {
  title: '', category: 'MTA', description: '', file_url: '',
  file_name: '', status: 'active', parties: '',
  effective_date: '', expiry_date: '', notes: '',
};

const SETUP_SQL = `-- Run once in the Supabase SQL Editor
CREATE TABLE IF NOT EXISTS legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  description text,
  file_url text,
  file_name text,
  status text NOT NULL DEFAULT 'active',
  parties text,
  effective_date date,
  expiry_date date,
  notes text,
  uploaded_by uuid,
  uploader_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON legal_documents USING (true) WITH CHECK (true);`;

function isExpiringSoon(dateStr) {
  if (!dateStr) return false;
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 60;
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DocForm({ initial, canManage, profile, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...EMPTY_FORM, ...initial } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const inpStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit' };

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: 28, width: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{isEdit ? 'Edit Document' : 'Add Document'}</h2>
          <button onClick={onClose} style={{ padding: 5, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} style={inpStyle} placeholder="e.g. MTA with Memorial Sloan Kettering" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={{ ...inpStyle, cursor: 'pointer' }}>
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...inpStyle, cursor: 'pointer' }}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Parties Involved</label>
          <input value={form.parties} onChange={e => set('parties', e.target.value)} style={inpStyle} placeholder="e.g. NYU Langone, Memorial Sloan Kettering" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Effective Date</label>
            <input type="date" value={form.effective_date} onChange={e => set('effective_date', e.target.value)} style={inpStyle} />
          </div>
          <div>
            <label style={labelStyle}>Expiry Date</label>
            <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} style={inpStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
            style={{ ...inpStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder="Brief description of this document…" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>File URL (link to document)</label>
            <input value={form.file_url} onChange={e => set('file_url', e.target.value)} style={inpStyle} placeholder="https://…" />
          </div>
          <div>
            <label style={labelStyle}>File Name (display label)</label>
            <input value={form.file_name} onChange={e => set('file_name', e.target.value)} style={inpStyle} placeholder="e.g. MSK_MTA_2026.pdf" />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            style={{ ...inpStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder="Any additional notes…" />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()}
            style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: form.title.trim() ? 'var(--purple-primary)' : 'var(--border)', color: form.title.trim() ? 'white' : 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: form.title.trim() ? 'pointer' : 'default' }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Document'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LegalDocuments({ userRole, userId, profile }) {
  const canManage = userRole === 'admin' || userRole === 'pm';

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [showSetupSQL, setShowSetupSQL] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  async function fetchDocs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes("doesn't exist") || error.message?.includes('schema cache')) {
        setTableError(true);
      }
      setLoading(false);
      return;
    }
    setTableError(false);
    setDocs(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchDocs(); }, []);

  const filtered = useMemo(() => {
    let list = docs;
    if (activeCategory !== 'All') list = list.filter(d => d.category === activeCategory);
    if (activeStatus !== 'All') list = list.filter(d => d.status === activeStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.title?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.parties?.toLowerCase().includes(q) ||
        d.notes?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [docs, activeCategory, activeStatus, search]);

  const catCounts = useMemo(() => {
    const map = { All: docs.length };
    docs.forEach(d => { map[d.category] = (map[d.category] || 0) + 1; });
    return map;
  }, [docs]);

  const expiringSoon = docs.filter(d => d.status === 'active' && isExpiringSoon(d.expiry_date));

  async function handleSave(form) {
    const payload = {
      title: form.title.trim(),
      category: form.category,
      description: form.description?.trim() || null,
      file_url: form.file_url?.trim() || null,
      file_name: form.file_name?.trim() || null,
      status: form.status,
      parties: form.parties?.trim() || null,
      effective_date: form.effective_date || null,
      expiry_date: form.expiry_date || null,
      notes: form.notes?.trim() || null,
      uploaded_by: userId,
      uploader_name: profile?.full_name || null,
      updated_at: new Date().toISOString(),
    };
    if (editingDoc) {
      await supabase.from('legal_documents').update(payload).eq('id', editingDoc.id);
    } else {
      await supabase.from('legal_documents').insert([{ ...payload, created_at: new Date().toISOString() }]);
    }
    setShowForm(false);
    setEditingDoc(null);
    fetchDocs();
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    await supabase.from('legal_documents').delete().eq('id', doc.id);
    fetchDocs();
  }

  function openEdit(doc) { setEditingDoc(doc); setShowForm(true); }
  function openNew() { setEditingDoc(null); setShowForm(true); }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Scale size={20} color="var(--purple-primary)" />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Legal Documents</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>MTAs, NDAs, IRB/IBC approvals, contracts, and agreements</p>
        </div>
        {canManage && (
          <button onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
            <Plus size={16} /> Add Document
          </button>
        )}
      </div>

      {/* Setup banner */}
      {tableError && (
        <div style={{ marginBottom: 20, padding: '16px 20px', background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#B7770D' }}>One-time setup required</span>
            <button onClick={() => setShowSetupSQL(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#B7770D', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {showSetupSQL ? 'Hide' : 'Show'} SQL <ChevronDown size={13} style={{ transform: showSetupSQL ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#7D6608', margin: 0 }}>Run the SQL below once in your Supabase SQL Editor to create the <code>legal_documents</code> table, then refresh.</p>
          {showSetupSQL && (
            <div style={{ marginTop: 12, position: 'relative' }}>
              <pre style={{ margin: 0, padding: '14px 16px', background: '#1E1E2E', color: '#CDD6F4', fontSize: 12, lineHeight: 1.65, borderRadius: 8, overflowX: 'auto', fontFamily: "'Fira Code', 'Consolas', monospace" }}>
                {SETUP_SQL}
              </pre>
              <button onClick={async () => { await navigator.clipboard.writeText(SETUP_SQL); setCopiedSQL(true); setTimeout(() => setCopiedSQL(false), 2000); }}
                style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.1)', color: copiedSQL ? '#A6E3A1' : '#A6ADC8', fontSize: 11, cursor: 'pointer' }}>
                {copiedSQL ? <Check size={11} /> : <Copy size={11} />} {copiedSQL ? 'Copied!' : 'Copy SQL'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Expiring soon alert */}
      {expiringSoon.length > 0 && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={15} color="#B7770D" />
          <span style={{ fontSize: 13, color: '#B7770D' }}>
            <strong>{expiringSoon.length} document{expiringSoon.length > 1 ? 's' : ''}</strong> expiring within 60 days: {expiringSoon.map(d => d.title).join(', ')}
          </span>
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => {
          const cc = cat === 'All' ? null : CAT_COLORS[cat];
          const count = catCounts[cat] || 0;
          const active = activeCategory === cat;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: '6px 13px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
              border: `1px solid ${active && cc ? cc.border : active ? 'var(--purple-primary)' : 'var(--border)'}`,
              background: active ? (cc ? cc.bg : 'var(--purple-faint)') : 'var(--bg-primary)',
              color: active ? (cc ? cc.text : 'var(--purple-primary)') : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {cat}
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: active ? (cc ? cc.text : 'var(--purple-primary)') : 'var(--border)', color: active ? 'white' : 'var(--text-muted)' }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status filter + Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['All', 'active', 'pending', 'expired', 'archived'].map(s => {
            const ss = s === 'All' ? null : STATUS_STYLES[s];
            const active = activeStatus === s;
            return (
              <button key={s} onClick={() => setActiveStatus(s)} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
                border: `1px solid ${active && ss ? ss.border : active ? 'var(--purple-primary)' : 'var(--border)'}`,
                background: active ? (ss ? ss.bg : 'var(--purple-faint)') : 'var(--bg-primary)',
                color: active ? (ss ? ss.text : 'var(--purple-primary)') : 'var(--text-secondary)',
              }}>
                {ss ? ss.label : 'All statuses'}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '7px 12px' }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents, parties…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'transparent', color: 'var(--text-primary)' }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><X size={13} /></button>}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>
      ) : tableError ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
          Complete the one-time setup above, then refresh the page.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          {search ? 'No documents match your search.' : 'No documents yet — add the first one.'}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-card)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {['Document', 'Category', 'Parties', 'Effective', 'Expires', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc, i) => {
                const cc = CAT_COLORS[doc.category] || CAT_COLORS.Other;
                const ss = STATUS_STYLES[doc.status] || STATUS_STYLES.active;
                const expWarn = doc.status === 'active' && isExpiringSoon(doc.expiry_date);
                const expPast = isExpired(doc.expiry_date) && doc.status === 'active';
                const expanded = expandedId === doc.id;

                return [
                  <tr key={doc.id} onClick={() => setExpandedId(expanded ? null : doc.id)}
                    style={{ background: expanded ? 'var(--purple-faint)' : i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)', cursor: 'pointer', borderBottom: expanded ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', maxWidth: 260 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{doc.title}</div>
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, color: 'var(--purple-primary)', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                          <ExternalLink size={10} /> {doc.file_name || 'View file'}
                        </a>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}`, whiteSpace: 'nowrap' }}>{doc.category}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.parties || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(doc.effective_date)}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 12, color: expPast ? '#C0392B' : expWarn ? '#B7770D' : 'var(--text-muted)', fontWeight: (expWarn || expPast) ? 700 : 400 }}>
                        {expWarn && '⚠ '}{formatDate(doc.expiry_date)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: ss.bg, color: ss.text, border: `1px solid ${ss.border}`, whiteSpace: 'nowrap' }}>{ss.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {canManage && (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => openEdit(doc)} style={{ padding: 5, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={12} /></button>
                          <button onClick={() => handleDelete(doc)} style={{ padding: 5, borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={12} /></button>
                        </div>
                      )}
                    </td>
                  </tr>,
                  expanded && (
                    <tr key={doc.id + '_exp'} style={{ background: 'var(--purple-faint)', borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={7} style={{ padding: '12px 14px 16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                          {doc.description && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Description</div>
                              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{doc.description}</p>
                            </div>
                          )}
                          {doc.notes && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Notes</div>
                              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{doc.notes}</p>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Added by</div>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{doc.uploader_name || 'Lab member'} · {formatDate(doc.created_at)}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <DocForm
          initial={editingDoc}
          canManage={canManage}
          profile={profile}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingDoc(null); }}
        />
      )}
    </div>
  );
}
