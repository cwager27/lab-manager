import { useState, useEffect } from 'react';
import { useResizableColumns, ColResizer } from '../lib/useResizableColumns';
import { supabase } from '../lib/supabase';
import {
  Plus, Search,
  AlertTriangle, Edit2, Trash2, RefreshCw, ExternalLink
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_STYLES = {
  present: { bg: '#EAF7F0', text: '#27AE60', label: 'Present' },
  absent: { bg: '#FDEDEC', text: '#E74C3C', label: 'Absent' },
  depleted: { bg: '#F2F3F4', text: '#9A9AB0', label: 'Depleted' },
};

const EMPTY_CELL_LINE = {
  name: '', cell_type: '', passage_number: '', storage_location: '',
  freezer: '', shelf: '', box: '', status: 'present', notes: '', benchling_url: ''
};

const EMPTY_MOUSE = {
  sample_id: '', mouse_id: '', tissue_type: '', collection_date: '',
  storage_location: '', freezer: '', shelf: '', box: '',
  study: '', irb_protocol: '', status: 'present', notes: ''
};

const EMPTY_HUMAN = {
  sample_id: '', patient_id: '', tissue_type: '', collection_date: '',
  storage_location: '', freezer: '', shelf: '', box: '',
  study: '', irb_protocol: '', status: 'present', notes: ''
};

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '28px', width: '400px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <AlertTriangle size={20} color="#F39C12" />
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Confirm Action</h3>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600 }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

