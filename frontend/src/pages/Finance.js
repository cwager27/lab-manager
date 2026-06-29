import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Upload, Plus, Search, CheckCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

const CHART_BLUE = '#4472C4';
const CHART_RED  = '#CC4125';

const CATEGORIES = [
  'Antibodies', 'Biological materials/specimens', 'Capital', 'Cell Line',
  'Cores', 'CR/CO', 'Disposable Supplies', 'General Lab Chemicals',
  'Meals and fun', 'Proteins and enzymes', 'Sequence-Based Reagents', 'Shipping',
  'Specialized Reagents, Kits, Supplies', 'Subcapital', 'Subscriptions',
  'Tissue Culture Reagents', 'Travel & Conferences',
];

const CATEGORY_COLORS = {
  'Antibodies': '#4472C4',
  'Biological materials/specimens': '#538135',
  'Capital': '#FFD700',
  'Cell Line': '#7030A0',
  'Cores': '#E46C0A',
  'CR/CO': '#1F3864',
  'Disposable Supplies': '#9DC3E6',
  'General Lab Chemicals': '#C55A11',
  'Meals and fun': '#FF00FF',
  'Proteins and enzymes': '#92D050',
  'Sequence-Based Reagents': '#FF0000',
  'Shipping': '#00B0F0',
  'Specialized Reagents, Kits, Supplies': '#4BACC6',
  'Subcapital': '#FAC090',
  'Subscriptions': '#CCCC00',
  'Tissue Culture Reagents': '#A9D18E',
  'Travel & Conferences': '#C4A265',
};

