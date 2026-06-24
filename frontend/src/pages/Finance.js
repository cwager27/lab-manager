import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Upload, Plus, Search, CheckCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Legend, Cell } from 'recharts';

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

const MONTHS = ["Aug '25","Sep '25","Oct '25","Nov '25","Dec '25","Jan '26","Feb '26","Mar '26","Apr '26","May '26","Jun '26"];

function getCatMonthlyData(cat) {
  return MONTHS.map(m => {
    const row = perCategoryData.find(r => r.month === m);
    const val = row != null ? row[cat] : undefined;
    return { month: m, value: val != null ? val : null };
  });
}

const perCategoryData = [
  { month: "Aug '25", 'Disposable Supplies': 11046.81, 'General Lab Chemicals': 661.65, Shipping: 128.30, 'Specialized Reagents, Kits, Supplies': 11311.50, Subcapital: 915.77, 'Tissue Culture Reagents': 990.17 },
  { month: "Sep '25", Antibodies: 1340.60, 'Biological materials/specimens': 1.00, Capital: 1.00, 'Cell Line': 1.00, Cores: 1.00, 'CR/CO': 1.00, 'Disposable Supplies': 512.33, 'General Lab Chemicals': 1.00, 'Meals and fun': 1.00, 'Proteins and enzymes': 1.00, 'Sequence-Based Reagents': 18.57, Shipping: 254.00, 'Specialized Reagents, Kits, Supplies': 1959.80, Subcapital: 1.00, Subscriptions: 1.00, 'Tissue Culture Reagents': 1.00, 'Travel & Conferences': 1.00 },
  { month: "Oct '25", Antibodies: 158.65, Cores: 13822.51, 'General Lab Chemicals': 661.90, 'Proteins and enzymes': 3406.61, 'Sequence-Based Reagents': 6.05, Shipping: 322.58, 'Specialized Reagents, Kits, Supplies': 2652.69 },
  { month: "Nov '25", Antibodies: 685.10, 'Biological materials/specimens': 125.19, Cores: 5497.54, 'Disposable Supplies': 634.82, 'General Lab Chemicals': 144.40, 'Meals and fun': 241.15, 'Proteins and enzymes': 108.00, 'Sequence-Based Reagents': 560.58, Shipping: 49.64, 'Specialized Reagents, Kits, Supplies': 3686.41, 'Tissue Culture Reagents': 3847.44, 'Travel & Conferences': 876.60 },
  { month: "Dec '25", Antibodies: 389.50, 'Biological materials/specimens': 115.44, Cores: 342.15, 'CR/CO': 1484.00, 'Disposable Supplies': 334.95, 'General Lab Chemicals': 398.16, 'Meals and fun': 376.48, 'Proteins and enzymes': 4552.58, 'Sequence-Based Reagents': 331.08, Shipping: 520.50, 'Specialized Reagents, Kits, Supplies': 2331.50, Subcapital: 1102.07, 'Travel & Conferences': 37.90 },
  { month: "Jan '26", Cores: 146.27, 'CR/CO': 130.00, 'Disposable Supplies': 662.38, 'General Lab Chemicals': 1352.32, 'Meals and fun': 464.00, 'Sequence-Based Reagents': 911.17, Shipping: 109.00, 'Specialized Reagents, Kits, Supplies': 424.96, Subcapital: 4990.96, 'Tissue Culture Reagents': 156.00, 'Travel & Conferences': 3026.65 },
  { month: "Feb '26", Antibodies: 176.00, Cores: 6.45, 'CR/CO': 101194.00, 'Disposable Supplies': 292.44, 'General Lab Chemicals': 512.48, Shipping: 63.02, 'Specialized Reagents, Kits, Supplies': 383.10, Subscriptions: 125.49, 'Tissue Culture Reagents': 240.00 },
  { month: "Mar '26", Cores: 1011.51, 'CR/CO': 1380.00, 'Disposable Supplies': 245.97, 'General Lab Chemicals': 17.27, 'Meals and fun': 197.33, Shipping: 110.00, 'Specialized Reagents, Kits, Supplies': 915.26, Subcapital: 56.49, 'Travel & Conferences': 1628.35 },
  { month: "Apr '26", Antibodies: 528.95, 'Biological materials/specimens': 200.30, Cores: 593.47, 'Disposable Supplies': 10667.63, 'General Lab Chemicals': 512.12, 'Meals and fun': 295.08, 'Proteins and enzymes': 456.00, 'Sequence-Based Reagents': 1073.90, Shipping: 273.36, 'Specialized Reagents, Kits, Supplies': 6760.64, Subcapital: 603.44, 'Tissue Culture Reagents': 1394.78, 'Travel & Conferences': 1250.09 },
  { month: "May '26", 'Disposable Supplies': 330.00, Shipping: 20.00, 'Specialized Reagents, Kits, Supplies': 942.31, Subcapital: 603.44 },
  { month: "Jun '26", Antibodies: 408.80, 'Biological materials/specimens': 856.00, 'Disposable Supplies': 247.95, 'Meals and fun': 27.12, 'Proteins and enzymes': 60.00, 'Sequence-Based Reagents': 46.04, Shipping: 73.50, 'Specialized Reagents, Kits, Supplies': 801.45 },
];