function SampleForm({ title, fields, form, setForm, onSubmit, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '560px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>{title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          {fields.map(field => (
            <div key={field.key} style={{ gridColumn: field.full ? '1 / -1' : 'auto' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {field.label}{field.required ? '' : ' (optional)'}
              </label>
              {field.type === 'select' ? (
                <select value={form[field.key] || ''} onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input type={field.type || 'text'} value={form[field.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
          <button onClick={onSubmit} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Benchling Tab ───────────────────────────────────────────────────────────

const SEQUENCING_KEYS = ['sequencing_status', 'sequencing_date', 'sequencing_method',
  'library_preparation', 'failure_reason', 'date_sequenced', 'seq_status', 'library'];

function getFieldVal(fields, key) {
  if (!fields) return null;
  const entry = fields[key];
  if (!entry) return null;
  return entry.displayValue ?? entry.value ?? null;
}

function findSeqFields(fields) {
  if (!fields) return {};
  return Object.fromEntries(
    Object.entries(fields).filter(([k]) =>
      SEQUENCING_KEYS.some(sk => k.toLowerCase().includes(sk.replace(/_/g, '')))
    ).map(([k, v]) => [k, v.displayValue ?? v.value ?? ''])
  );
}

function BenchlingEntityCard({ entity }) {
  const [expanded, setExpanded] = useState(false);
  const allFields = entity.fields || {};
  const seqFields = findSeqFields(allFields);
  const tissue = getFieldVal(allFields, 'tissue_type') || getFieldVal(allFields, 'tissue');
  const hasSeq = Object.keys(seqFields).length > 0;

  const fieldLabel = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{entity.name}</span>
            {entity.registry_id && (
              <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--purple-faint)', color: 'var(--purple-primary)', padding: '1px 7px', borderRadius: 8 }}>{entity.registry_id}</span>
            )}
            {entity.schema_name && (
              <span style={{ fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text-muted)', padding: '1px 7px', borderRadius: 8, border: '1px solid var(--border)' }}>{entity.schema_name}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
            {tissue && <span>Tissue: <strong style={{ color: 'var(--text-secondary)' }}>{tissue}</strong></span>}
            {hasSeq && Object.entries(seqFields).map(([k, v]) => (
              <span key={k}>{fieldLabel(k)}: <strong style={{ color: 'var(--text-secondary)' }}>{v || '—'}</strong></span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          {entity.web_url && (
            <a href={entity.web_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#27AE60', textDecoration: 'none', padding: '4px 8px', border: '1px solid #A9DFBF', borderRadius: 6, background: '#EAF7F0' }}>
              <ExternalLink size={11} /> Benchling
            </a>
          )}
          <button onClick={() => setExpanded(e => !e)}
            style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
            {expanded ? 'Hide fields' : 'All fields'}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px 16px' }}>
          {Object.entries(allFields).map(([k, v]) => {
            const val = v.displayValue ?? v.value ?? '';
            return (
              <div key={k} style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{fieldLabel(k)}:</span>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>{val !== null && val !== '' ? String(val) : '—'}</span>
              </div>
            );
          })}
          {Object.keys(allFields).length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No custom fields</span>
          )}
        </div>
      )}
    </div>
  );
}

function BenchlingTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [schemaFilter, setSchemaFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('registry_entity');
  const [search, setSearch] = useState('');
  const [lastSynced, setLastSynced] = useState(null);

  useEffect(() => { loadCache(); }, []);

  async function loadCache() {
    setLoading(true);
    const res = await fetch(`${API}/api/benchling/cache`);
    const json = await res.json();
    setData(json.data || []);
    const newest = (json.data || []).reduce((acc, d) => (!acc || d.synced_at > acc) ? d.synced_at : acc, null);
    setLastSynced(newest);
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch(`${API}/api/benchling/sync`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sync failed');
      setSyncResult(json);
      await loadCache();
    } catch (err) {
      setSyncError(err.message);
    }
    setSyncing(false);
  }

  const schemas = ['all', ...Array.from(new Set(data.filter(d => d.entity_type === typeFilter).map(d => d.schema_name).filter(Boolean))).sort()];

  const filtered = data.filter(d => {
    if (d.entity_type !== typeFilter) return false;
    if (schemaFilter !== 'all' && d.schema_name !== schemaFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (d.name || '').toLowerCase().includes(q) ||
        (d.registry_id || '').toLowerCase().includes(q) ||
        JSON.stringify(d.fields || {}).toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Data synced from Benchling Registries and ELN. Click Refresh to pull the latest.
          </p>
          {lastSynced && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Last synced: {new Date(lastSynced).toLocaleString()}
            </p>
          )}
        </div>
        <button onClick={handleSync} disabled={syncing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: syncing ? 'var(--border)' : 'var(--purple-primary)', color: syncing ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 13, cursor: syncing ? 'default' : 'pointer', flexShrink: 0 }}>
          <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Refreshing…' : 'Refresh from Benchling'}
        </button>
      </div>

      {syncResult && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#EAF7F0', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-md)', fontSize: 13, color: '#1E8449' }}>
          Synced {syncResult.entities} registry entities and {syncResult.entries} ELN entries.
        </div>
      )}
      {syncError && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FDEDEC', border: '1px solid #F1948A', borderRadius: 'var(--radius-md)', fontSize: 13, color: '#C0392B' }}>
          {syncError}
        </div>
      )}

      {/* Type toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[{ id: 'registry_entity', label: 'Registry Entities' }, { id: 'eln_entry', label: 'ELN Entries' }].map(t => (
          <button key={t.id} onClick={() => { setTypeFilter(t.id); setSchemaFilter('all'); }}
            style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: 12, fontWeight: typeFilter === t.id ? 700 : 400, background: typeFilter === t.id ? 'var(--purple-primary)' : 'var(--bg-primary)', color: typeFilter === t.id ? 'white' : 'var(--text-secondary)', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Schema filter pills */}
      {schemas.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {schemas.map(s => (
            <button key={s} onClick={() => setSchemaFilter(s)}
              style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12, fontWeight: schemaFilter === s ? 700 : 400, background: schemaFilter === s ? 'var(--purple-faint)' : 'var(--bg-primary)', color: schemaFilter === s ? 'var(--purple-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
              {s === 'all' ? 'All schemas' : s}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: 16 }}>
        <Search size={14} color="var(--text-muted)" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, registry ID, or any field…"
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'transparent', color: 'var(--text-primary)' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading cached data…</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          No Benchling data cached yet. Click <strong>Refresh from Benchling</strong> to sync.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No results match your filters.</div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{filtered.length} {typeFilter === 'registry_entity' ? 'entities' : 'entries'}</p>
          {filtered.map(entity => <BenchlingEntityCard key={entity.id} entity={entity} />)}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sequencing Records Tab ──────────────────────────────────────────────────

const QC_STYLES = {
  Pass:    { bg: '#EAF7F0', text: '#1E8449', border: '#A9DFBF' },
  Fail:    { bg: '#FDEDEC', text: '#C0392B', border: '#F1948A' },
  Pending: { bg: '#FEF9E7', text: '#B7950B', border: '#F9E79F' },
};

function QCBadge({ status }) {
  const s = QC_STYLES[status] || { bg: 'var(--bg-secondary)', text: 'var(--text-muted)', border: 'var(--border)' };
  return (
    <span style={{ padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {status || 'Pending'}
    </span>
  );
}

function SequencingTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [qcFilter, setQcFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/benchling/sequencing`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows(json.rows || []);
      setFetchedAt(json.fetchedAt || null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  const counts = { all: rows.length, Pass: 0, Fail: 0, Pending: 0 };
  for (const r of rows) {
    if (r.qcStatus === 'Pass') counts.Pass++;
    else if (r.qcStatus === 'Fail') counts.Fail++;
    else counts.Pending++;
  }

  const filtered = rows.filter(r => {
    if (qcFilter !== 'all') {
      const status = r.qcStatus || 'Pending';
      if (status !== qcFilter) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return [r.name, r.sampleName, r.subject, r.project, r.strategy, r.location, r.creator, r.assay]
        .some(v => (v || '').toLowerCase().includes(q));
    }
    return true;
  });

  const thSt = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' };
  const tdSt = { padding: '10px 12px', fontSize: 13, borderTop: '1px solid var(--border)', verticalAlign: 'middle' };
  const muted = { color: 'var(--text-muted)' };

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* QC filter tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'all',     label: `All (${counts.all})` },
            { id: 'Pass',    label: `Pass (${counts.Pass})` },
            { id: 'Fail',    label: `Fail (${counts.Fail})` },
            { id: 'Pending', label: `Pending (${counts.Pending})` },
          ].map(f => (
            <button key={f.id} onClick={() => setQcFilter(f.id)} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              fontSize: 12, fontWeight: qcFilter === f.id ? 700 : 400, cursor: 'pointer',
              background: qcFilter === f.id ? 'var(--purple-primary)' : 'transparent',
              color: qcFilter === f.id ? 'white' : 'var(--text-secondary)',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '7px 12px' }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search libraries, samples, strategy…"
              style={{ border: 'none', outline: 'none', fontSize: 12, background: 'transparent', color: 'var(--text-primary)', width: 220 }} />
          </div>
          {/* Refresh */}
          <button onClick={loadData} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            background: loading ? 'var(--border)' : 'var(--purple-primary)',
            color: loading ? 'var(--text-muted)' : 'white',
            border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 12, cursor: loading ? 'default' : 'pointer',
          }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FDEDEC', border: '1px solid #F1948A', borderRadius: 'var(--radius-md)', fontSize: 13, color: '#C0392B' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Fetching sequencing records from Benchling…</div>
      ) : (
        <>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={thSt}>Library</th>
                  <th style={thSt}>QC</th>
                  <th style={thSt}>Coverage</th>
                  <th style={thSt}>Strategy</th>
                  <th style={thSt}>Location</th>
                  <th style={thSt}>Sample</th>
                  <th style={thSt}>Subject / Project</th>
                  <th style={thSt}>Tissue</th>
                  <th style={thSt}>Requested By</th>
                  <th style={thSt}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ ...tdSt, textAlign: 'center', color: 'var(--text-muted)', padding: '32px 12px' }}>
                      No records match your filters.
                    </td>
                  </tr>
                ) : filtered.map(r => (
                  <tr key={r.id} style={{ background: r.qcStatus === 'Fail' ? '#FEF9F9' : 'transparent' }}>
                    {/* Library */}
                    <td style={{ ...tdSt, fontWeight: 600 }}>
                      {r.webURL ? (
                        <a href={r.webURL} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--purple-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {r.name}
                          <ExternalLink size={11} />
                        </a>
                      ) : r.name}
                    </td>
                    {/* QC */}
                    <td style={tdSt}><QCBadge status={r.qcStatus} /></td>
                    {/* Coverage */}
                    <td style={{ ...tdSt, ...muted }}>{r.coverage || '—'}</td>
                    {/* Strategy */}
                    <td style={{ ...tdSt, ...muted }}>{r.strategy || '—'}</td>
                    {/* Location */}
                    <td style={{ ...tdSt, ...muted }}>{r.location || '—'}</td>
                    {/* Sample */}
                    <td style={{ ...tdSt, fontSize: 12 }}>
                      {r.sampleName ? (
                        r.sampleWebURL ? (
                          <a href={r.sampleWebURL} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                            {r.sampleName} <ExternalLink size={10} />
                          </a>
                        ) : r.sampleName
                      ) : r.assay ? (
                        <span style={{ color: 'var(--text-secondary)' }}>{r.assay}</span>
                      ) : <span style={muted}>—</span>}
                    </td>
                    {/* Subject / Project */}
                    <td style={{ ...tdSt, fontSize: 12 }}>
                      {r.subject || r.project ? (
                        <div>
                          {r.subject && <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.subject}</div>}
                          {r.project && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.project}</div>}
                        </div>
                      ) : <span style={muted}>—</span>}
                    </td>
                    {/* Tissue */}
                    <td style={{ ...tdSt, fontSize: 12 }}>
                      {r.tissueType ? (
                        <div>
                          <div style={{ color: 'var(--text-secondary)' }}>{r.tissueType}</div>
                          {r.tissueState && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.tissueState}</div>}
                        </div>
                      ) : <span style={muted}>—</span>}
                    </td>
                    {/* Requested By */}
                    <td style={{ ...tdSt, fontSize: 12, color: 'var(--text-secondary)' }}>{r.creator || '—'}</td>
                    {/* Date */}
                    <td style={{ ...tdSt, fontSize: 12, ...muted, whiteSpace: 'nowrap' }}>
                      {r.sampleDate || (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
            {filtered.length} of {rows.length} records
            {fetchedAt && ` · fetched ${new Date(fetchedAt).toLocaleTimeString()}`}
          </p>
        </>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SampleInventory({ userRole, userId, profile }) {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('inventory_tab') || 'cell_lines');
  const [cellLines, setCellLines] = useState([]);
  const [mouseSamples, setMouseSamples] = useState([]);
  const [humanSamples, setHumanSamples] = useState([]);
  const [sharedReagents, setSharedReagents] = useState([]);
  const [showReagentForm, setShowReagentForm] = useState(false);
  const [editingReagent, setEditingReagent] = useState(null);
  const [reagentForm, setReagentForm] = useState({ name: '', category: '', location: '', quantity: '', status: 'in_stock', notes: '' });
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({});
  const [confirmModal, setConfirmModal] = useState(null);
  const [takingCellLine, setTakingCellLine] = useState(null);
  const [vialsTaken, setVialsTaken] = useState(1);

  useEffect(() => { localStorage.setItem('inventory_tab', activeTab); }, [activeTab]);
  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: cl }, { data: ms }, { data: hs }, { data: al }, { data: sr }] = await Promise.all([
      supabase.from('cell_lines').select('*, taken_by_profile:profiles!cell_lines_taken_by_fkey(full_name)').order('name'),
      supabase.from('mouse_samples').select('*').order('created_at', { ascending: false }),
      supabase.from('human_samples').select('*').order('created_at', { ascending: false }),
      supabase.from('sample_audit_log').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('shared_reagents').select('*, updater:profiles!shared_reagents_updated_by_fkey(full_name)').order('category').order('name')
    ]);
    setCellLines(cl || []);
    setMouseSamples(ms || []);
    setHumanSamples(hs || []);
    setAuditLog(al || []);
    setSharedReagents(sr || []);
    setLoading(false);
  }

  async function handleSaveReagent() {
    if (editingReagent) {
      await supabase.from('shared_reagents').update({ ...reagentForm, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', editingReagent.id);
    } else {
      await supabase.from('shared_reagents').insert([{ ...reagentForm, updated_by: userId }]);
    }
    setShowReagentForm(false);
    setEditingReagent(null);
    setReagentForm({ name: '', category: '', location: '', quantity: '', status: 'in_stock', notes: '' });
    fetchData();
  }

  async function handleDeleteReagent(id) {
    if (window.confirm('Remove this reagent?')) {
      await supabase.from('shared_reagents').delete().eq('id', id);
      fetchData();
    }
  }

  async function logAction(sampleType, sampleId, sampleName, action, changes) {
    await supabase.from('sample_audit_log').insert([{
      sample_type: sampleType,
      sample_id: sampleId,
      sample_name: sampleName,
      action,
      changed_by: userId,
      changed_by_name: profile?.full_name || 'Unknown',
      changes
    }]);
  }

  async function handleAddSample() {
    const table = activeTab === 'cell_lines' ? 'cell_lines' : activeTab === 'mouse' ? 'mouse_samples' : 'human_samples';
    const { data, error } = await supabase.from(table).insert([{ ...form, created_by: userId }]).select().single();
    if (!error) {
      await logAction(activeTab, data.id, data.name || data.sample_id, 'added', form);
      setShowForm(false);
      setForm({});
      fetchData();
    }
  }

  async function handleEditSample() {
    const table = activeTab === 'cell_lines' ? 'cell_lines' : activeTab === 'mouse' ? 'mouse_samples' : 'human_samples';
    const { error } = await supabase.from(table).update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingItem.id);
    if (!error) {
      await logAction(activeTab, editingItem.id, editingItem.name || editingItem.sample_id, 'edited', form);
      setEditingItem(null);
      setForm({});
      fetchData();
    }
  }

  async function handleDeleteSample(item) {
    setConfirmModal({
      message: `Are you sure you want to remove "${item.name || item.sample_id}" from the inventory? This will be logged.`,
      onConfirm: async () => {
        const table = activeTab === 'cell_lines' ? 'cell_lines' : activeTab === 'mouse' ? 'mouse_samples' : 'human_samples';
        await logAction(activeTab, item.id, item.name || item.sample_id, 'deleted', item);
        await supabase.from(table).delete().eq('id', item.id);
        setConfirmModal(null);
        fetchData();
      },
      onCancel: () => setConfirmModal(null)
    });
  }

  async function handleTakeCellLine(cellLine) {
    setConfirmModal({
      message: `Confirm: Mark "${cellLine.name}" as absent? Log ${vialsTaken} vial(s) taken by ${profile?.full_name}.`,
      onConfirm: async () => {
        await supabase.from('cell_lines').update({
          status: 'absent',
          taken_by: userId,
          taken_at: new Date().toISOString(),
          vials_taken: vialsTaken,
          updated_at: new Date().toISOString()
        }).eq('id', cellLine.id);
        await logAction('cell_lines', cellLine.id, cellLine.name, 'taken', { vials_taken: vialsTaken, taken_by: profile?.full_name });
        setConfirmModal(null);
        setTakingCellLine(null);
        fetchData();
      },
      onCancel: () => { setConfirmModal(null); setTakingCellLine(null); }
    });
  }

  async function handleReturnCellLine(cellLine) {
    setConfirmModal({
      message: `Mark "${cellLine.name}" as present again?`,
      onConfirm: async () => {
        await supabase.from('cell_lines').update({
          status: 'present', taken_by: null, taken_at: null, vials_taken: null,
          updated_at: new Date().toISOString()
        }).eq('id', cellLine.id);
        await logAction('cell_lines', cellLine.id, cellLine.name, 'returned', { returned_by: profile?.full_name });
        setConfirmModal(null);
        fetchData();
      },
      onCancel: () => setConfirmModal(null)
    });
  }

  const cellLineFields = [
    { key: 'name', label: 'Cell Line Name', required: true, full: true },
    { key: 'cell_type', label: 'Cell Type' },
    { key: 'passage_number', label: 'Passage Number' },
    { key: 'freezer', label: 'Freezer' },
    { key: 'shelf', label: 'Shelf' },
    { key: 'box', label: 'Box' },
    { key: 'storage_location', label: 'Storage Location', full: true },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'present', label: 'Present' },
      { value: 'absent', label: 'Absent' },
      { value: 'depleted', label: 'Depleted' }
    ]},
    { key: 'notes', label: 'Notes', full: true },
    { key: 'benchling_url', label: 'Benchling URL', full: true },
  ];

  const mouseSampleFields = [
    { key: 'sample_id', label: 'Sample ID', required: true },
    { key: 'mouse_id', label: 'Mouse ID' },
    { key: 'tissue_type', label: 'Tissue Type' },
    { key: 'collection_date', label: 'Collection Date', type: 'date' },
    { key: 'freezer', label: 'Freezer' },
    { key: 'shelf', label: 'Shelf' },
    { key: 'box', label: 'Box' },
    { key: 'storage_location', label: 'Storage Location', full: true },
    { key: 'study', label: 'Study' },
    { key: 'irb_protocol', label: 'IRB Protocol' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'present', label: 'Present' },
      { value: 'absent', label: 'Absent' },
      { value: 'depleted', label: 'Depleted' }
    ]},
    { key: 'notes', label: 'Notes', full: true },
  ];

  const humanSampleFields = [
    { key: 'sample_id', label: 'Sample ID', required: true },
    { key: 'patient_id', label: 'Patient ID' },
    { key: 'tissue_type', label: 'Tissue Type' },
    { key: 'collection_date', label: 'Collection Date', type: 'date' },
    { key: 'freezer', label: 'Freezer' },
    { key: 'shelf', label: 'Shelf' },
    { key: 'box', label: 'Box' },
    { key: 'storage_location', label: 'Storage Location', full: true },
    { key: 'study', label: 'Study' },
    { key: 'irb_protocol', label: 'IRB Protocol' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'present', label: 'Present' },
      { value: 'absent', label: 'Absent' },
      { value: 'depleted', label: 'Depleted' }
    ]},
    { key: 'notes', label: 'Notes', full: true },
  ];

  const { widths: sampleWidths, onColMouseDown: sampleResize } = useResizableColumns(10);
  const { widths: auditWidths, onColMouseDown: auditResize } = useResizableColumns(5);
  const { widths: reagentWidths, onColMouseDown: reagentResize } = useResizableColumns(8);

  const currentFields = activeTab === 'cell_lines' ? cellLineFields : activeTab === 'mouse' ? mouseSampleFields : humanSampleFields;
  const currentEmpty = activeTab === 'cell_lines' ? EMPTY_CELL_LINE : activeTab === 'mouse' ? EMPTY_MOUSE : EMPTY_HUMAN;

  const getCurrentData = () => {
    const data = activeTab === 'cell_lines' ? cellLines : activeTab === 'mouse' ? mouseSamples : humanSamples;
    return data.filter(item => {
      const matchesSearch = searchQuery === '' ||
        Object.values(item).some(v => v && String(v).toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  };

  const stats = {
    cell_lines: { present: cellLines.filter(c => c.status === 'present').length, absent: cellLines.filter(c => c.status === 'absent').length, total: cellLines.length },
    mouse: { present: mouseSamples.filter(c => c.status === 'present').length, absent: mouseSamples.filter(c => c.status === 'absent').length, total: mouseSamples.length },
    human: { present: humanSamples.filter(c => c.status === 'present').length, absent: humanSamples.filter(c => c.status === 'absent').length, total: humanSamples.length },
  };

  return (
    <div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Cell Lines', present: stats.cell_lines.present, absent: stats.cell_lines.absent, total: stats.cell_lines.total },
          { label: 'Mouse Samples', present: stats.mouse.present, absent: stats.mouse.absent, total: stats.mouse.total },
          { label: 'Human Samples', present: stats.human.present, absent: stats.human.absent, total: stats.human.total },
        ].map(stat => (
          <div key={stat.label} style={{ flex: 1, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#27AE60' }}>{stat.present}</div>
                <div style={{ fontSize: '10px', color: '#27AE60' }}>Present</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#E74C3C' }}>{stat.absent}</div>
                <div style={{ fontSize: '10px', color: '#E74C3C' }}>Absent</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--purple-primary)' }}>{stat.total}</div>
                <div style={{ fontSize: '10px', color: 'var(--purple-primary)' }}>Total</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + action inline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', width: 'fit-content' }}>
          {[
            { id: 'cell_lines', label: 'Cell Lines' },
            { id: 'mouse', label: 'Mouse Samples' },
            { id: 'human', label: 'Human Samples' },
            { id: 'sequencing', label: 'Sequencing Records' },
            { id: 'shared_reagents', label: 'Shared Reagents' },
            { id: 'audit', label: 'Audit Log' },
            { id: 'benchling', label: 'Benchling Sync' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '10px 20px',
              background: activeTab === tab.id ? 'var(--purple-primary)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
              border: 'none', fontWeight: activeTab === tab.id ? 600 : 400, fontSize: '13px'
            }}>{tab.label}</button>
          ))}
        </div>
        {activeTab !== 'benchling' && activeTab !== 'sequencing' && activeTab !== 'audit' && activeTab !== 'shared_reagents' && (
          <button onClick={() => { setForm(currentEmpty); setShowForm(true); }} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            background: 'var(--purple-primary)', color: 'white', border: 'none',
            borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
          }}><Plus size={16} /> Add Sample</button>
        )}
      </div>

      {activeTab === 'benchling' && <BenchlingTab />}
      {activeTab === 'sequencing' && <SequencingTab />}

      {activeTab !== 'audit' && activeTab !== 'shared_reagents' && activeTab !== 'benchling' && activeTab !== 'sequencing' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search samples..."
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'present', 'absent', 'depleted'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: statusFilter === s ? 'var(--purple-primary)' : 'var(--bg-primary)',
                color: statusFilter === s ? 'white' : 'var(--text-secondary)',
                fontWeight: statusFilter === s ? 600 : 400, fontSize: '12px', textTransform: 'capitalize'
              }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {activeTab !== 'benchling' && activeTab !== 'sequencing' && loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : activeTab !== 'benchling' && activeTab !== 'sequencing' ? (
        <>
          {activeTab === 'cell_lines' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {getCurrentData().length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                  No cell lines found. Add your first one!
                </div>
              ) : getCurrentData().map(item => {
                const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES.present;
                return (
                  <div key={item.id} style={{
                    background: 'var(--bg-card)', border: `1px solid ${item.status === 'absent' ? '#FADBD8' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)', padding: '16px', boxShadow: 'var(--shadow-sm)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text }}>{statusStyle.label}</span>
                          {item.cell_type && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: 'var(--purple-faint)', color: 'var(--purple-primary)' }}>{item.cell_type}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          {item.passage_number && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Passage: {item.passage_number}</span>}
                          {item.freezer && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Freezer: {item.freezer}</span>}
                          {item.shelf && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Shelf: {item.shelf}</span>}
                          {item.box && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Box: {item.box}</span>}
                          {item.storage_location && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.storage_location}</span>}
                          {item.benchling_url && <a href={item.benchling_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#27AE60', fontWeight: 500 }}>📗 Open in Benchling</a>}
                        </div>
                        {item.status === 'absent' && item.taken_at && (
                          <div style={{ marginTop: '8px', padding: '8px 12px', background: '#FEF0F0', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontSize: '12px', color: '#E74C3C' }}>
                              Taken by {item.taken_by_profile?.full_name || 'Unknown'} on {new Date(item.taken_at).toLocaleDateString()}
                              {item.vials_taken ? ` — ${item.vials_taken} vial(s)` : ''}
                            </span>
                          </div>
                        )}
                        {item.notes && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0', fontStyle: 'italic' }}>{item.notes}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {item.status === 'present' && (
                          <button onClick={() => { setTakingCellLine(item); setVialsTaken(1); }} style={{
                            padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #FADBD8',
                            background: '#FEF0F0', color: '#E74C3C', fontSize: '12px', fontWeight: 500
                          }}>Take</button>
                        )}
                        {item.status === 'absent' && (
                          <button onClick={() => handleReturnCellLine(item)} style={{
                            padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #A9DFBF',
                            background: '#EAF7F0', color: '#27AE60', fontSize: '12px', fontWeight: 500
                          }}>Return</button>
                        )}
                        <button onClick={() => {
                          setConfirmModal({
                            message: `Edit "${item.name}"? Changes will be logged.`,
                            onConfirm: () => { setEditingItem(item); setForm(item); setConfirmModal(null); },
                            onCancel: () => setConfirmModal(null)
                          });
                        }} style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteSample(item)} style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Take vials input */}
                    {takingCellLine?.id === item.id && (
                      <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Vials taken:</label>
                        <input type="number" min="1" value={vialsTaken} onChange={e => setVialsTaken(parseInt(e.target.value) || 1)}
                          style={{ width: '80px', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }} />
                        <button onClick={() => handleTakeCellLine(item)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--danger)', color: 'white', fontSize: '12px', fontWeight: 600 }}>Confirm Take</button>
                        <button onClick={() => setTakingCellLine(null)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px' }}>Cancel</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(activeTab === 'mouse' || activeTab === 'human') && (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
              <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>{sampleWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {(activeTab === 'mouse'
                      ? ['Sample ID', 'Mouse ID', 'Tissue', 'Collection Date', 'Freezer', 'Shelf', 'Study', 'IRB', 'Status', 'Actions']
                      : ['Sample ID', 'Patient ID', 'Tissue', 'Collection Date', 'Freezer', 'Shelf', 'Study', 'IRB', 'Status', 'Actions']
                    ).map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', position: 'relative' }}>{h}<ColResizer colIdx={i} totalCols={10} onColMouseDown={sampleResize} /></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getCurrentData().length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No samples found.</td></tr>
                  ) : getCurrentData().map(item => {
                    const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES.present;
                    return (
                      <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.sample_id}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{activeTab === 'mouse' ? item.mouse_id : item.patient_id}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{item.tissue_type}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>{item.collection_date}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>{item.freezer}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>{item.shelf}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{item.study}</td>
                        <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.irb_protocol}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text }}>{statusStyle.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => {
                              setConfirmModal({
                                message: `Edit sample "${item.sample_id}"? Changes will be logged.`,
                                onConfirm: () => { setEditingItem(item); setForm(item); setConfirmModal(null); },
                                onCancel: () => setConfirmModal(null)
                              });
                            }} style={{ padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDeleteSample(item)} style={{ padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'audit' && (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {auditLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No audit log entries yet.</div>
              ) : (
                <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>{auditWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      {['Time', 'Action', 'Sample', 'Type', 'By'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'relative' }}>{h}<ColResizer colIdx={i} totalCols={5} onColMouseDown={auditResize} /></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map(log => {
                      const actionColors = {
                        added: '#27AE60', edited: '#2980B9', deleted: '#E74C3C',
                        taken: '#F39C12', returned: '#27AE60'
                      };
                      return (
                        <tr key={log.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: `${actionColors[log.action]}20`, color: actionColors[log.action] || 'var(--text-muted)', textTransform: 'capitalize' }}>{log.action}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{log.sample_name}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{log.sample_type?.replace('_', ' ')}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{log.changed_by_name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      ) : null}

      {activeTab === 'shared_reagents' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={() => { setEditingReagent(null); setReagentForm({ name: '', category: '', location: '', quantity: '', status: 'in_stock', notes: '' }); setShowReagentForm(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px' }}>
              + Add Reagent
            </button>
          </div>

          {sharedReagents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
              No shared reagents added yet.
            </div>
          ) : (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
              <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>{reagentWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Name', 'Category', 'Location', 'Quantity', 'Status', 'Last Updated', 'Notes', ''].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', position: 'relative' }}>{h}<ColResizer colIdx={i} totalCols={8} onColMouseDown={reagentResize} /></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sharedReagents.map(r => {
                    const statusColors = {
                      in_stock: { bg: '#EAF7F0', text: '#27AE60', label: 'In Stock' },
                      low: { bg: '#FEF9E7', text: '#F39C12', label: 'Low' },
                      empty: { bg: '#FDEDEC', text: '#E74C3C', label: 'Empty' },
                      missing: { bg: '#FDEDEC', text: '#E74C3C', label: 'Missing' },
                    };
                    const sc = statusColors[r.status] || statusColors.in_stock;
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.category}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.location}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-primary)' }}>{r.quantity}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: sc.bg, color: sc.text }}>{sc.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {r.updater?.full_name && <span>{r.updater.full_name} · </span>}
                          {r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.notes}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => { setEditingReagent(r); setReagentForm({ name: r.name, category: r.category || '', location: r.location || '', quantity: r.quantity || '', status: r.status || 'in_stock', notes: r.notes || '' }); setShowReagentForm(true); }}
                              style={{ padding: '4px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => handleDeleteReagent(r.id)}
                              style={{ padding: '4px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {showReagentForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
              <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '480px', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>{editingReagent ? 'Edit Reagent' : 'Add Shared Reagent'}</h2>
                {[
                  { label: 'Name', key: 'name', required: true },
                  { label: 'Category', key: 'category' },
                  { label: 'Location in Lab', key: 'location' },
                  { label: 'Quantity', key: 'quantity' },
                  { label: 'Notes', key: 'notes' },
                ].map(field => (
                  <div key={field.key} style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}{field.required ? ' *' : ''}</label>
                    <input value={reagentForm[field.key]} onChange={e => setReagentForm(p => ({ ...p, [field.key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                  <select value={reagentForm.status} onChange={e => setReagentForm(p => ({ ...p, status: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                    <option value="in_stock">In Stock</option>
                    <option value="low">Low</option>
                    <option value="empty">Empty</option>
                    <option value="missing">Missing</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowReagentForm(false); setEditingReagent(null); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
                  <button onClick={handleSaveReagent} disabled={!reagentForm.name} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: !reagentForm.name ? 'var(--border)' : 'var(--purple-primary)', color: !reagentForm.name ? 'var(--text-muted)' : 'white', fontWeight: 600 }}>Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {(showForm || editingItem) && (
        <SampleForm
          title={editingItem ? `Edit ${activeTab === 'cell_lines' ? 'Cell Line' : 'Sample'}` : `Add ${activeTab === 'cell_lines' ? 'Cell Line' : activeTab === 'mouse' ? 'Mouse Sample' : 'Human Sample'}`}
          fields={currentFields}
          form={form}
          setForm={setForm}
          onSubmit={editingItem ? handleEditSample : handleAddSample}
          onCancel={() => { setShowForm(false); setEditingItem(null); setForm({}); }}
        />
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel}
        />
      )}
    </div>
  );
}
