import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Upload, Plus, Search, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const CATEGORY_COLORS = ['#7B3FA0','#2980B9','#27AE60','#F39C12','#E74C3C','#1ABC9C','#9B59B6','#3498DB','#E67E22','#95A5A6'];
const STATUS_STYLES = {
  complete: { bg: '#EAF7F0', text: '#27AE60', label: 'Complete' },
  pending: { bg: '#FEF9E7', text: '#F39C12', label: 'Pending' },
  cancelled: { bg: '#FDEDEC', text: '#E74C3C', label: 'Cancelled' },
};

function GrantCard({ grant }) {
  const pct = grant.total_amount && grant.remaining_balance ? (grant.remaining_balance / grant.total_amount) * 100 : null;
  const isLow = pct !== null && pct < 25;
  const isCritical = pct !== null && pct < 10;
  const daysLeft = grant.end_date ? Math.ceil((new Date(grant.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 90;
  const isExpiringUrgent = daysLeft !== null && daysLeft <= 14;
  return (
    <div style={{ background: 'var(--bg-card)', border: `1px solid ${isCritical ? '#FADBD8' : isLow ? '#FAD7A0' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{grant.name}</h3>
          {grant.chartstring && <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontFamily: 'monospace' }}>{grant.chartstring}</p>}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {isCritical && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#FDEDEC', color: '#E74C3C' }}>Critical</span>}
          {isLow && !isCritical && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#FEF9E7', color: '#F39C12' }}>Low</span>}
          {isExpiringUrgent && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#FDEDEC', color: '#E74C3C' }}>Expires in {daysLeft}d</span>}
          {isExpiringSoon && !isExpiringUrgent && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#FEF9E7', color: '#F39C12' }}>Expires in {daysLeft}d</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {grant.total_amount !== null && <div><p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 2px' }}>Total</p><p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>${grant.total_amount?.toLocaleString()}</p></div>}
        {grant.remaining_balance !== null && <div><p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 2px' }}>Remaining</p><p style={{ fontSize: '16px', fontWeight: 700, color: isCritical ? '#E74C3C' : isLow ? '#F39C12' : '#27AE60', margin: 0 }}>${grant.remaining_balance?.toLocaleString()}</p></div>}
        {grant.end_date && <div><p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 2px' }}>End Date</p><p style={{ fontSize: '14px', fontWeight: 600, color: isExpiringUrgent ? '#E74C3C' : 'var(--text-primary)', margin: 0 }}>{grant.end_date}</p></div>}
      </div>
      {pct !== null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Balance remaining</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: isCritical ? '#E74C3C' : isLow ? '#F39C12' : '#27AE60' }}>{pct.toFixed(1)}%</span>
          </div>
          <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: isCritical ? '#E74C3C' : isLow ? '#F39C12' : '#27AE60', borderRadius: '3px' }} />
          </div>
        </div>
      )}
      {grant.notes && <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '10px 0 0', fontStyle: 'italic' }}>{grant.notes}</p>}
    </div>
  );
}

export default function Finance({ userRole }) {
  const [grants, setGrants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reagents, setReagents] = useState([]);
  const [nanoseq, setNanoseq] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('grants');
  const [reagentTab, setReagentTab] = useState('misc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewReagents, setPreviewReagents] = useState(null);
  const [previewNanoseq, setPreviewNanoseq] = useState(null);
  const [newOrder, setNewOrder] = useState({
    item: '', vendor: '', catalog_number: '', category: '', grant_name: '',
    requisition_id: '', unit_description: '', unit_price: '', units: '',
    order_date: '', requestor: '', status: 'pending', notes: ''
  });

  const canManage = userRole === 'admin' || userRole === 'pm';

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: grantData }, { data: orderData }, { data: reagentData }, { data: nanoseqData }] = await Promise.all([
      supabase.from('grants').select('*').order('name'),
      supabase.from('orders').select('*').order('order_date', { ascending: false }),
      supabase.from('reagents').select('*').order('category').order('name'),
      supabase.from('nanoseq_reagents').select('*').order('protocol').order('name')
    ]);
    setGrants(grantData || []);
    setOrders(orderData || []);
    setReagents(reagentData || []);
    setNanoseq(nanoseqData || []);
    setLoading(false);
  }

  async function handleAddOrder(e) {
    e.preventDefault();
    const { error } = await supabase.from('orders').insert([{
      ...newOrder,
      unit_price: parseFloat(newOrder.unit_price) || null,
      units: parseInt(newOrder.units) || null,
      total_price: (parseFloat(newOrder.unit_price) || 0) * (parseInt(newOrder.units) || 1),
      order_date: newOrder.order_date || null
    }]);
    if (!error) {
      setShowAddOrder(false);
      setNewOrder({ item: '', vendor: '', catalog_number: '', category: '', grant_name: '', requisition_id: '', unit_description: '', unit_price: '', units: '', order_date: '', requestor: '', status: 'pending', notes: '' });
      fetchData();
    }
  }

  async function handleConfirmImport() {
    if (!previewData) return;
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/import-orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orders: previewData }) });
    const data = await res.json();
    if (data.success) { setPreviewData(null); fetchData(); }
  }

  async function handleConfirmReagentImport() {
    if (!previewReagents) return;
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/import-reagents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reagents: previewReagents }) });
    const data = await res.json();
    if (data.success) { setPreviewReagents(null); fetchData(); }
  }

  async function handleConfirmNanoseqImport() {
    if (!previewNanoseq) return;
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/import-nanoseq`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reagents: previewNanoseq }) });
    const data = await res.json();
    if (data.success) { setPreviewNanoseq(null); fetchData(); }
  }

  const statusByCategoryData = Object.entries(orders.reduce((acc, o) => { if (!o.category) return acc; if (!acc[o.category]) acc[o.category] = { name: o.category, complete: 0, processing: 0 }; if (o.status === 'complete') acc[o.category].complete += o.total_price || 0; else acc[o.category].processing += o.total_price || 0; return acc; }, {})).map(([_, v]) => ({ ...v, complete: Math.round(v.complete), processing: Math.round(v.processing) })).sort((a, b) => (b.complete + b.processing) - (a.complete + a.processing));
  const monthlySpend = orders.reduce((acc, o) => { if (!o.order_date || !o.total_price) return acc; const month = o.order_date.substring(0, 7); acc[month] = (acc[month] || 0) + o.total_price; return acc; }, {});
  const monthlyChartData = Object.entries(monthlySpend).map(([month, value]) => ({ month, value: Math.round(value) })).sort((a, b) => a.month.localeCompare(b.month));
  const allCategories = [...new Set(orders.map(o => o.category).filter(Boolean))].sort();
  const monthlyCategoryData = orders.reduce((acc, o) => { if (!o.order_date || !o.total_price || !o.category) return acc; const month = o.order_date.substring(0, 7); if (!acc[o.category]) acc[o.category] = {}; acc[o.category][month] = (acc[o.category][month] || 0) + o.total_price; return acc; }, {});
  const grantMonthlyData = orders.reduce((acc, o) => { if (!o.order_date || !o.total_price || !o.grant_name) return acc; const month = o.order_date.substring(0, 7); if (!acc[month]) acc[month] = { month }; acc[month][o.grant_name] = (acc[month][o.grant_name] || 0) + o.total_price; return acc; }, {});
  const grantMonthlyChartData = Object.values(grantMonthlyData).sort((a, b) => a.month.localeCompare(b.month));
  const allGrants = [...new Set(orders.map(o => o.grant_name).filter(Boolean))];
  const grantSpend = orders.reduce((acc, o) => { if (!o.grant_name || !o.total_price) return acc; acc[o.grant_name] = (acc[o.grant_name] || 0) + o.total_price; return acc; }, {});
  const grantChartData = Object.entries(grantSpend).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  const filteredOrders = orders.filter(o => searchQuery === '' || o.item?.toLowerCase().includes(searchQuery.toLowerCase()) || o.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) || o.requisition_id?.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalSpend = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const alertGrants = grants.filter(g => { const pct = g.total_amount && g.remaining_balance ? (g.remaining_balance / g.total_amount) * 100 : null; const daysLeft = g.end_date ? Math.ceil((new Date(g.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null; return (pct !== null && pct < 25) || (daysLeft !== null && daysLeft <= 90); });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Finance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Grants, orders, and reagent tracking</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {canManage && (activeTab === 'orders' || activeTab === 'reagents') && (
            <>
              {activeTab === 'orders' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                  <Upload size={16} /> {uploadingFile ? 'Processing...' : 'Import File'}
                  <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    setUploadingFile(true);
                    const formData = new FormData(); formData.append('file', file);
                    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/preview-orders`, { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.newOrders) setPreviewData(data.newOrders);
                    setUploadingFile(false);
                  }} />
                </label>
              )}
              {activeTab === 'reagents' && reagentTab === 'misc' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                  <Upload size={16} /> {uploadingFile ? 'Processing...' : 'Import Misc'}
                  <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    setUploadingFile(true);
                    const formData = new FormData(); formData.append('file', file);
                    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/preview-reagents`, { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.newReagents) setPreviewReagents(data.newReagents);
                    setUploadingFile(false);
                  }} />
                </label>
              )}
              {activeTab === 'reagents' && reagentTab === 'nanoseq' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                  <Upload size={16} /> {uploadingFile ? 'Processing...' : 'Import Nanoseq'}
                  <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    setUploadingFile(true);
                    const formData = new FormData(); formData.append('file', file);
                    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/preview-nanoseq`, { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.newNanoseq) setPreviewNanoseq(data.newNanoseq);
                    setUploadingFile(false);
                  }} />
                </label>
              )}
              {activeTab === 'orders' && (
                <button onClick={() => setShowAddOrder(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px' }}><Plus size={16} /> Add Order</button>
              )}
            </>
          )}
        </div>
      </div>

      {alertGrants.length > 0 && (
        <div style={{ background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><AlertTriangle size={16} color="#F39C12" /><span style={{ fontSize: '13px', fontWeight: 600, color: '#F39C12' }}>Grant Alerts</span></div>
          {alertGrants.map(g => { const pct = g.total_amount && g.remaining_balance ? (g.remaining_balance / g.total_amount) * 100 : null; const daysLeft = g.end_date ? Math.ceil((new Date(g.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null; return (<p key={g.id} style={{ fontSize: '12px', color: '#F39C12', margin: '4px 0 0' }}><strong>{g.name}</strong>{pct !== null && pct < 25 ? ` — ${pct.toFixed(1)}% remaining ($${g.remaining_balance?.toLocaleString()})` : ''}{daysLeft !== null && daysLeft <= 90 ? ` — expires in ${daysLeft} days (${g.end_date})` : ''}</p>); })}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Active Grants', value: grants.length, color: 'var(--purple-primary)', bg: 'var(--purple-faint)' },
          { label: 'Total Orders', value: orders.length, color: '#2980B9', bg: '#EBF5FB' },
          { label: 'FY26 Spend', value: `$${Math.round(totalSpend).toLocaleString()}`, color: '#27AE60', bg: '#EAF7F0' },
          { label: 'Grant Alerts', value: alertGrants.length, color: alertGrants.length > 0 ? '#F39C12' : '#27AE60', bg: alertGrants.length > 0 ? '#FEF9E7' : '#EAF7F0' },
        ].map(stat => (
          <div key={stat.label} style={{ flex: 1, background: stat.bg, borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: stat.color, marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '20px', width: 'fit-content' }}>
        {['grants', 'orders', 'reagents', 'charts'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 20px', background: activeTab === tab ? 'var(--purple-primary)' : 'transparent', color: activeTab === tab ? 'white' : 'var(--text-secondary)', border: 'none', fontWeight: activeTab === tab ? 600 : 400, fontSize: '13px', textTransform: 'capitalize' }}>{tab}</button>
        ))}
      </div>

      {previewData && (
        <div style={{ background: '#EAF7F0', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} color="#27AE60" /><span style={{ fontSize: '13px', fontWeight: 600, color: '#27AE60' }}>{previewData.length} new orders found</span></div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setPreviewData(null)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px' }}>Cancel</button>
              <button onClick={handleConfirmImport} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#27AE60', color: 'white', fontSize: '12px', fontWeight: 600 }}>Confirm Import</button>
            </div>
          </div>
          {previewData.slice(0, 5).map((o, i) => <p key={i} style={{ fontSize: '12px', color: '#27AE60', margin: '4px 0' }}>+ {o.item} — {o.vendor} — ${o.total_price}</p>)}
          {previewData.length > 5 && <p style={{ fontSize: '12px', color: '#27AE60', margin: '4px 0' }}>...and {previewData.length - 5} more</p>}
        </div>
      )}

      {previewReagents && (
        <div style={{ background: '#EAF7F0', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} color="#27AE60" /><span style={{ fontSize: '13px', fontWeight: 600, color: '#27AE60' }}>{previewReagents.length} new reagents found</span></div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setPreviewReagents(null)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px' }}>Cancel</button>
              <button onClick={handleConfirmReagentImport} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#27AE60', color: 'white', fontSize: '12px', fontWeight: 600 }}>Confirm Import</button>
            </div>
          </div>
          {previewReagents.slice(0, 5).map((r, i) => <p key={i} style={{ fontSize: '12px', color: '#27AE60', margin: '4px 0' }}>+ {r.name} — {r.vendor} — {r.catalog_number}</p>)}
          {previewReagents.length > 5 && <p style={{ fontSize: '12px', color: '#27AE60', margin: '4px 0' }}>...and {previewReagents.length - 5} more</p>}
        </div>
      )}

      {previewNanoseq && (
        <div style={{ background: '#EAF7F0', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} color="#27AE60" /><span style={{ fontSize: '13px', fontWeight: 600, color: '#27AE60' }}>{previewNanoseq.length} new Nanoseq reagents found</span></div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setPreviewNanoseq(null)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px' }}>Cancel</button>
              <button onClick={handleConfirmNanoseqImport} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#27AE60', color: 'white', fontSize: '12px', fontWeight: 600 }}>Confirm Import</button>
            </div>
          </div>
          {previewNanoseq.slice(0, 5).map((r, i) => <p key={i} style={{ fontSize: '12px', color: '#27AE60', margin: '4px 0' }}>+ {r.name} — {r.company} — {r.code}</p>)}
          {previewNanoseq.length > 5 && <p style={{ fontSize: '12px', color: '#27AE60', margin: '4px 0' }}>...and {previewNanoseq.length - 5} more</p>}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          {activeTab === 'grants' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {grants.map(grant => <GrantCard key={grant.id} grant={grant} />)}
            </div>
          )}

          {activeTab === 'orders' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search orders..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filteredOrders.length} orders</span>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      {['Item','Vendor','Category','Grant','Req ID','Price','Date','Requestor','Status'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.slice(0, 100).map(order => {
                      const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                      return (
                        <tr key={order.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.item}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{order.vendor}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.category}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--purple-primary)', whiteSpace: 'nowrap' }}>{order.grant_name}</td>
                          <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{order.requisition_id}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>${order.total_price?.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{order.order_date}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{order.requestor}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text, whiteSpace: 'nowrap' }}>{statusStyle.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredOrders.length > 100 && <p style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', margin: 0 }}>Showing 100 of {filteredOrders.length} orders. Use search to filter.</p>}
              </div>
            </>
          )}

          {activeTab === 'reagents' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['misc', 'nanoseq'].map(rt => (
                  <button key={rt} onClick={() => setReagentTab(rt)} style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: reagentTab === rt ? 'var(--purple-primary)' : 'var(--bg-primary)', color: reagentTab === rt ? 'white' : 'var(--text-secondary)', fontWeight: reagentTab === rt ? 600 : 400, fontSize: '12px' }}>{rt === 'misc' ? 'Misc' : 'Nanoseq'}</button>
                ))}
              </div>

              {reagentTab === 'misc' && (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {reagents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No reagents loaded yet. Click Import Misc to upload.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: 'var(--bg-secondary)' }}>{['Name','Vendor','Cat #','Category','In Lab','FY24','FY25','FY26'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                      <tbody>{reagents.map(r => <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.vendor}</td><td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.catalog_number}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.category}</td><td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>{r.quantity_in_lab ?? '—'}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>{r.fy24_purchases ?? '—'}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>{r.fy25_purchases ?? '—'}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>{r.fy26_purchases ?? '—'}</td></tr>)}</tbody>
                    </table>
                  )}
                </div>
              )}

              {reagentTab === 'nanoseq' && (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {nanoseq.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No Nanoseq reagents loaded yet. Click Import Nanoseq to upload.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: 'var(--bg-secondary)' }}>{['Protocol','Reagent','Company','Code','Cost','Amount','nRxn','Link'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                      <tbody>{nanoseq.map(r => <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.protocol}</td><td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.company}</td><td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.code}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-primary)' }}>{r.cost ? `$${r.cost.toLocaleString()}` : '—'}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>{r.amount}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>{r.n_reactions ?? '—'}</td><td style={{ padding: '10px 12px', fontSize: '12px' }}>{r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple-primary)', textDecoration: 'none', fontSize: '11px' }}>View</a>}</td></tr>)}</tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'charts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Complete and Processing by Category</h3>
                <ResponsiveContainer width="100%" height={300}><BarChart data={statusByCategoryData} margin={{ top: 0, right: 20, left: 20, bottom: 80 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" /><YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `$${v.toLocaleString()}`} /><Tooltip formatter={v => [`$${v.toLocaleString()}`]} /><Legend /><Bar dataKey="complete" name="Complete" fill="#27AE60" radius={[4,4,0,0]} /><Bar dataKey="processing" name="Processing" fill="#2980B9" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Total Spending by Month</h3>
                <ResponsiveContainer width="100%" height={250}><BarChart data={monthlyChartData} margin={{ top: 0, right: 20, left: 20, bottom: 40 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" /><YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `$${v.toLocaleString()}`} /><Tooltip formatter={v => [`$${v.toLocaleString()}`, 'Spend']} /><Bar dataKey="value" fill="var(--purple-primary)" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Spending by Grant Over Time</h3>
                <ResponsiveContainer width="100%" height={300}><BarChart data={grantMonthlyChartData} margin={{ top: 0, right: 20, left: 20, bottom: 40 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" /><YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `$${v.toLocaleString()}`} /><Tooltip formatter={v => [`$${v.toLocaleString()}`]} /><Legend />{allGrants.map((grant, i) => <Bar key={grant} dataKey={grant} stackId="a" fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}</BarChart></ResponsiveContainer>
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Monthly Breakdown by Category</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
                  {allCategories.map(category => { const catData = monthlyCategoryData[category] || {}; const chartData = Object.entries(catData).map(([month, value]) => ({ month, value: Math.round(value) })).sort((a, b) => a.month.localeCompare(b.month)); return (<div key={category} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px' }}><h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>{category}</h4><ResponsiveContainer width="100%" height={180}><BarChart data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 40 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" /><YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={v => `$${v.toLocaleString()}`} /><Tooltip formatter={v => [`$${v.toLocaleString()}`, 'Spend']} /><Bar dataKey="value" fill="#2980B9" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer></div>); })}
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Spending by Grant</h3>
                <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={grantChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{grantChartData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}</Pie><Tooltip formatter={v => [`$${v.toLocaleString()}`, 'Spend']} /></PieChart></ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {showAddOrder && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '580px', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Order</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {[{label:'Item Name',key:'item',full:true},{label:'Vendor',key:'vendor'},{label:'Catalog Number',key:'catalog_number'},{label:'Category',key:'category'},{label:'Grant',key:'grant_name'},{label:'Requisition ID',key:'requisition_id'},{label:'Unit Description',key:'unit_description'},{label:'Unit Price ($)',key:'unit_price',type:'number'},{label:'Units',key:'units',type:'number'},{label:'Order Date',key:'order_date',type:'date'},{label:'Requestor',key:'requestor'}].map(field => (
                <div key={field.key} style={{ gridColumn: field.full ? '1 / -1' : 'auto' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}</label>
                  <input type={field.type || 'text'} value={newOrder[field.key]} onChange={e => setNewOrder(p => ({ ...p, [field.key]: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                <select value={newOrder.status} onChange={e => setNewOrder(p => ({ ...p, status: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="pending">Pending</option><option value="complete">Complete</option><option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddOrder(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleAddOrder} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600 }}>Add Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