const MON_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function orderDateToMonth(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  return `${MON_ABBR[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
}

function getCatMonthlyData(cat, data) {
  return data.map(r => ({ month: r.month, value: r[cat] != null ? r[cat] : null }));
}

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
  const [reagentSearch, setReagentSearch] = useState('');
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
  const [selectedGrants, setSelectedGrants] = useState([]);
  const [grantFilterOpen, setGrantFilterOpen] = useState(false);
  const [draftGrants, setDraftGrants] = useState([]);
  const [grantSearch, setGrantSearch] = useState('');
  const chartData = useMemo(() => {
    const LAB_CATS = new Set(['Specialized Reagents, Kits, Supplies','Sequence-Based Reagents','Proteins and enzymes','Antibodies','Biological materials/specimens','General Lab Chemicals','Tissue Culture Reagents']);
    const real = orders.filter(o => o.item && o.item.trim() !== '');

    // sorted unique months
    const monthMap = {};
    real.forEach(o => {
      const m = orderDateToMonth(o.order_date);
      if (m) monthMap[m] = o.order_date;
    });
    const months = Object.entries(monthMap).sort((a, b) => a[1].localeCompare(b[1])).map(([m]) => m);

    // per-category monthly totals
    const byMonth = {};
    months.forEach(m => { byMonth[m] = { month: m }; });
    real.forEach(o => {
      const m = orderDateToMonth(o.order_date);
      if (!m || !o.category || o.total_price == null) return;
      byMonth[m][o.category] = (byMonth[m][o.category] || 0) + Number(o.total_price);
    });
    const catData = months.map(m => byMonth[m]);

    // complete/processing by category
    const byCat = {};
    CATEGORIES.forEach(cat => { byCat[cat] = { name: cat, complete: 0, processing: 0 }; });
    real.forEach(o => {
      if (!o.category || o.total_price == null) return;
      if (!byCat[o.category]) byCat[o.category] = { name: o.category, complete: 0, processing: 0 };
      const s = (o.status || '').trim().toLowerCase();
      if (s === 'complete') byCat[o.category].complete += Number(o.total_price);
      else if (s === 'processing') byCat[o.category].processing += Number(o.total_price);
    });
    const catStatusData = CATEGORIES.map(cat => byCat[cat]);

    // lab reagents monthly
    const labByMonth = {};
    real.forEach(o => {
      if (!o.category || !LAB_CATS.has(o.category) || o.total_price == null) return;
      const m = orderDateToMonth(o.order_date);
      if (!m) return;
      labByMonth[m] = (labByMonth[m] || 0) + Number(o.total_price);
    });
    const labReagentsMonthlyData = months.map(m => ({ month: m, value: labByMonth[m] ?? null }));

    // grant names
    const grantSet = new Set();
    real.forEach(o => { if (o.grant_name) grantSet.add(o.grant_name); });
    const grantNames = [...grantSet].sort();

    // by grant × month × status
    const byGrant = {};
    real.forEach(o => {
      if (!o.grant_name || o.total_price == null) return;
      const m = orderDateToMonth(o.order_date);
      if (!m) return;
      if (!byGrant[o.grant_name]) byGrant[o.grant_name] = {};
      if (!byGrant[o.grant_name][m]) byGrant[o.grant_name][m] = { complete: 0, processing: 0 };
      const s = (o.status || '').trim().toLowerCase();
      if (s === 'complete') byGrant[o.grant_name][m].complete += Number(o.total_price);
      else if (s === 'processing') byGrant[o.grant_name][m].processing += Number(o.total_price);
    });

    return { months, catData, catStatusData, labReagentsMonthlyData, grantNames, byGrant };
  }, [orders]);

  const { months: MONTHS, catData, catStatusData, labReagentsMonthlyData, grantNames: GRANT_NAMES, byGrant: ordersDataByGrant } = chartData;

  const catCats = CATEGORIES;
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [selectedSubChart, setSelectedSubChart] = useState('Subcapital');
  const [vendors, setVendors] = useState([]);

  const canManage = userRole === 'admin' || userRole === 'pm';

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: grantData }, { data: orderData }, { data: reagentData }, { data: nanoseqData }, { data: vendorData }] = await Promise.all([
      supabase.from('grants').select('*').order('name'),
      supabase.from('orders').select('*').order('order_date', { ascending: false }),
      supabase.from('reagents').select('*').order('category').order('name'),
      supabase.from('nanoseq_reagents').select('*').order('protocol').order('name'),
      supabase.from('vendors').select('*').order('name')
    ]);
    setGrants(grantData || []);
    setOrders(orderData || []);
    setReagents(reagentData || []);
    setNanoseq(nanoseqData || []);
    setVendors(vendorData || []);
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

  // Chart editing helpers
  const catMonths = catData.map(r => r.month);
  const subCharts = [
    { title: 'Subcapital',               data: getCatMonthlyData('Subcapital', catData) },
    { title: 'Travel & Conferences',    data: getCatMonthlyData('Travel & Conferences', catData) },
    { title: 'Capital',                 data: getCatMonthlyData('Capital', catData) },
    { title: 'Meals and fun',           data: getCatMonthlyData('Meals and fun', catData) },
    { title: 'Subscriptions',           data: getCatMonthlyData('Subscriptions', catData) },
    { title: 'Disposable Supplies',     data: getCatMonthlyData('Disposable Supplies', catData) },
    { title: 'Tissue Culture Reagents', data: getCatMonthlyData('Tissue Culture Reagents', catData) },
    { title: 'Shipping',                data: getCatMonthlyData('Shipping', catData) },
    { title: 'CR/CO',                   data: getCatMonthlyData('CR/CO', catData) },
    { title: 'Cores',                   data: getCatMonthlyData('Cores', catData) },
    { title: 'Lab reagents',            data: labReagentsMonthlyData },
  ];

  async function commitReagentEdit() {
    if (!editCell || editCell.tbl !== 'reagent') return;
    const { id, col } = editCell;
    const numericFields = ['quantity_in_lab', 'fy24_purchases', 'fy25_purchases', 'fy26_purchases'];
    const numVal = parseFloat(editVal);
    const value = numericFields.includes(col) ? (isNaN(numVal) ? null : numVal) : editVal;
    setReagents(prev => prev.map(r => r.id === id ? { ...r, [col]: value } : r));
    await supabase.from('reagents').update({ [col]: value }).eq('id', id);
    setEditCell(null);
    setEditVal('');
  }

  async function addReagentRow() {
    const { data } = await supabase.from('reagents').insert([{ name: 'New Reagent', vendor: '', catalog_number: '', category: '' }]).select().single();
    if (data) setReagents(prev => [...prev, data]);
  }


  const totalComplete = catStatusData.reduce((s, r) => s + (r.complete || 0), 0);
  const totalProcessing = catStatusData.reduce((s, r) => s + (r.processing || 0), 0);
  const totalsChartData = [
    { name: 'Complete',   value: totalComplete,   fill: CHART_BLUE },
    { name: 'Processing', value: totalProcessing, fill: CHART_RED  },
  ];

  const activeGrants = selectedGrants.length === 0 ? GRANT_NAMES : selectedGrants;
  const grantChartData = MONTHS.map(m => {
    const complete   = activeGrants.reduce((sum, g) => sum + (ordersDataByGrant[g]?.[m]?.complete   || 0), 0);
    const processing = activeGrants.reduce((sum, g) => sum + (ordersDataByGrant[g]?.[m]?.processing || 0), 0);
    return { month: m, complete, processing };
  });
  const filteredGrantOptions = GRANT_NAMES.filter(g => g.toLowerCase().includes(grantSearch.toLowerCase()));
  const tableMonthRows = MONTHS.map(m => {
    const complete   = activeGrants.reduce((sum, g) => sum + (ordersDataByGrant[g]?.[m]?.complete   || 0), 0);
    const processing = activeGrants.reduce((sum, g) => sum + (ordersDataByGrant[g]?.[m]?.processing || 0), 0);
    return { month: m, complete, processing };
  }).filter(r => r.complete > 0 || r.processing > 0);
  const tableTotalComplete   = tableMonthRows.reduce((s, r) => s + r.complete,   0);
  const tableTotalProcessing = tableMonthRows.reduce((s, r) => s + r.processing, 0);

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
          {canManage && activeTab === 'reagents' && reagentTab === 'nanoseq' && (
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', width: 'fit-content' }}>
          {['grants', 'orders', 'reagents', 'charts'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 20px', background: activeTab === tab ? 'var(--purple-primary)' : 'transparent', color: activeTab === tab ? 'white' : 'var(--text-secondary)', border: 'none', fontWeight: activeTab === tab ? 600 : 400, fontSize: '13px', textTransform: 'capitalize' }}>{tab}</button>
          ))}
        </div>
        {canManage && activeTab === 'orders' && (
          <button onClick={() => setShowAddOrder(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}><Plus size={16} /> Add Order</button>
        )}
        {canManage && activeTab === 'reagents' && (
          <button onClick={addReagentRow} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}><Plus size={16} /> Add Reagent</button>
        )}
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
                <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      {['Item','Vendor','Category','Grant','Req ID','Price','Date','Requestor','Status'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => {
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
              </div>
            </>
          )}

          {activeTab === 'reagents' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['misc', 'nanoseq'].map(rt => (
                    <button key={rt} onClick={() => { setReagentTab(rt); setReagentSearch(''); }} style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: reagentTab === rt ? 'var(--purple-primary)' : 'var(--bg-primary)', color: reagentTab === rt ? 'white' : 'var(--text-secondary)', fontWeight: reagentTab === rt ? 600 : 400, fontSize: '12px' }}>{rt === 'misc' ? 'Misc' : 'Nanoseq'}</button>
                  ))}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '7px 12px' }}>
                  <Search size={13} color="var(--text-muted)" />
                  <input
                    value={reagentSearch}
                    onChange={e => setReagentSearch(e.target.value)}
                    placeholder="Search reagents..."
                    style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent', color: 'var(--text-primary)' }}
                  />
                  {reagentSearch && (
                    <button onClick={() => setReagentSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
                  )}
                </div>
              </div>

              {reagentTab === 'misc' && (() => {
                const q = reagentSearch.toLowerCase();
                const filteredReagents = q
                  ? reagents.filter(r => ['name','vendor','catalog_number','category','quantity_in_lab','fy24_purchases','fy25_purchases','fy26_purchases'].some(k => r[k] != null && String(r[k]).toLowerCase().includes(q)))
                  : reagents;
                return (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        {['Name','Vendor','Cat #','Category','In Lab','FY24','FY25','FY26'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReagents.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No reagents match "{reagentSearch}"</td></tr>
                      )}
                      {filteredReagents.map(r => {
                        function rCell(col, style, display) {
                          const isEd = editCell?.tbl === 'reagent' && editCell?.id === r.id && editCell?.col === col;
                          return isEd ? (
                            <td key={col} style={{ padding: 0, background: '#FFF9C4' }}>
                              <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitReagentEdit} onKeyDown={e => { if (e.key === 'Enter') commitReagentEdit(); if (e.key === 'Escape') setEditCell(null); }} style={{ width: '100%', border: 'none', padding: '10px 12px', outline: 'none', fontSize: '13px', background: 'transparent', textAlign: style.textAlign || 'left', boxSizing: 'border-box' }} />
                            </td>
                          ) : (
                            <td key={col} onClick={() => { setEditCell({ tbl: 'reagent', id: r.id, col }); setEditVal(r[col] != null ? String(r[col]) : ''); }} style={{ padding: '10px 12px', cursor: 'pointer', ...style }} title="Click to edit">
                              {display}
                            </td>
                          );
                        }
                        return (
                          <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                            {rCell('name',            { fontSize: '13px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, r.name)}
                            {rCell('vendor',          { fontSize: '12px', color: 'var(--text-secondary)' }, r.vendor)}
                            {rCell('catalog_number',  { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }, r.catalog_number)}
                            {rCell('category',        { fontSize: '12px', color: 'var(--text-secondary)' }, r.category)}
                            {rCell('quantity_in_lab', { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }, r.quantity_in_lab ?? '—')}
                            {rCell('fy24_purchases',  { fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }, r.fy24_purchases ?? '—')}
                            {rCell('fy25_purchases',  { fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }, r.fy25_purchases ?? '—')}
                            {rCell('fy26_purchases',  { fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }, r.fy26_purchases ?? '—')}
                          </tr>
                        );
                      })}
                      <tr>
                        <td colSpan={8} style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
                          <button onClick={addReagentRow} style={{ padding: '5px 12px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>+ Add Reagent</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                );
              })()}

              {reagentTab === 'nanoseq' && (() => {
                const q = reagentSearch.toLowerCase();
                const filteredNanoseq = q
                  ? nanoseq.filter(r => ['protocol','name','company','code','amount'].some(k => r[k] != null && String(r[k]).toLowerCase().includes(q)))
                  : nanoseq;
                return (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {nanoseq.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No Nanoseq reagents loaded yet. Click Import Nanoseq to upload.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: 'var(--bg-secondary)' }}>{['Protocol','Reagent','Company','Code','Cost','Amount','nRxn','Link'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {filteredNanoseq.length === 0 && (
                          <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No reagents match "{reagentSearch}"</td></tr>
                        )}
                        {filteredNanoseq.map(r => <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.protocol}</td><td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.company}</td><td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.code}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-primary)' }}>{r.cost ? `$${r.cost.toLocaleString()}` : '—'}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>{r.amount}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>{r.n_reactions ?? '—'}</td><td style={{ padding: '10px 12px', fontSize: '12px' }}>{r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple-primary)', textDecoration: 'none', fontSize: '11px' }}>View</a>}</td></tr>)}
                      </tbody>
                    </table>
                  )}
                </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'charts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

              {/* Status by Month — filterable */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                {/* Header row: title + filter button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Status, Complete and Processing</h3>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => { setDraftGrants(selectedGrants); setGrantSearch(''); setGrantFilterOpen(v => !v); }}
                      style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {selectedGrants.length === 0 ? 'All Grants' : `${selectedGrants.length} Grant${selectedGrants.length > 1 ? 's' : ''} Selected`}
                      <span style={{ fontSize: '10px' }}>▼</span>
                    </button>
                    {grantFilterOpen && (
                      <div style={{ position: 'absolute', zIndex: 200, top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', width: '340px', boxShadow: 'var(--shadow-lg)' }}>
                        <input
                          value={grantSearch}
                          onChange={e => setGrantSearch(e.target.value)}
                          placeholder="Search grants…"
                          style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <button onClick={() => setDraftGrants([...GRANT_NAMES])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Select All</button>
                          <button onClick={() => setDraftGrants([])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear</button>
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {filteredGrantOptions.map(g => (
                            <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', cursor: 'pointer', borderRadius: '4px' }}>
                              <input
                                type="checkbox"
                                checked={draftGrants.includes(g)}
                                onChange={e => setDraftGrants(prev => e.target.checked ? [...prev, g] : prev.filter(x => x !== g))}
                              />
                              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{g}</span>
                            </label>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                          <button onClick={() => setGrantFilterOpen(false)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                          <button onClick={() => { setSelectedGrants(draftGrants); setGrantFilterOpen(false); }} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>OK</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chart + table side by side */}
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Chart */}
                  <div style={{ flex: '1 1 480px', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={grantChartData} margin={{ top: 24, right: 16, left: 8, bottom: 20 }} barCategoryGap="35%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555' }} />
                        <YAxis tickFormatter={v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} tick={{ fontSize: 10, fill: '#555' }} width={90} />
                        <Tooltip formatter={(v, name) => [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name === 'complete' ? 'Complete' : 'Processing']} />
                        <Legend verticalAlign="top" height={32} formatter={v => v === 'complete' ? 'complete' : 'processing'} />
                        <Bar dataKey="complete" name="complete" stackId="a" fill="#CC4125" />
                        <Bar dataKey="processing" name="processing" stackId="a" fill="#E9A918" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Pivot table */}
                  <div style={{ flex: '0 1 340px', minWidth: '280px', maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ background: '#9DA9C7' }}>
                          <th style={{ padding: '7px 10px', textAlign: 'left', color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>Date</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600, whiteSpace: 'nowrap' }}>Complete</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600, whiteSpace: 'nowrap' }}>Processing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableMonthRows.map((r, i) => (
                          <tr key={r.month} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white', borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '5px 10px', color: '#1A1A2E', whiteSpace: 'nowrap' }}>{r.month}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', color: '#CC4125' }}>
                              {r.complete > 0 ? `$${r.complete.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                            </td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', color: '#C99000' }}>
                              {r.processing > 0 ? `$${r.processing.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#9DA9C7', borderTop: '2px solid #7A8AB5', fontWeight: 700 }}>
                          <td style={{ padding: '7px 10px', color: 'white' }}>Grand Total</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066' }}>
                            ${tableTotalComplete.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066' }}>
                            {tableTotalProcessing > 0 ? `$${tableTotalProcessing.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* Complete and Processing */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Complete and Processing</h3>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

                  {/* Left 70%: category chart then category table */}
                  <div style={{ flex: '0 0 70%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <ResponsiveContainer width="100%" height={480}>
                      <BarChart data={catStatusData} margin={{ top: 24, right: 16, left: 16, bottom: 100 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#555' }} angle={-45} textAnchor="end" interval={0} />
                        <YAxis tickFormatter={v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} tick={{ fontSize: 11, fill: '#555' }} />
                        <Tooltip formatter={(v, name) => [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name === 'complete' ? 'Complete' : 'Processing']} />
                        <Legend verticalAlign="top" height={32} formatter={v => v === 'complete' ? 'complete' : 'processing'} />
                        <Bar dataKey="complete" name="complete" stackId="a" fill={CHART_BLUE} />
                        <Bar dataKey="processing" name="processing" stackId="a" fill={CHART_RED} radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#9DA9C7' }}>
                          <th style={{ padding: '7px 10px', textAlign: 'left', color: 'white', fontWeight: 600, fontStyle: 'italic' }}>SUM of Total price<br /><span style={{ fontStyle: 'normal' }}>Category</span></th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600 }}>complete</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600 }}>processing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catStatusData.map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white' }}>
                            <td style={{ padding: '5px 10px', color: '#1A1A2E' }}>{row.name}</td>
                            {['complete', 'processing'].map(col => (
                              <td key={col} style={{ padding: '5px 10px', textAlign: 'right', color: col === 'complete' ? CHART_BLUE : CHART_RED }}>
                                {row[col] > 0 ? `$${row[col].toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Right 30%: totals chart then totals table */}
                  <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <ResponsiveContainer width="100%" height={480}>
                      <BarChart data={totalsChartData} margin={{ top: 28, right: 8, left: 8, bottom: 20 }} barCategoryGap="40%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#555' }} />
                        <YAxis tickFormatter={v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} tick={{ fontSize: 10, fill: '#555' }} />
                        <Tooltip formatter={(v, name) => [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name]} />
                        <Bar dataKey="value" radius={[2,2,0,0]}>
                          {totalsChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#9DA9C7' }}>
                          <th style={{ padding: '8px 14px', textAlign: 'left', color: '#FFE066', fontWeight: 600 }}>Status</th>
                          <th style={{ padding: '8px 14px', textAlign: 'right', color: '#FFE066', fontWeight: 600 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ background: '#F0F3FA' }}>
                          <td style={{ padding: '7px 14px', color: '#1A1A2E' }}>Complete</td>
                          <td style={{ padding: '7px 14px', textAlign: 'right', color: '#1A1A2E' }}>${totalComplete.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style={{ background: 'white' }}>
                          <td style={{ padding: '7px 14px', color: '#1A1A2E' }}>Processing</td>
                          <td style={{ padding: '7px 14px', textAlign: 'right', color: '#1A1A2E' }}>${totalProcessing.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>

              {/* Monthly Spending by Category */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Monthly Spending by Category</h3>
                <ResponsiveContainer width="100%" height={520}>
                  <LineChart data={catData} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555' }} />
                    <YAxis scale="log" domain={[0.9, 250000]} ticks={[1, 10, 100, 1000, 10000, 100000]}
                           tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v.toFixed(0)}`}
                           tick={{ fontSize: 10, fill: '#555' }} width={55} />
                    <Tooltip formatter={(v, name) => v != null ? [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name] : ['-', name]} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }} />
                    {catCats.map(cat => (
                      <Line key={cat} type="linear" dataKey={cat} stroke={CATEGORY_COLORS[cat] || '#888888'}
                            dot={{ r: 3, fill: CATEGORY_COLORS[cat] || '#888888', strokeWidth: 0 }}
                            strokeWidth={1.5} connectNulls={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>

                <div style={{ overflowX: 'auto', marginTop: '24px' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: '11px', minWidth: '900px', width: '100%' }}>
                    <thead>
                      <tr style={{ background: '#9DA9C7' }}>
                        <th style={{ padding: '7px 10px', textAlign: 'left', color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>Category</th>
                        {catMonths.map(m => <th key={m} style={{ padding: '7px 8px', textAlign: 'right', color: '#FFE066', fontWeight: 600, whiteSpace: 'nowrap' }}>{m}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {catCats.map((cat, i) => (
                        <tr key={cat} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white' }}>
                          <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                            <span style={{ backgroundColor: CATEGORY_COLORS[cat] || '#888888', width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                            <span style={{ color: '#1A1A2E', verticalAlign: 'middle' }}>{cat}</span>
                          </td>
                          {catMonths.map((m, mi) => {
                            const val = catData[mi]?.[cat];
                            return (
                              <td key={m} style={{ padding: '5px 8px', textAlign: 'right', color: '#1A1A2E' }}>
                                {val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Spending by Category — single chart with dropdown */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Spending by Category</h3>
                  <select
                    value={selectedSubChart}
                    onChange={e => setSelectedSubChart(e.target.value)}
                    style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    {subCharts.map(({ title }) => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </div>
                {(() => {
                  const chart = subCharts.find(c => c.title === selectedSubChart) || subCharts[0];
                  return (
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={chart.data} margin={{ top: 16, right: 16, left: 8, bottom: 20 }} barCategoryGap="35%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555' }} />
                        <YAxis tickFormatter={v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} tick={{ fontSize: 10, fill: '#555' }} width={80} />
                        <Tooltip formatter={v => v != null ? [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, chart.title] : ['-', chart.title]} />
                        <Bar dataKey="value" fill={CHART_BLUE} radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
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
              {[{label:'Item Name',key:'item',full:true},{label:'Catalog Number',key:'catalog_number'},{label:'Category',key:'category'},{label:'Requisition ID',key:'requisition_id'},{label:'Unit Description',key:'unit_description'},{label:'Unit Price ($)',key:'unit_price',type:'number'},{label:'Units',key:'units',type:'number'},{label:'Order Date',key:'order_date',type:'date'},{label:'Requestor',key:'requestor'}].map(field => (
                <div key={field.key} style={{ gridColumn: field.full ? '1 / -1' : 'auto' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}</label>
                  <input type={field.type || 'text'} value={newOrder[field.key]} onChange={e => setNewOrder(p => ({ ...p, [field.key]: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grant</label>
                <input list="order-grant-list" value={newOrder.grant_name} onChange={e => setNewOrder(p => ({ ...p, grant_name: e.target.value }))} placeholder="Select or type grant..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                <datalist id="order-grant-list">
                  {grants.map(g => <option key={g.id} value={g.name} />)}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendor</label>
                <input list="order-vendor-list" value={newOrder.vendor} onChange={e => setNewOrder(p => ({ ...p, vendor: e.target.value }))} placeholder="Select or type vendor..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                <datalist id="order-vendor-list">
                  {vendors.map(v => <option key={v.id} value={v.name} />)}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                <select value={newOrder.status} onChange={e => setNewOrder(p => ({ ...p, status: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="pending">Pending</option><option value="processing">Processing</option><option value="complete">Complete</option><option value="cancelled">Cancelled</option>
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
