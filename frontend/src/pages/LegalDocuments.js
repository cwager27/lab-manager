import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useResizableColumns, ColResizer } from '../lib/useResizableColumns';
import { supabase } from '../lib/supabase';
import {
  Scale, Plus, Search, X, Trash2, Download, Eye, ChevronRight,
  AlertCircle, Copy, Check, ChevronDown, AlertTriangle,
} from 'lucide-react';

// ── Category configuration ──────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  'Research Agreements': {
    color: { bg: '#EBF5FB', text: '#2471A3', border: '#AED6F1' },
    defaultFileTypes: ['MTA', 'DUA', 'CDA', 'NDA', 'Collaboration Agreement', 'Sponsored Research Agreement', 'Consortium Agreement'],
    extraFields: ['agreement_counterparty', 'agreement_date', 'agreement_expiry'],
  },
  'Vendor & Procurement': {
    color: { bg: '#FEF9E7', text: '#B7770D', border: '#FAD7A0' },
    defaultFileTypes: ['Master Service Agreement (MSA)', 'Statement of Work (SOW)', 'Contract', 'Service Agreement', 'Software License'],
    extraFields: ['agreement_counterparty', 'service_description', 'agreement_date', 'agreement_expiry'],
  },
  'Funding': {
    color: { bg: '#EAF7F0', text: '#1E8449', border: '#A9DFBF' },
    defaultFileTypes: ['Award Notice', 'Grant Agreement', 'Subaward', 'Budget Approval', 'Carry Forward Approval', 'No-Cost Extension', 'Prior Approval Letter'],
    extraFields: ['grant_name'],
    groupBy: 'grant_name',
  },
  'Intellectual Property': {
    color: { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
    defaultFileTypes: ['Patent Filing', 'Invention Disclosure', 'Licensing Agreement', 'Material Ownership Agreement'],
    extraFields: ['project_name'],
  },
  'Equipment': {
    color: { bg: '#FDEDEC', text: '#C0392B', border: '#F1948A' },
    defaultFileTypes: ['Purchase Agreement', 'Service Contract', 'Warranty', 'Equipment Insurance', 'Installation Certificate', 'Calibration Certificate'],
    extraFields: ['equipment_name'],
    groupBy: 'equipment_name',
  },
};

const CUSTOM_COLOR = { bg: '#F2F3F4', text: '#5D6D7E', border: '#CCD1D1' };

const FIELD_LABELS = {
  agreement_counterparty: 'Agreement Counterparty',
  agreement_date: 'Date of Agreement',
  agreement_expiry: 'Expiry Date (or "NA")',
  service_description: 'Service Description',
  grant_name: 'Grant',
  project_name: 'Project Name',
  equipment_name: 'Equipment Name',
};

const SETUP_SQL = `-- Run once in the Supabase SQL Editor
DROP TABLE IF EXISTS legal_documents;

CREATE TABLE legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  file_type text NOT NULL,
  notes text,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  agreement_counterparty text,
  agreement_date date,
  agreement_expiry text,
  service_description text,
  grant_name text,
  project_name text,
  equipment_name text,
  uploaded_by uuid,
  uploader_name text,
  date_added timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON legal_documents USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS legal_file_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  UNIQUE(category, name)
);
ALTER TABLE legal_file_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON legal_file_types USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS legal_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);
ALTER TABLE legal_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON legal_categories USING (true) WITH CHECK (true);`;

const STORAGE_BUCKET = 'legal-docs';

// ── Helpers ──────────────────────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function findSimilarNames(input, existing) {
  if (!input.trim()) return [];
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const inp = norm(input);
  return existing.filter(n => {
    const e = norm(n);
    return e !== inp && (e.includes(inp) || inp.includes(e) || levenshtein(e, inp) <= 3);
  });
}