const labReagentsMonthlyData = [
  { month: "Aug '25", value: 11973.15 },
  { month: "Sep '25", value: 1363.17 },
  { month: "Oct '25", value: 826.60 },
  { month: "Nov '25", value: 1756.42 },
  { month: "Dec '25", value: 3094.66 },
  { month: "Jan '26", value: null },
  { month: "Feb '26", value: null },
  { month: "Mar '26", value: null },
  { month: "Apr '26", value: null },
  { month: "May '26", value: null },
  { month: "Jun '26", value: null },
];

const SUB_CHARTS = [
  { title: 'Subcapital',              data: getCatMonthlyData('Subcapital') },
  { title: 'Travel & Conferences',   data: getCatMonthlyData('Travel & Conferences') },
  { title: 'Capital',                data: getCatMonthlyData('Capital') },
  { title: 'Meals and fun',          data: getCatMonthlyData('Meals and fun') },
  { title: 'Subscriptions',          data: getCatMonthlyData('Subscriptions') },
  { title: 'Disposable Supplies',    data: getCatMonthlyData('Disposable Supplies') },
  { title: 'Tissue Culture Reagents',data: getCatMonthlyData('Tissue Culture Reagents') },
  { title: 'Shipping',               data: getCatMonthlyData('Shipping') },
  { title: 'CR/CO',                  data: getCatMonthlyData('CR/CO') },
  { title: 'Cores',                  data: getCatMonthlyData('Cores') },
  { title: 'Lab reagents',           data: labReagentsMonthlyData },
];
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

  // Charts data — FY2026 Google Sheets export
  const categoryChartData = [
    { name: 'Antibodies',                          complete: 2749.85,  processing: 937.75    },
    { name: 'Biological materials/specimens',       complete: 352.93,   processing: 945.00    },
    { name: 'Capital',                              complete: 1.00,     processing: 0         },
    { name: 'Cell Line',                            complete: 1.00,     processing: 0         },
    { name: 'Cores',                                complete: 21420.90, processing: 0         },
    { name: 'CR/CO',                                complete: 4189.00,  processing: 100000.00 },
    { name: 'Disposable Supplies',                  complete: 23643.79, processing: 1331.49   },
    { name: 'General Lab Chemicals',                complete: 3995.30,  processing: 293.12    },
    { name: 'Meals and fun',                        complete: 1575.04,  processing: 0         },
    { name: 'Proteins and enzymes',                 complete: 8584.19,  processing: 0         },
    { name: 'Sequence-Based Reagents',              complete: 2106.67,  processing: 840.72    },
    { name: 'Shipping',                             complete: 1751.40,  processing: 172.50    },
    { name: 'Specialized Reagents, Kits, Supplies', complete: 31146.57, processing: 1023.05   },
    { name: 'Subcapital',                           complete: 7669.73,  processing: 603.44    },
    { name: 'Subscriptions',                        complete: 126.49,   processing: 0         },
    { name: 'Tissue Culture Reagents',              complete: 6629.39,  processing: 0         },
    { name: 'Travel & Conferences',                 complete: 6781.49,  processing: 39.10     },
  ];
  const totalComplete   = 122724.74;
  const totalProcessing = 106186.17;
  const totalsChartData = [
    { name: 'Complete',   value: totalComplete,   fill: CHART_BLUE },
    { name: 'Processing', value: totalProcessing, fill: CHART_RED  },
  ];

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

              {/* Complete and Processing */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Complete and Processing</h3>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

                  {/* Left 70%: category chart then category table */}
                  <div style={{ flex: '0 0 70%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <ResponsiveContainer width="100%" height={480}>
                      <BarChart data={categoryChartData} margin={{ top: 24, right: 16, left: 16, bottom: 100 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#555' }} angle={-45} textAnchor="end" interval={0} />
                        <YAxis tickFormatter={v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} tick={{ fontSize: 11, fill: '#555' }} />
                        <Tooltip formatter={(v, name) => [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name === 'complete' ? 'Complete' : 'Processing']} />
                        <Legend verticalAlign="top" height={32} formatter={v => v === 'complete' ? 'complete' : 'processing'} />
                        <Bar dataKey="complete" name="complete" stackId="a" fill={CHART_BLUE}>
                          <LabelList dataKey="complete" position="insideTop" formatter={v => v > 0 ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''} style={{ fontSize: 9, fill: CHART_BLUE }} />
                        </Bar>
                        <Bar dataKey="processing" name="processing" stackId="a" fill={CHART_RED} radius={[2,2,0,0]}>
                          <LabelList dataKey="processing" position="top" formatter={v => v > 0 ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''} style={{ fontSize: 9, fill: CHART_RED }} />
                        </Bar>
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
                        {categoryChartData.map((row, i) => (
                          <tr key={row.name} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white' }}>
                            <td style={{ padding: '5px 10px', color: '#1A1A2E' }}>{row.name}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', color: CHART_BLUE }}>{row.complete > 0 ? `$${row.complete.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', color: CHART_RED }}>{row.processing > 0 ? `$${row.processing.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
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
                          <LabelList dataKey="value" position="top" formatter={v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} style={{ fontSize: 11, fontWeight: 600 }} />
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
                  <LineChart data={perCategoryData} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555' }} />
                    <YAxis scale="log" domain={[0.9, 250000]} ticks={[1, 10, 100, 1000, 10000, 100000]}
                           tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v.toFixed(0)}`}
                           tick={{ fontSize: 10, fill: '#555' }} width={55} />
                    <Tooltip formatter={(v, name) => v != null ? [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name] : ['-', name]} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }} />
                    {CATEGORIES.map(cat => (
                      <Line key={cat} type="linear" dataKey={cat} stroke={CATEGORY_COLORS[cat]}
                            dot={{ r: 3, fill: CATEGORY_COLORS[cat], strokeWidth: 0 }}
                            strokeWidth={1.5} connectNulls={false}>
                        <LabelList dataKey={cat} position="top"
                                   formatter={v => v != null ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
                                   style={{ fontSize: 7, fill: CATEGORY_COLORS[cat] }} />
                      </Line>
                    ))}
                  </LineChart>
                </ResponsiveContainer>

                <div style={{ overflowX: 'auto', marginTop: '24px' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: '11px', minWidth: '900px', width: '100%' }}>
                    <thead>
                      <tr style={{ background: '#9DA9C7' }}>
                        <th style={{ padding: '7px 10px', textAlign: 'left', color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>Category</th>
                        {MONTHS.map(m => <th key={m} style={{ padding: '7px 8px', textAlign: 'right', color: '#FFE066', fontWeight: 600, whiteSpace: 'nowrap' }}>{m}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {CATEGORIES.map((cat, i) => (
                          <tr key={cat} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white' }}>
                            <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                              <span style={{ backgroundColor: CATEGORY_COLORS[cat], width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                              <span style={{ color: '#1A1A2E', verticalAlign: 'middle' }}>{cat}</span>
                            </td>
                            {MONTHS.map(m => {
                              const row = perCategoryData.find(r => r.month === m);
                              const val = row ? row[cat] : undefined;
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

              {/* Individual Category Bar Charts */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>Spending by Category</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 24px' }}>
                  {SUB_CHARTS.map(({ title, data }) => (
                    <div key={title}>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{title}</p>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={data} margin={{ top: 22, right: 8, left: 8, bottom: 64 }} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#555' }} angle={-45} textAnchor="end" interval={0} />
                          <YAxis tickFormatter={v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} tick={{ fontSize: 9, fill: '#555' }} width={75} />
                          <Tooltip formatter={v => v != null ? [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, title] : ['-', title]} />
                          <Bar dataKey="value" fill={CHART_BLUE} radius={[2,2,0,0]}>
                            <LabelList dataKey="value" position="top" formatter={v => v != null ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''} style={{ fontSize: 9, fill: CHART_BLUE }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ))}
                </div>
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
