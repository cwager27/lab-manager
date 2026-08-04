import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Search, Copy, Check, Edit2, Trash2, X, ChevronDown,
} from 'lucide-react';

const CATEGORIES = ['All', 'R', 'Python', 'Shell', 'Bioinformatics', 'HPC', 'Software', 'General'];

const CAT_COLORS = {
  R:              { bg: '#EBF5FB', text: '#2471A3', border: '#AED6F1' },
  Python:         { bg: '#EAF7F0', text: '#1E8449', border: '#A9DFBF' },
  Shell:          { bg: '#FEF9E7', text: '#B7770D', border: '#FAD7A0' },
  Bioinformatics: { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  HPC:            { bg: '#FDEDEC', text: '#C0392B', border: '#F1948A' },
  Software:       { bg: '#F2F3F4', text: '#5D6D7E', border: '#CCD1D1' },
  General:        { bg: '#FDEBD0', text: '#C0392B', border: '#F0B27A' },
};

const LANG_LABELS = {
  r: 'R', python: 'Python', bash: 'Shell', shell: 'Shell',
  sql: 'SQL', perl: 'Perl', nextflow: 'Nextflow', snakemake: 'Snakemake',
  other: 'Code',
};

const EMPTY_FORM = {
  title: '', body: '', code_snippet: '', code_language: 'bash',
  category: 'General', tags: '', status: 'published',
};

const SETUP_SQL = `-- Run this once in the Supabase SQL Editor
CREATE TABLE IF NOT EXISTS computational_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  code_snippet text,
  code_language text DEFAULT 'bash',
  category text NOT NULL DEFAULT 'General',
  tags text,
  status text NOT NULL DEFAULT 'published',
  submitted_by uuid,
  submitter_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE computational_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON computational_tips USING (true) WITH CHECK (true);`;

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: copied ? '#27AE60' : 'var(--text-muted)', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function TipCard({ tip, canManage, userId, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const cc = CAT_COLORS[tip.category] || CAT_COLORS.General;
  const tags = (tip.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const hasCode = !!tip.code_snippet?.trim();
  const bodyPreview = (tip.body || '').length > 180 && !expanded
    ? tip.body.slice(0, 180) + '…'
    : tip.body;
  const isOwner = tip.submitted_by === userId;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
      {/* Header row */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}` }}>
              {tip.category}
            </span>
            {tags.map(tag => (
              <span key={tag} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                {tag}
              </span>
            ))}
            {tip.status === 'pending' && (
              <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: '#FEF9E7', color: '#F39C12', border: '1px solid #FAD7A0' }}>Pending review</span>
            )}
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{tip.title}</h3>
        </div>
        {(canManage || isOwner) && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {canManage && <button onClick={() => onEdit(tip)} style={{ padding: 5, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={13} /></button>}
            {(canManage || isOwner) && <button onClick={() => onDelete(tip)} style={{ padding: 5, borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={13} /></button>}
          </div>
        )}
      </div>

      {/* Body */}
      {tip.body && (
        <div style={{ padding: '0 16px 10px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {bodyPreview}
          {(tip.body || '').length > 180 && (
            <button onClick={() => setExpanded(e => !e)}
              style={{ marginLeft: 6, fontSize: 11, color: 'var(--purple-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Code snippet */}
      {hasCode && (
        <div style={{ margin: '0 16px 12px', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#1E1E2E', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#A6ADC8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {LANG_LABELS[tip.code_language] || 'Code'}
            </span>
            <CopyButton text={tip.code_snippet} />
          </div>
          <pre style={{ margin: 0, padding: '14px 16px', background: '#1E1E2E', color: '#CDD6F4', fontSize: 12, lineHeight: 1.65, overflowX: 'auto', fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace", whiteSpace: 'pre' }}>
            {tip.code_snippet}
          </pre>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '8px 16px 12px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{tip.submitter_name || 'Lab member'} · {new Date(tip.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
    </div>
  );
}

function TipForm({ initial, canManage, profile, onSave, onClose }) {
  const [form, setForm] = useState(initial || { ...EMPTY_FORM, status: canManage ? 'published' : 'pending' });
  const [saving, setSaving] = useState(false); // eslint-disable-line no-unused-vars
  const isEdit = !!initial?.id;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const inpStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: 28, width: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{isEdit ? 'Edit Tip' : 'Add Tip'}</h2>
          <button onClick={onClose} style={{ padding: 5, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} style={inpStyle} placeholder="e.g. Fast subsetting with data.table" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={{ ...inpStyle, cursor: 'pointer' }}>
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tags (comma-separated)</label>
            <input value={form.tags} onChange={e => set('tags', e.target.value)} style={inpStyle} placeholder="e.g. tidyverse, ggplot, loops" />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Description / Explanation</label>
          <textarea value={form.body} onChange={e => set('body', e.target.value)} rows={4}
            style={{ ...inpStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder="Explain the tip, when to use it, and any caveats…" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Code Snippet (optional)</label>
            <select value={form.code_language} onChange={e => set('code_language', e.target.value)}
              style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', outline: 'none' }}>
              {Object.entries(LANG_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <textarea value={form.code_snippet} onChange={e => set('code_snippet', e.target.value)} rows={6}
            style={{ ...inpStyle, resize: 'vertical', fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 12, lineHeight: 1.65, background: '#1E1E2E', color: '#CDD6F4', border: '1px solid #313244' }} placeholder="# paste code here…" />
        </div>

        {canManage && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...inpStyle, cursor: 'pointer' }}>
              <option value="published">Published</option>
              <option value="pending">Pending review</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        )}

        {!canManage && !isEdit && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 8, fontSize: 12, color: '#B7770D' }}>
            Your tip will be submitted for review before being published.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.title.trim()}
            style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: form.title.trim() ? 'var(--purple-primary)' : 'var(--border)', color: form.title.trim() ? 'white' : 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: form.title.trim() ? 'pointer' : 'default' }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : canManage ? 'Publish Tip' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ComputationalTips({ userRole, userId, profile }) {
  const canManage = userRole === 'admin' || userRole === 'pm';

  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  const [activeCategory, setActiveCategory] = useState(() => localStorage.getItem('tips_category') || 'All');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTip, setEditingTip] = useState(null);
  const [showSetupSQL, setShowSetupSQL] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);

  async function fetchTips() {
    setLoading(true);
    const { data, error } = await supabase
      .from('computational_tips')
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
    setTips(data || []);
    setLoading(false);
  }

  useEffect(() => { localStorage.setItem('tips_category', activeCategory); }, [activeCategory]);
  useEffect(() => { fetchTips(); }, []);

  const catCounts = useMemo(() => {
    const base = canManage ? tips : tips.filter(t => t.status === 'published' || t.submitted_by === userId);
    const map = {};
    base.forEach(t => { map[t.category] = (map[t.category] || 0) + 1; });
    map['All'] = base.length;
    return map;
  }, [tips, canManage, userId]);

  const filtered = useMemo(() => {
    let list = tips;
    if (!canManage) list = list.filter(t => t.status === 'published' || t.submitted_by === userId);
    if (activeCategory !== 'All') list = list.filter(t => t.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.body?.toLowerCase().includes(q) ||
        t.tags?.toLowerCase().includes(q) ||
        t.code_snippet?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tips, activeCategory, search, canManage, userId]);



  const pendingCount = tips.filter(t => t.status === 'pending').length;

  async function handleSave(form) {
    const payload = {
      title: form.title.trim(),
      body: form.body?.trim() || null,
      code_snippet: form.code_snippet?.trim() || null,
      code_language: form.code_language || 'bash',
      category: form.category,
      tags: form.tags?.trim() || null,
      status: form.status,
      submitted_by: userId,
      submitter_name: profile?.full_name || null,
      updated_at: new Date().toISOString(),
    };

    if (editingTip) {
      await supabase.from('computational_tips').update(payload).eq('id', editingTip.id);
    } else {
      await supabase.from('computational_tips').insert([{ ...payload, created_at: new Date().toISOString() }]);
    }

    setShowForm(false);
    setEditingTip(null);
    fetchTips();
  }

  async function handleDelete(tip) {
    const label = tip.submitted_by === userId && !canManage ? 'Remove your tip?' : `Delete "${tip.title}"?`;
    if (!window.confirm(label)) return;
    await supabase.from('computational_tips').delete().eq('id', tip.id);
    fetchTips();
  }

  function openEdit(tip) {
    setEditingTip(tip);
    setShowForm(true);
  }

  function openNew() {
    setEditingTip(null);
    setShowForm(true);
  }

  return (
    <div>
      {/* Header row: category tabs + action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat;
            const count = catCounts[cat] || 0;
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                padding: '7px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: `1px solid ${active ? 'var(--purple-border)' : 'var(--border)'}`,
                background: active ? 'var(--purple-primary)' : 'var(--bg-primary)',
                color: active ? 'white' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400, fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {cat}
                <span style={{
                  background: active ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                  color: active ? 'white' : 'var(--text-muted)',
                  borderRadius: 10, padding: '0 6px', fontSize: 10,
                }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {canManage && pendingCount > 0 && (
            <button onClick={() => setActiveCategory('All')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid #FAD7A0', background: '#FEF9E7', color: '#B7770D', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {pendingCount} pending review
            </button>
          )}
          <button onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={16} /> {canManage ? 'Add Tip' : 'Submit Tip'}
          </button>
        </div>
      </div>

      {/* Table setup banner */}
      {tableError && (
        <div style={{ marginBottom: 20, padding: '16px 20px', background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#B7770D' }}>One-time setup required</span>
            <button onClick={() => setShowSetupSQL(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#B7770D', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {showSetupSQL ? 'Hide' : 'Show'} SQL <ChevronDown size={13} style={{ transform: showSetupSQL ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#7D6608', margin: 0 }}>Run the SQL below once in your Supabase SQL Editor to create the <code>computational_tips</code> table, then refresh.</p>
          {showSetupSQL && (
            <div style={{ marginTop: 12 }}>
              <div style={{ position: 'relative' }}>
                <pre style={{ margin: 0, padding: '14px 16px', background: '#1E1E2E', color: '#CDD6F4', fontSize: 12, lineHeight: 1.65, borderRadius: 8, overflowX: 'auto', fontFamily: "'Fira Code', 'Consolas', monospace" }}>
                  {SETUP_SQL}
                </pre>
                <button onClick={async () => { await navigator.clipboard.writeText(SETUP_SQL); setCopiedSQL(true); setTimeout(() => setCopiedSQL(false), 2000); }}
                  style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.1)', color: copiedSQL ? '#A6E3A1' : '#A6ADC8', fontSize: 11, cursor: 'pointer' }}>
                  {copiedSQL ? <Check size={11} /> : <Copy size={11} />} {copiedSQL ? 'Copied!' : 'Copy SQL'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}



      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: 20 }}>
        <Search size={14} color="var(--text-muted)" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tips, code, tags…"
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'transparent', color: 'var(--text-primary)' }} />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><X size={13} /></button>}
      </div>


      {/* HPC Reference PDF */}
      {activeCategory === 'All' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>BigPurple HPC — Tips &amp; Tricks</h2>
            <a href="/BigPurple_HPC_Tips_and_Tricks.pdf" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--purple-primary)', textDecoration: 'none' }}>
              Open PDF ↗
            </a>
          </div>
          <iframe
            src="/BigPurple_HPC_Tips_and_Tricks.pdf"
            title="BigPurple HPC Tips and Tricks"
            style={{ width: '100%', height: 720, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>
      ) : tableError ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
          Complete the one-time setup above, then refresh the page.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          {search ? 'No tips match your search.' : 'No tips yet — be the first to add one!'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
          {filtered.map(tip => (
            <TipCard
              key={tip.id}
              tip={tip}
              canManage={canManage}
              userId={userId}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <TipForm
          initial={editingTip}
          canManage={canManage}
          profile={profile}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingTip(null); }}
        />
      )}
    </div>
  );
}