function formatDate(d) {
  if (!d) return '—';
  if (d === 'NA' || d.toUpperCase() === 'NA') return 'No expiry';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isExpiringOrExpired(expiry) {
  if (!expiry || expiry.toUpperCase() === 'NA') return null;
  const d = new Date(expiry);
  const now = new Date();
  if (d < now) return 'expired';
  const days = (d - now) / (1000 * 60 * 60 * 24);
  if (days <= 60) return 'soon';
  return null;
}

function getFileIcon(mime) {
  if (!mime) return '📄';
  if (mime.includes('pdf')) return '📑';
  if (mime.includes('image')) return '🖼';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('excel') || mime.includes('sheet')) return '📊';
  return '📄';
}

// ── File Preview ──────────────────────────────────────────────────────────────

function PreviewPanel({ doc, onClose, onDelete, canManage }) {
  const [url, setUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!doc?.file_path) return;
    supabase.storage.from(STORAGE_BUCKET).createSignedUrl(doc.file_path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }, [doc]);

  async function handleDownload() {
    if (!doc.file_path) return;
    setDownloading(true);
    const { data } = await supabase.storage.from(STORAGE_BUCKET).download(doc.file_path);
    if (data) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(data);
      a.download = doc.file_name || doc.name;
      a.click();
    }
    setDownloading(false);
  }

  const isPDF = doc.mime_type?.includes('pdf');
  const isImage = doc.mime_type?.includes('image');
  const cc = CATEGORY_CONFIG[doc.category]?.color || CUSTOM_COLOR;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex' }} onClick={onClose}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{ width: 600, background: 'var(--bg-primary)', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>{getFileIcon(doc.mime_type)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', wordBreak: 'break-word' }}>{doc.name}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}` }}>{doc.category}</span>
              <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{doc.file_type}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 5, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}><X size={14} /></button>
        </div>

        {/* Meta */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          {[
            ['Date Added', formatDate(doc.date_added)],
            ['File Type', doc.file_type],
            doc.agreement_counterparty && ['Counterparty', doc.agreement_counterparty],
            doc.agreement_date && ['Agreement Date', formatDate(doc.agreement_date)],
            doc.agreement_expiry && ['Expiry', formatDate(doc.agreement_expiry)],
            doc.service_description && ['Service', doc.service_description],
            doc.grant_name && ['Grant', doc.grant_name],
            doc.project_name && ['Project', doc.project_name],
            doc.equipment_name && ['Equipment', doc.equipment_name],
            doc.file_size && ['File Size', formatSize(doc.file_size)],
            doc.uploader_name && ['Added by', doc.uploader_name],
          ].filter(Boolean).map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{value}</div>
            </div>
          ))}
        </div>

        {doc.notes && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Notes</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{doc.notes}</p>
          </div>
        )}

        {/* Preview */}
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!doc.file_path ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No file attached</div>
          ) : !url ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading preview…</div>
          ) : isPDF ? (
            <iframe src={url} title={doc.name} style={{ flex: 1, minHeight: 400, border: '1px solid var(--border)', borderRadius: 8 }} />
          ) : isImage ? (
            <img src={url} alt={doc.name} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40 }}>{getFileIcon(doc.mime_type)}</div>
              <p style={{ fontSize: 13, margin: 0 }}>Preview not available for this file type</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            {doc.file_path && (
              <button onClick={handleDownload} disabled={downloading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                <Download size={13} /> {downloading ? 'Downloading…' : 'Download'}
              </button>
            )}
            {canManage && (
              <button onClick={() => onDelete(doc)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #FADBD8', borderRadius: 6, background: '#FEF0F0', color: 'var(--danger)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Document Form ─────────────────────────────────────────────────────────

function DocForm({ category: defaultCategory, pendingFile, allCategories, customFileTypes, grants, docs, userId, profile, onSave, onClose }) {
  const [form, setForm] = useState({
    name: pendingFile?.name?.replace(/\.[^.]+$/, '') || '',
    category: defaultCategory || Object.keys(CATEGORY_CONFIG)[0],
    file_type: '',
    notes: '',
    agreement_counterparty: '',
    agreement_date: '',
    agreement_expiry: '',
    service_description: '',
    grant_name: '',
    project_name: '',
    equipment_name: '',
  });
  const [file, setFile] = useState(pendingFile || null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [equipmentSuggestions, setEquipmentSuggestions] = useState([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingFileType, setAddingFileType] = useState(false);
  const [newFileTypeName, setNewFileTypeName] = useState('');
  const fileInputRef = useRef();

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const config = CATEGORY_CONFIG[form.category];

  const fileTypeOptions = [
    ...(config?.defaultFileTypes || []),
    ...(customFileTypes.filter(ft => ft.category === form.category).map(ft => ft.name)),
  ];

  const existingEquipmentNames = useMemo(() =>
    [...new Set(docs.filter(d => d.equipment_name).map(d => d.equipment_name))],
    [docs]);

  function handleEquipmentChange(v) {
    set('equipment_name', v);
    if (v.length > 1) setEquipmentSuggestions(findSimilarNames(v, existingEquipmentNames));
    else setEquipmentSuggestions([]);
  }

  function handleFileDrop(e) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); if (!form.name) set('name', f.name.replace(/\.[^.]+$/, '')); }
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.file_type) e.file_type = 'Required';
    if (!form.category) e.category = 'Required';
    if (config) {
      if (config.extraFields.includes('agreement_counterparty') && !form.agreement_counterparty.trim()) e.agreement_counterparty = 'Required';
      if (config.extraFields.includes('agreement_date') && !form.agreement_date) e.agreement_date = 'Required';
      if (config.extraFields.includes('agreement_expiry')) {
        if (!form.agreement_expiry.trim()) e.agreement_expiry = 'Enter a date or "NA"';
        else if (form.agreement_expiry.toUpperCase() !== 'NA' && isNaN(Date.parse(form.agreement_expiry)))
          e.agreement_expiry = 'Enter a valid date or "NA"';
      }
      if (config.extraFields.includes('service_description') && !form.service_description.trim()) e.service_description = 'Required';
      if (config.extraFields.includes('grant_name') && !form.grant_name) e.grant_name = 'Required';
      if (config.extraFields.includes('project_name') && !form.project_name.trim()) e.project_name = 'Required';
      if (config.extraFields.includes('equipment_name') && !form.equipment_name.trim()) e.equipment_name = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    let filePath = null, fileName = null, fileSize = null, mimeType = null;

    if (file) {
      setUploading(true);
      const path = `${form.category}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
      setUploading(false);
      if (!upErr) { filePath = path; fileName = file.name; fileSize = file.size; mimeType = file.type; }
    }

    await onSave({
      ...form,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      agreement_date: form.agreement_date || null,
      uploaded_by: userId,
      uploader_name: profile?.full_name || null,
    });
    setSaving(false);
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    await supabase.from('legal_categories').insert([{ name }]);
    set('category', name);
    setAddingCategory(false);
    setNewCategoryName('');
  }

  async function handleAddFileType() {
    const name = newFileTypeName.trim();
    if (!name) return;
    await supabase.from('legal_file_types').insert([{ category: form.category, name }]);
    set('file_type', name);
    setAddingFileType(false);
    setNewFileTypeName('');
  }

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit' };
  const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const errStyle = { fontSize: 11, color: 'var(--danger)', marginTop: 3 };
  const field = (key, children) => (
    <div style={{ marginBottom: 14 }}>
      <label style={lbl}>{FIELD_LABELS[key] || key} *</label>
      {children}
      {errors[key] && <div style={errStyle}>{errors[key]}</div>}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: 28, width: 600, maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Add Document</h2>
          <button onClick={onClose} style={{ padding: 5, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? 'var(--purple-primary)' : file ? '#A9DFBF' : 'var(--border)'}`, borderRadius: 8, padding: '16px', marginBottom: 18, textAlign: 'center', cursor: 'pointer', background: dragOver ? 'var(--purple-faint)' : file ? '#F0FFF4' : 'var(--bg-secondary)', transition: 'all 0.15s' }}>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) { setFile(f); if (!form.name) set('name', f.name.replace(/\.[^.]+$/, '')); }}} />
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{getFileIcon(file.type)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1E8449' }}>{file.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({formatSize(file.size)})</span>
              <button onClick={e => { e.stopPropagation(); setFile(null); }} style={{ padding: 2, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={12} /></button>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>📂</div>
              Drag & drop a file here, or click to browse
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Document Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} style={{ ...inp, borderColor: errors.name ? 'var(--danger)' : 'var(--border)' }} placeholder="e.g. MSK Material Transfer Agreement 2026" />
          {errors.name && <div style={errStyle}>{errors.name}</div>}
        </div>

        {/* Category */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Category *</label>
          {addingCategory ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} style={inp} placeholder="New category name" autoFocus />
              <button onClick={handleAddCategory} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              <button onClick={() => setAddingCategory(false)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={12} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={form.category} onChange={e => { set('category', e.target.value); set('file_type', ''); }} style={{ ...inp, flex: 1, cursor: 'pointer' }}>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => setAddingCategory(true)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>+ Add</button>
            </div>
          )}
        </div>

        {/* File Type */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>File Type *</label>
          {addingFileType ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newFileTypeName} onChange={e => setNewFileTypeName(e.target.value)} style={inp} placeholder="New file type name" autoFocus />
              <button onClick={handleAddFileType} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              <button onClick={() => setAddingFileType(false)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={12} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={form.file_type} onChange={e => set('file_type', e.target.value)} style={{ ...inp, flex: 1, cursor: 'pointer', borderColor: errors.file_type ? 'var(--danger)' : 'var(--border)' }}>
                <option value="">Select file type…</option>
                {fileTypeOptions.map(ft => <option key={ft} value={ft}>{ft}</option>)}
              </select>
              <button onClick={() => setAddingFileType(true)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>+ Add</button>
            </div>
          )}
          {errors.file_type && <div style={errStyle}>{errors.file_type}</div>}
        </div>

        {/* Category-specific fields */}
        {config?.extraFields.includes('agreement_counterparty') && field('agreement_counterparty',
          <input value={form.agreement_counterparty} onChange={e => set('agreement_counterparty', e.target.value)} style={{ ...inp, borderColor: errors.agreement_counterparty ? 'var(--danger)' : 'var(--border)' }} placeholder="e.g. Memorial Sloan Kettering Cancer Center" />
        )}

        {config?.extraFields.includes('service_description') && field('service_description',
          <input value={form.service_description} onChange={e => set('service_description', e.target.value)} style={{ ...inp, borderColor: errors.service_description ? 'var(--danger)' : 'var(--border)' }} placeholder="Brief description of service" />
        )}

        {config?.extraFields.includes('agreement_date') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Date of Agreement *</label>
              <input type="date" value={form.agreement_date} onChange={e => set('agreement_date', e.target.value)} style={{ ...inp, borderColor: errors.agreement_date ? 'var(--danger)' : 'var(--border)' }} />
              {errors.agreement_date && <div style={errStyle}>{errors.agreement_date}</div>}
            </div>
            <div>
              <label style={lbl}>Expiry Date (or "NA") *</label>
              <input value={form.agreement_expiry} onChange={e => set('agreement_expiry', e.target.value)} style={{ ...inp, borderColor: errors.agreement_expiry ? 'var(--danger)' : 'var(--border)' }} placeholder='e.g. 2027-12-31 or NA' />
              {errors.agreement_expiry && <div style={errStyle}>{errors.agreement_expiry}</div>}
            </div>
          </div>
        )}

        {config?.extraFields.includes('grant_name') && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Grant *</label>
            <select value={form.grant_name} onChange={e => set('grant_name', e.target.value)} style={{ ...inp, cursor: 'pointer', borderColor: errors.grant_name ? 'var(--danger)' : 'var(--border)' }}>
              <option value="">Select grant…</option>
              {grants.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
            {errors.grant_name && <div style={errStyle}>{errors.grant_name}</div>}
          </div>
        )}

        {config?.extraFields.includes('project_name') && field('project_name',
          <input value={form.project_name} onChange={e => set('project_name', e.target.value)} style={{ ...inp, borderColor: errors.project_name ? 'var(--danger)' : 'var(--border)' }} placeholder="Project name" />
        )}

        {config?.extraFields.includes('equipment_name') && (
          <div style={{ marginBottom: 14, position: 'relative' }}>
            <label style={lbl}>Equipment Name *</label>
            <input value={form.equipment_name} onChange={e => handleEquipmentChange(e.target.value)} style={{ ...inp, borderColor: errors.equipment_name ? 'var(--danger)' : 'var(--border)' }} placeholder="e.g. Zeiss LSM 900 Confocal" />
            {errors.equipment_name && <div style={errStyle}>{errors.equipment_name}</div>}
            {equipmentSuggestions.length > 0 && (
              <div style={{ marginTop: 6, padding: '10px 12px', background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#B7770D', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={11} /> Similar equipment already exists — check before adding:
                </div>
                {equipmentSuggestions.map(s => (
                  <button key={s} onClick={() => { set('equipment_name', s); setEquipmentSuggestions([]); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', marginBottom: 2, borderRadius: 4, border: '1px solid #FAD7A0', background: 'white', color: '#B7770D', fontSize: 12, cursor: 'pointer' }}>
                    Use "{s}"
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes (optional) */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} placeholder="Any additional notes…" />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : saving ? 'Saving…' : 'Add Document'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── File row ──────────────────────────────────────────────────────────────────

function FileRow({ doc, onPreview, onDelete, canManage, odd }) {
  const cc = CATEGORY_CONFIG[doc.category]?.color || CUSTOM_COLOR;
  const expStatus = isExpiringOrExpired(doc.agreement_expiry);

  return (
    <tr onClick={() => onPreview(doc)} style={{ background: odd ? 'var(--bg-secondary)' : 'var(--bg-card)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--purple-faint)'}
      onMouseLeave={e => e.currentTarget.style.background = odd ? 'var(--bg-secondary)' : 'var(--bg-card)'}>
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{getFileIcon(doc.mime_type)}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{doc.name}</span>
        </div>
      </td>
      <td style={{ padding: '10px 14px' }}>
        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}`, whiteSpace: 'nowrap' }}>{doc.file_type}</span>
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(doc.date_added)}</td>
      <td style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>
        {doc.agreement_counterparty || doc.grant_name || doc.project_name || doc.equipment_name
          ? <span style={{ color: 'var(--text-secondary)' }}>{doc.agreement_counterparty || doc.grant_name || doc.project_name || doc.equipment_name}</span>
          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>
        {doc.agreement_expiry ? (
          <span style={{ color: expStatus === 'expired' ? 'var(--danger)' : expStatus === 'soon' ? '#B7770D' : 'var(--text-muted)', fontWeight: expStatus ? 700 : 400 }}>
            {expStatus === 'expired' && '⚠ '}{expStatus === 'soon' && '⚠ '}{formatDate(doc.agreement_expiry)}
          </span>
        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </td>
      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onPreview(doc)} style={{ padding: 5, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer' }}><Eye size={12} /></button>
          {canManage && <button onClick={() => onDelete(doc)} style={{ padding: 5, borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={12} /></button>}
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LegalDocuments({ userRole, userId, profile }) {
  const { widths: searchDocWidths, onColMouseDown: searchDocResize } = useResizableColumns(6);
  const canManage = userRole === 'admin' || userRole === 'pm';

  const [docs, setDocs] = useState([]);
  const [grants, setGrants] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [customFileTypes, setCustomFileTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  const [showSetupSQL, setShowSetupSQL] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);

  // Navigation: [] = home, ['Cat'] = category, ['Cat', 'Sub'] = subfolder
  const [path, setPath] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [globalDragOver, setGlobalDragOver] = useState(false);
  const [showDeleteCat, setShowDeleteCat] = useState(null);

  const currentCategory = path[0];
  const currentSubfolder = path[1];
  const config = currentCategory ? CATEGORY_CONFIG[currentCategory] : null;

  async function fetchAll() {
    setLoading(true);
    const [docsRes, grRes, catRes, ftRes] = await Promise.all([
      supabase.from('legal_documents').select('*').order('date_added', { ascending: false }),
      supabase.from('grants').select('id, name').order('name'),
      supabase.from('legal_categories').select('*').order('name'),
      supabase.from('legal_file_types').select('*').order('name'),
    ]);
    if (docsRes.error) {
      if (docsRes.error.message?.includes("doesn't exist") || docsRes.error.code === 'PGRST204') setTableError(true);
      setLoading(false);
      return;
    }
    setTableError(false);
    setDocs(docsRes.data || []);
    setGrants(grRes.data || []);
    setCustomCategories(catRes.data || []);
    setCustomFileTypes(ftRes.data || []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  const allCategories = useMemo(() => [
    ...Object.keys(CATEGORY_CONFIG),
    ...customCategories.map(c => c.name).filter(n => !CATEGORY_CONFIG[n]),
  ], [customCategories]);

  // Files visible in current view
  const visibleDocs = useMemo(() => {
    let list = docs;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.file_type?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q) ||
        d.agreement_counterparty?.toLowerCase().includes(q) ||
        d.grant_name?.toLowerCase().includes(q) ||
        d.project_name?.toLowerCase().includes(q) ||
        d.equipment_name?.toLowerCase().includes(q) ||
        d.notes?.toLowerCase().includes(q)
      );
      return list;
    }
    if (currentCategory) list = list.filter(d => d.category === currentCategory);
    if (currentSubfolder && config?.groupBy) list = list.filter(d => d[config.groupBy] === currentSubfolder);
    return list;
  }, [docs, currentCategory, currentSubfolder, config, search]);

  // Subfolders (for Funding / Equipment)
  const subfolders = useMemo(() => {
    if (!config?.groupBy || currentSubfolder) return null;
    const catDocs = docs.filter(d => d.category === currentCategory);
    const groups = {};
    catDocs.forEach(d => {
      const key = d[config.groupBy];
      if (key) groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [docs, currentCategory, config, currentSubfolder]);

  // Category doc counts
  const catCounts = useMemo(() => {
    const m = {};
    docs.forEach(d => { m[d.category] = (m[d.category] || 0) + 1; });
    return m;
  }, [docs]);

  async function handleSave(form) {
    const payload = {
      name: form.name.trim(),
      category: form.category,
      file_type: form.file_type,
      notes: form.notes || null,
      file_path: form.file_path || null,
      file_name: form.file_name || null,
      file_size: form.file_size || null,
      mime_type: form.mime_type || null,
      agreement_counterparty: form.agreement_counterparty || null,
      agreement_date: form.agreement_date || null,
      agreement_expiry: form.agreement_expiry || null,
      service_description: form.service_description || null,
      grant_name: form.grant_name || null,
      project_name: form.project_name || null,
      equipment_name: form.equipment_name || null,
      uploaded_by: form.uploaded_by,
      uploader_name: form.uploader_name,
      date_added: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await supabase.from('legal_documents').insert([payload]);
    setShowForm(false);
    setPendingFile(null);
    fetchAll();
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    if (doc.file_path) await supabase.storage.from(STORAGE_BUCKET).remove([doc.file_path]);
    await supabase.from('legal_documents').delete().eq('id', doc.id);
    setPreviewDoc(null);
    fetchAll();
  }

  async function handleDeleteCategory(name) {
    const custom = customCategories.find(c => c.name === name);
    if (!custom) return;
    await supabase.from('legal_categories').delete().eq('id', custom.id);
    setShowDeleteCat(null);
    fetchAll();
  }

  // Global drag-over for the whole page → open form with file
  const handleGlobalDrop = useCallback((e) => {
    e.preventDefault();
    setGlobalDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setPendingFile(f); setShowForm(true); }
  }, []);

  const expiringSoon = docs.filter(d => isExpiringOrExpired(d.agreement_expiry) !== null);

  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setGlobalDragOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setGlobalDragOver(false); }}
      onDrop={handleGlobalDrop}
      style={{ minHeight: '60vh', position: 'relative' }}>

      {/* Global drag overlay */}
      {globalDragOver && !showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(103,68,187,0.12)', border: '3px dashed var(--purple-primary)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', color: 'var(--purple-primary)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Drop to add document</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Scale size={20} color="var(--purple-primary)" />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Legal Documents</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Drag & drop files anywhere, or click "Add Document"</p>
        </div>
        {canManage && (
          <button onClick={() => { setPendingFile(null); setShowForm(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
            <Plus size={16} /> Add Document
          </button>
        )}
      </div>

      {/* Setup banner */}
      {tableError && (
        <div style={{ marginBottom: 20, padding: '16px 20px', background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#B7770D' }}>One-time database setup required</span>
            <button onClick={() => setShowSetupSQL(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#B7770D', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {showSetupSQL ? 'Hide' : 'Show'} SQL <ChevronDown size={13} style={{ transform: showSetupSQL ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#7D6608', margin: '0 0 6px' }}>1. Run the SQL below in your Supabase SQL Editor.</p>
          <p style={{ fontSize: 12, color: '#7D6608', margin: 0 }}>2. Create a Storage bucket named <code>legal-docs</code> (private) in the Supabase Dashboard → Storage.</p>
          {showSetupSQL && (
            <div style={{ marginTop: 12, position: 'relative' }}>
              <pre style={{ margin: 0, padding: '14px 16px', background: '#1E1E2E', color: '#CDD6F4', fontSize: 11, lineHeight: 1.65, borderRadius: 8, overflowX: 'auto', fontFamily: "'Fira Code','Consolas',monospace" }}>{SETUP_SQL}</pre>
              <button onClick={async () => { await navigator.clipboard.writeText(SETUP_SQL); setCopiedSQL(true); setTimeout(() => setCopiedSQL(false), 2000); }}
                style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.1)', color: copiedSQL ? '#A6E3A1' : '#A6ADC8', fontSize: 11, cursor: 'pointer' }}>
                {copiedSQL ? <Check size={11} /> : <Copy size={11} />} {copiedSQL ? 'Copied!' : 'Copy SQL'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Expiry alert */}
      {expiringSoon.length > 0 && !search && (
        <div style={{ marginBottom: 18, padding: '10px 16px', background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} color="#B7770D" />
          <span style={{ fontSize: 13, color: '#B7770D' }}>
            <strong>{expiringSoon.length} document{expiringSoon.length > 1 ? 's' : ''}</strong> expiring soon or expired: {expiringSoon.map(d => d.name).join(', ')}
          </span>
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: 20 }}>
        <Search size={13} color="var(--text-muted)" />
        <input value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) setPath([]); }} placeholder="Search across all documents…"
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'transparent', color: 'var(--text-primary)' }} />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><X size={13} /></button>}
      </div>

      {/* Breadcrumb */}
      {(path.length > 0 || search) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13 }}>
          <button onClick={() => { setPath([]); setSearch(''); }} style={{ color: 'var(--purple-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>All Categories</button>
          {path.map((p, i) => [
            <ChevronRight key={p + 'c'} size={13} color="var(--text-muted)" />,
            <button key={p} onClick={() => setPath(path.slice(0, i + 1))} style={{ color: i === path.length - 1 ? 'var(--text-primary)' : 'var(--purple-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: i === path.length - 1 ? 700 : 400, padding: 0 }}>{p}</button>,
          ])}
          {search && [<ChevronRight key="sc" size={13} color="var(--text-muted)" />, <span key="s" style={{ color: 'var(--text-muted)' }}>Search: "{search}"</span>]}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>
      ) : tableError ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
          Complete the one-time setup above, then refresh.
        </div>
      ) : search ? (
        /* Search results — flat file list */
        visibleDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>No documents match your search.</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-card)' }}>
            <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>{searchDocWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['Document', 'Type', 'Date Added', 'Key Info', 'Expiry', ''].map((h, i) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', ...labelStyle, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', position: 'relative' }}>{h}<ColResizer colIdx={i} totalCols={6} onColMouseDown={searchDocResize} /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleDocs.map((doc, i) => <FileRow key={doc.id} doc={doc} odd={i % 2 !== 0} onPreview={setPreviewDoc} onDelete={handleDelete} canManage={canManage} />)}
              </tbody>
            </table>
          </div>
        )
      ) : path.length === 0 ? (
        /* Home — category folders */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {allCategories.map(name => {
            const cc = CATEGORY_CONFIG[name]?.color || CUSTOM_COLOR;
            const count = catCounts[name] || 0;
            const isCustom = !CATEGORY_CONFIG[name];
            return (
              <div key={name} style={{ position: 'relative' }}>
                <button onClick={() => setPath([name])}
                  style={{ width: '100%', textAlign: 'left', padding: '20px', background: 'var(--bg-card)', border: `1px solid ${cc.border}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s', boxShadow: 'var(--shadow-sm)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = cc.bg; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: cc.text, marginBottom: 4, lineHeight: 1.3 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count} {count === 1 ? 'document' : 'documents'}</div>
                </button>
                {isCustom && canManage && (
                  <button onClick={() => setShowDeleteCat(name)}
                    style={{ position: 'absolute', top: 8, right: 8, padding: 4, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.7 }}
                    title="Delete category">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : subfolders && !currentSubfolder ? (
        /* Subfolder view (Funding by grant, Equipment by equipment name) */
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            {subfolders.map(([name, count]) => {
              const cc = config?.color || CUSTOM_COLOR;
              return (
                <button key={name} onClick={() => setPath([currentCategory, name])}
                  style={{ textAlign: 'left', padding: '16px', background: 'var(--bg-card)', border: `1px solid ${cc.border}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = cc.bg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: cc.text, marginBottom: 2 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{count} file{count !== 1 ? 's' : ''}</div>
                </button>
              );
            })}
            {/* Unfiled */}
            {(() => {
              const unfiled = docs.filter(d => d.category === currentCategory && !d[config.groupBy]);
              if (!unfiled.length) return null;
              return (
                <button onClick={() => setPath([currentCategory, '__unfiled__'])}
                  style={{ textAlign: 'left', padding: '16px', background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>Unfiled</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unfiled.length} file{unfiled.length !== 1 ? 's' : ''}</div>
                </button>
              );
            })()}
          </div>
          {/* Also show all category files in a table below */}
          {visibleDocs.length > 0 && <DocTable docs={visibleDocs} onPreview={setPreviewDoc} onDelete={handleDelete} canManage={canManage} />}
        </div>
      ) : (
        /* File list within a category / subfolder */
        visibleDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            No documents yet — drag & drop a file or click "Add Document"
          </div>
        ) : (
          <DocTable docs={visibleDocs} onPreview={setPreviewDoc} onDelete={handleDelete} canManage={canManage} />
        )
      )}

      {/* Delete category confirm */}
      {showDeleteCat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: 28, width: 380, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>Delete category "{showDeleteCat}"?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
              {catCounts[showDeleteCat] ? `This category has ${catCounts[showDeleteCat]} document(s). Those documents will remain but will need to be reassigned.` : 'This category is empty.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteCat(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDeleteCategory(showDeleteCat)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--danger)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <DocForm
          category={currentCategory}
          pendingFile={pendingFile}
          allCategories={allCategories}
          customFileTypes={customFileTypes}
          grants={grants}
          docs={docs}
          userId={userId}
          profile={profile}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setPendingFile(null); }}
        />
      )}

      {previewDoc && (
        <PreviewPanel
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onDelete={handleDelete}
          canManage={canManage}
        />
      )}
    </div>
  );
}

function DocTable({ docs, onPreview, onDelete, canManage }) {
  const { widths: docWidths, onColMouseDown: docResize } = useResizableColumns(6);
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' };
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-card)' }}>
      <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>{docWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)' }}>
            {['Document', 'File Type', 'Date Added', 'Key Info', 'Expiry', ''].map((h, i) => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', ...labelStyle, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', position: 'relative' }}>{h}<ColResizer colIdx={i} totalCols={6} onColMouseDown={docResize} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map((doc, i) => <FileRow key={doc.id} doc={doc} odd={i % 2 !== 0} onPreview={onPreview} onDelete={onDelete} canManage={canManage} />)}
        </tbody>
      </table>
    </div>
  );
}
