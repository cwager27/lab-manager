import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Trash2 } from 'lucide-react';

function levenshtein(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function normVendor(s) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,\-&]/g, '');
}

function findSimilarVendors(input, list) {
  const n = normVendor(input);
  return list.filter(v => {
    const vn = normVendor(v.name);
    if (vn === n) return false;
    const threshold = Math.max(2, Math.floor(Math.max(n.length, vn.length) * 0.25));
    return levenshtein(n, vn) <= threshold || vn.includes(n) || n.includes(vn);
  });
}

export default function Vendors({ userRole }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorSearch, setVendorSearch] = useState('');
  const [newVendorInput, setNewVendorInput] = useState('');
  const [vendorError, setVendorError] = useState('');
  const [vendorSuggestions, setVendorSuggestions] = useState([]);
  const [pendingVendorName, setPendingVendorName] = useState('');

  const canManage = userRole === 'admin' || userRole === 'pm';

  useEffect(() => {
    supabase.from('vendors').select('*').order('name').then(({ data }) => {
      setVendors(data || []);
      setLoading(false);
    });
  }, []);

  async function handleDeleteVendor(id) {
    await supabase.from('vendors').delete().eq('id', id);
    setVendors(prev => prev.filter(v => v.id !== id));
  }

  async function handleAddVendor(forceAdd) {
    const name = (forceAdd || newVendorInput).trim();
    if (!name) return;
    const exact = vendors.find(v => normVendor(v.name) === normVendor(name));
    if (exact) {
      setVendorError(`"${exact.name}" already exists in the vendor list.`);
      setVendorSuggestions([]);
      return;
    }
    if (!forceAdd) {
      const sim = findSimilarVendors(name, vendors);
      if (sim.length > 0) {
        setVendorSuggestions(sim);
        setPendingVendorName(name);
        setVendorError('');
        return;
      }
    }
    setVendorSuggestions([]);
    setPendingVendorName('');
    setVendorError('');
    const { data, error } = await supabase.from('vendors').insert([{ name }]).select().single();
    if (error) { setVendorError('Failed to add vendor. It may already exist.'); return; }
    setVendors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewVendorInput('');
  }

  const filtered = vendors.filter(v => !vendorSearch || v.name.toLowerCase().includes(vendorSearch.toLowerCase()));

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Vendor List</h1>
      </div>

      {canManage && (
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>Add Vendor</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={newVendorInput}
              onChange={e => { setNewVendorInput(e.target.value); setVendorError(''); setVendorSuggestions([]); }}
              onKeyDown={e => e.key === 'Enter' && handleAddVendor()}
              placeholder="Vendor name..."
              style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}
            />
            <button
              onClick={() => handleAddVendor()}
              style={{ padding: '9px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >Add</button>
          </div>

          {vendorError && vendorSuggestions.length === 0 && (
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#E74C3C', fontWeight: 500 }}>{vendorError}</p>
          )}

          {vendorSuggestions.length > 0 && (
            <div style={{ marginTop: '12px', background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#E67E22', margin: '0 0 10px' }}>
                Similar vendor{vendorSuggestions.length > 1 ? 's' : ''} already exist — did you mean one of these?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {vendorSuggestions.map(v => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>"{v.name}"</span>
                    <button
                      onClick={() => { setNewVendorInput(v.name); setVendorSuggestions([]); setVendorError(''); setPendingVendorName(''); }}
                      style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #FAD7A0', background: 'white', color: '#E67E22', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >Use this</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #FAD7A0' }}>
                <button
                  onClick={() => handleAddVendor(pendingVendorName)}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Add "{pendingVendorName}" anyway
                </button>
                <button
                  onClick={() => { setVendorSuggestions([]); setPendingVendorName(''); }}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}
                >Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Vendors ({vendors.length})
          </h3>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 10px' }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              value={vendorSearch}
              onChange={e => setVendorSearch(e.target.value)}
              placeholder="Search vendors..."
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            {vendors.length === 0 ? (canManage ? 'No vendors yet. Add one above.' : 'No vendors added yet.') : 'No vendors match your search.'}
          </div>
        ) : (
          <div>
            {filtered.map((v, i) => (
              <div key={v.id} style={{ padding: '10px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', fontSize: '13px', color: 'var(--text-primary)', background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{v.name}</span>
                {canManage && (
                  <button
                    onClick={() => handleDeleteVendor(v.id)}
                    style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#E74C3C'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    title="Delete vendor"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
