import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Upload, Plus, Search, CheckCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import Vendors from './Vendors';
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


const STATUS_STYLES = {
  complete: { bg: '#EAF7F0', text: '#27AE60', label: 'Complete' },
  pending: { bg: '#FEF9E7', text: '#F39C12', label: 'Pending' },
  cancelled: { bg: '#FDEDEC', text: '#E74C3C', label: 'Cancelled' },
  deleted: { bg: '#F2F2F2', text: '#9E9E9E', label: 'Deleted' },
};

const EMPTY_GRANT = { name: '', chartstring: '', total_amount: '', remaining_balance: '', start_date: '', end_date: '', notes: '' };

function grantMeta(grant) {
  const pct = grant.total_amount && grant.remaining_balance != null
    ? (grant.remaining_balance / grant.total_amount) * 100 : null;
  const daysLeft = grant.end_date
    ? Math.ceil((new Date(grant.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const isCritical = pct !== null && pct < 10;
  const isLow = pct !== null && pct < 25;
  const isExpiringUrgent = daysLeft !== null && daysLeft <= 14;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 90;
  const balanceColor = isCritical ? '#E74C3C' : isLow ? '#F39C12' : '#27AE60';
  return { pct, daysLeft, isCritical, isLow, isExpiringUrgent, isExpiringSoon, balanceColor };
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
  const [addOrderError, setAddOrderError] = useState('');
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
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [draftCategories, setDraftCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');
  const chartData = useMemo(() => {
    const real = orders.filter(o => o.item && o.item.trim() !== '' && o.status !== 'deleted');

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

    // grant names sorted by total spend descending
    const grantSpend = {};
    real.forEach(o => {
      if (o.grant_name && o.total_price != null) {
        grantSpend[o.grant_name] = (grantSpend[o.grant_name] || 0) + Number(o.total_price);
      }
    });
    const grantNames = Object.keys(grantSpend).sort((a, b) => grantSpend[b] - grantSpend[a]);

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

    return { months, catData, catStatusData, grantNames, byGrant };
  }, [orders]);

  const { months: MONTHS, catData, catStatusData, grantNames: GRANT_NAMES, byGrant: ordersDataByGrant } = chartData;

  const [vendors, setVendors] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editOrderForm, setEditOrderForm] = useState({});
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(false);
  const [ordersSortCol, setOrdersSortCol] = useState(null);
  const [ordersSortDir, setOrdersSortDir] = useState('asc');
  const [showAddGrant, setShowAddGrant] = useState(false);
  const [grantForm, setGrantForm] = useState(EMPTY_GRANT);
  const [editingGrant, setEditingGrant] = useState(null);
  const [editGrantForm, setEditGrantForm] = useState({});
  const [confirmDeleteGrant, setConfirmDeleteGrant] = useState(false);
  const [reagentsSortCol, setReagentsSortCol] = useState(null);
  const [reagentsSortDir, setReagentsSortDir] = useState('asc');
  const [showAddReagent, setShowAddReagent] = useState(false);
  const [reagentForm, setReagentForm] = useState({ name: '', vendor: '', catalog_number: '', category: '', quantity_in_lab: '', fy24_purchases: '', fy25_purchases: '', fy26_purchases: '' });
  const [editingReagent, setEditingReagent] = useState(null);
  const [editReagentForm, setEditReagentForm] = useState({});
  const [confirmDeleteReagent, setConfirmDeleteReagent] = useState(false);

  const canManage = userRole === 'admin' || userRole === 'pm';

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: grantData }, { data: orderData }, { data: reagentData }, { data: nanoseqData }, { data: vendorData }] = await Promise.all([
      supabase.from('grants').select('*').order('name'),
      supabase.from('orders').select('*').order('order_date', { ascending: false }),
      supabase.from('reagents').select('*').order('category').order('name'),
      supabase.from('nanoseq_reagents').select('*').order('protocol').order('name'),
      supabase.from('vendors').select('*').order('name'),
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
    setAddOrderError('');
    const REQUIRED_FIELDS = [
      ['item', 'Item Name'], ['vendor', 'Vendor'], ['catalog_number', 'Catalog Number'],
      ['category', 'Category'], ['grant_name', 'Grant'], ['requisition_id', 'Requisition ID'],
      ['unit_description', 'Unit Description'], ['unit_price', 'Unit Price'],
      ['units', 'Units'], ['order_date', 'Order Date'],
    ];
    const missing = REQUIRED_FIELDS.filter(([key]) => !String(newOrder[key] ?? '').trim()).map(([, label]) => label);
    if (missing.length > 0) {
      setAddOrderError(`Please fill in: ${missing.join(', ')}`);
      return;
    }
    const toInsert = {
      ...newOrder,
      unit_price: parseFloat(newOrder.unit_price) || null,
      units: parseInt(newOrder.units) || null,
      total_price: parseFloat(newOrder.unit_price) * parseInt(newOrder.units),
      order_date: newOrder.order_date || null,
    };
    const { data, error } = await supabase.from('orders').insert([toInsert]).select().single();
    if (!error && data) {
      setOrders(prev => [...prev, data]);
      setShowAddOrder(false);
      setAddOrderError('');
      setNewOrder({ item: '', vendor: '', catalog_number: '', category: '', grant_name: '', requisition_id: '', unit_description: '', unit_price: '', units: '', order_date: '', requestor: '', status: 'pending', notes: '' });
    } else if (error) {
      setAddOrderError(error.message);
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

  const catMonths = catData.map(r => r.month);

  async function commitOrderSelectEdit(id, col, value) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, [col]: value } : o));
    await supabase.from('orders').update({ [col]: value }).eq('id', id);
  }

  function openEditOrder(order) {
    setConfirmDeleteOrder(false);
    setEditingOrder(order);
    setEditOrderForm({
      item: order.item || '',
      vendor: order.vendor || '',
      catalog_number: order.catalog_number || '',
      category: order.category || '',
      grant_name: order.grant_name || '',
      requisition_id: order.requisition_id || '',
      unit_description: order.unit_description || '',
      unit_price: order.unit_price != null ? String(order.unit_price) : '',
      units: order.units != null ? String(order.units) : '',
      total_price: order.total_price != null ? String(order.total_price) : '',
      order_date: order.order_date || '',
      requestor: order.requestor || '',
      status: order.status || 'pending',
      notes: order.notes || '',
    });
  }

  async function saveEditOrder() {
    if (!editingOrder) return;
    const updated = {
      item: editOrderForm.item,
      vendor: editOrderForm.vendor,
      catalog_number: editOrderForm.catalog_number,
      category: editOrderForm.category,
      grant_name: editOrderForm.grant_name,
      requisition_id: editOrderForm.requisition_id,
      unit_description: editOrderForm.unit_description,
      unit_price: parseFloat(editOrderForm.unit_price) || null,
      units: parseInt(editOrderForm.units) || null,
      total_price: parseFloat(editOrderForm.total_price) || null,
      order_date: editOrderForm.order_date || null,
      requestor: editOrderForm.requestor,
      status: editOrderForm.status,
      notes: editOrderForm.notes,
    };
    await supabase.from('orders').update(updated).eq('id', editingOrder.id);
    setOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, ...updated } : o));
    setEditingOrder(null);
  }

  async function handleDeleteOrder() {
    if (!editingOrder) return;
    await supabase.from('orders').update({ status: 'deleted' }).eq('id', editingOrder.id);
    setOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, status: 'deleted' } : o));
    setEditingOrder(null);
    setConfirmDeleteOrder(false);
  }

  async function handleReinstateOrder() {
    if (!editingOrder) return;
    await supabase.from('orders').update({ status: 'pending' }).eq('id', editingOrder.id);
    setOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, status: 'pending' } : o));
    setEditingOrder(null);
  }

  async function handleAddGrant(e) {
    e.preventDefault();
    if (!grantForm.name.trim()) return;
    const payload = {
      name: grantForm.name.trim(),
      chartstring: grantForm.chartstring || null,
      total_amount: grantForm.total_amount ? parseFloat(grantForm.total_amount) : null,
      remaining_balance: grantForm.remaining_balance ? parseFloat(grantForm.remaining_balance) : null,
      start_date: grantForm.start_date || null,
      end_date: grantForm.end_date || null,
      notes: grantForm.notes || null,
    };
    const { data, error } = await supabase.from('grants').insert([payload]).select().single();
    if (!error && data) {
      setGrants(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAddGrant(false);
      setGrantForm(EMPTY_GRANT);
    }
  }

  function openEditGrant(grant) {
    setConfirmDeleteGrant(false);
    setEditingGrant(grant);
    setEditGrantForm({
      name: grant.name || '',
      chartstring: grant.chartstring || '',
      total_amount: grant.total_amount != null ? String(grant.total_amount) : '',
      remaining_balance: grant.remaining_balance != null ? String(grant.remaining_balance) : '',
      start_date: grant.start_date || '',
      end_date: grant.end_date || '',
      notes: grant.notes || '',
    });
  }

  async function handleSaveGrant() {
    const payload = {
      name: editGrantForm.name.trim(),
      chartstring: editGrantForm.chartstring || null,
      total_amount: editGrantForm.total_amount ? parseFloat(editGrantForm.total_amount) : null,
      remaining_balance: editGrantForm.remaining_balance ? parseFloat(editGrantForm.remaining_balance) : null,
      start_date: editGrantForm.start_date || null,
      end_date: editGrantForm.end_date || null,
      notes: editGrantForm.notes || null,
    };
    await supabase.from('grants').update(payload).eq('id', editingGrant.id);
    setGrants(prev => prev.map(g => g.id === editingGrant.id ? { ...g, ...payload } : g));
    setEditingGrant(null);
  }

  async function handleDeleteGrant() {
    await supabase.from('grants').delete().eq('id', editingGrant.id);
    setGrants(prev => prev.filter(g => g.id !== editingGrant.id));
    setEditingGrant(null);
    setConfirmDeleteGrant(false);
  }

  const EMPTY_REAGENT_FORM = { name: '', vendor: '', catalog_number: '', category: '', quantity_in_lab: '', fy24_purchases: '', fy25_purchases: '', fy26_purchases: '' };

  async function handleAddReagent(e) {
    e.preventDefault();
    if (!reagentForm.name.trim()) return;
    const numF = v => v !== '' ? parseFloat(v) : null;
    const payload = { name: reagentForm.name.trim(), vendor: reagentForm.vendor || null, catalog_number: reagentForm.catalog_number || null, category: reagentForm.category || null, quantity_in_lab: numF(reagentForm.quantity_in_lab), fy24_purchases: numF(reagentForm.fy24_purchases), fy25_purchases: numF(reagentForm.fy25_purchases), fy26_purchases: numF(reagentForm.fy26_purchases) };
    const { data, error } = await supabase.from('reagents').insert([payload]).select().single();
    if (!error && data) { setReagents(prev => [...prev, data]); setShowAddReagent(false); setReagentForm(EMPTY_REAGENT_FORM); }
  }

  function openEditReagent(r) {
    setConfirmDeleteReagent(false);
    setEditingReagent(r);
    setEditReagentForm({ name: r.name || '', vendor: r.vendor || '', catalog_number: r.catalog_number || '', category: r.category || '', quantity_in_lab: r.quantity_in_lab != null ? String(r.quantity_in_lab) : '', fy24_purchases: r.fy24_purchases != null ? String(r.fy24_purchases) : '', fy25_purchases: r.fy25_purchases != null ? String(r.fy25_purchases) : '', fy26_purchases: r.fy26_purchases != null ? String(r.fy26_purchases) : '' });
  }

  async function handleSaveReagent() {
    const numF = v => v !== '' ? parseFloat(v) : null;
    const payload = { name: editReagentForm.name.trim(), vendor: editReagentForm.vendor || null, catalog_number: editReagentForm.catalog_number || null, category: editReagentForm.category || null, quantity_in_lab: numF(editReagentForm.quantity_in_lab), fy24_purchases: numF(editReagentForm.fy24_purchases), fy25_purchases: numF(editReagentForm.fy25_purchases), fy26_purchases: numF(editReagentForm.fy26_purchases) };
    await supabase.from('reagents').update(payload).eq('id', editingReagent.id);
    setReagents(prev => prev.map(r => r.id === editingReagent.id ? { ...r, ...payload } : r));
    setEditingReagent(null);
  }

  async function handleDeleteReagent() {
    await supabase.from('reagents').delete().eq('id', editingReagent.id);
    setReagents(prev => prev.filter(r => r.id !== editingReagent.id));
    setEditingReagent(null); setConfirmDeleteReagent(false);
  }

  function handleExportReagents() {
    const rows = sortedReagents.map(r => ({ 'Name': r.name||'', 'Vendor': r.vendor||'', 'Catalog #': r.catalog_number||'', 'Category': r.category||'', 'In Lab': r.quantity_in_lab??'', 'FY24': r.fy24_purchases??'', 'FY25': r.fy25_purchases??'', 'FY26': r.fy26_purchases??'' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reagents');
    XLSX.writeFile(wb, `reagents_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function handleReagentTemplate() {
    const ws = XLSX.utils.json_to_sheet([{ 'Name': '', 'Vendor': '', 'Catalog #': '', 'Category': '', 'In Lab': '', 'FY24': '', 'FY25': '', 'FY26': '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reagents');
    XLSX.writeFile(wb, 'reagents_import_template.xlsx');
  }


  const sortedReagents = useMemo(() => {
    const q = reagentSearch.toLowerCase();
    const filtered = q ? reagents.filter(r => ['name','vendor','catalog_number','category'].some(k => r[k] != null && String(r[k]).toLowerCase().includes(q))) : reagents;
    if (!reagentsSortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let av = a[reagentsSortCol], bv = b[reagentsSortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return reagentsSortDir === 'asc' ? cmp : -cmp;
    });
  }, [reagents, reagentSearch, reagentsSortCol, reagentsSortDir]);

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
  const activeCats = selectedCategories.length === 0 ? CATEGORIES : selectedCategories;
  const filteredCategoryOptions = CATEGORIES.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));
  const filteredGrantOptions = GRANT_NAMES.filter(g => g.toLowerCase().includes(grantSearch.toLowerCase()));
  const tableMonthRows = MONTHS.map(m => {
    const complete   = activeGrants.reduce((sum, g) => sum + (ordersDataByGrant[g]?.[m]?.complete   || 0), 0);
    const processing = activeGrants.reduce((sum, g) => sum + (ordersDataByGrant[g]?.[m]?.processing || 0), 0);
    return { month: m, complete, processing };
  }).filter(r => r.complete > 0 || r.processing > 0);
  const tableTotalComplete   = tableMonthRows.reduce((s, r) => s + r.complete,   0);
  const tableTotalProcessing = tableMonthRows.reduce((s, r) => s + r.processing, 0);

  const filteredOrders = orders.filter(o => searchQuery === '' || o.item?.toLowerCase().includes(searchQuery.toLowerCase()) || o.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) || o.requisition_id?.toLowerCase().includes(searchQuery.toLowerCase()));

  const sortedOrders = useMemo(() => {
    if (!ordersSortCol) return filteredOrders;
    return [...filteredOrders].sort((a, b) => {
      let av = a[ordersSortCol], bv = b[ordersSortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv : String(av).localeCompare(String(bv));
      return ordersSortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredOrders, ordersSortCol, ordersSortDir]);

  function handleExportOrders() {
    const rows = sortedOrders.map(o => ({
      'Item': o.item || '',
      'Vendor': o.vendor || '',
      'Catalog Number': o.catalog_number || '',
      'Category': o.category || '',
      'Grant ID': o.grant_name || '',
      'Requisition ID': o.requisition_id || '',
      'Unit Description': o.unit_description || '',
      'Unit Price': o.unit_price ?? '',
      'Units (n)': o.units ?? '',
      'Total Price': o.total_price ?? '',
      'Date': o.order_date || '',
      'Requestor': o.requestor || '',
      'Status': o.status || '',
      'Notes': o.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function handleDownloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([{
      'Item': '', 'Vendor': '', 'Catalog Number': '', 'Category': '',
      'Grant ID': '', 'Requisition ID': '', 'Unit description': '',
      'Unit price': '', 'Units (n)': '', 'Total price': '',
      'Date': 'YYYY-MM-DD', 'Requestor': '', 'Status': 'pending', 'Notes': '',
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, 'orders_import_template.xlsx');
  }
  const totalSpend = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const alertGrants = grants.filter(g => { const pct = g.total_amount && g.remaining_balance ? (g.remaining_balance / g.total_amount) * 100 : null; const daysLeft = g.end_date ? Math.ceil((new Date(g.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null; return (pct !== null && pct < 25) || (daysLeft !== null && daysLeft <= 90); });


  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Finance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Grants, orders, and reagent tracking</p>
        </div>
        <div />
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
          {['grants', 'orders', 'reagents', 'vendors', 'charts'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 20px', background: activeTab === tab ? 'var(--purple-primary)' : 'transparent', color: activeTab === tab ? 'white' : 'var(--text-secondary)', border: 'none', fontWeight: activeTab === tab ? 600 : 400, fontSize: '13px', textTransform: 'capitalize' }}>
              {tab === 'reagents' ? 'Standardized Reagents' : tab}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {canManage && activeTab === 'grants' && (
            <button onClick={() => { setGrantForm(EMPTY_GRANT); setShowAddGrant(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}><Plus size={16} /> Add Grant</button>
          )}
          {activeTab === 'orders' && (
            <button onClick={handleExportOrders} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
              <Download size={14} /> Export
            </button>
          )}
          {canManage && activeTab === 'orders' && (
            <>
              <button onClick={handleDownloadTemplate} title="Download blank import template" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                Template
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                <Upload size={14} /> {uploadingFile ? 'Processing…' : 'Import'}
                <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files[0]; if (!file) return;
                  setUploadingFile(true);
                  const formData = new FormData(); formData.append('file', file);
                  const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/preview-orders`, { method: 'POST', body: formData });
                  const data = await res.json();
                  if (data.newOrders) setPreviewData(data.newOrders);
                  setUploadingFile(false);
                  e.target.value = '';
                }} />
              </label>
              <button onClick={() => setShowAddOrder(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}><Plus size={16} /> Add Order</button>
            </>
          )}
          {activeTab === 'reagents' && reagentTab === 'misc' && (
            <button onClick={handleExportReagents} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
              <Download size={14} /> Export
            </button>
          )}
          {canManage && activeTab === 'reagents' && reagentTab === 'misc' && (
            <>
              <button onClick={handleReagentTemplate} title="Download blank import template" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>Template</button>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                <Upload size={14} /> {uploadingFile ? 'Processing…' : 'Import'}
                <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files[0]; if (!file) return;
                  setUploadingFile(true);
                  const formData = new FormData(); formData.append('file', file);
                  const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/preview-reagents`, { method: 'POST', body: formData });
                  const data = await res.json();
                  if (data.newReagents) setPreviewReagents(data.newReagents);
                  setUploadingFile(false); e.target.value = '';
                }} />
              </label>
              <button onClick={() => { setReagentForm(EMPTY_REAGENT_FORM); setShowAddReagent(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}><Plus size={16} /> Add Reagent</button>
            </>
          )}
          {canManage && activeTab === 'reagents' && reagentTab === 'nanoseq' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
              <Upload size={14} /> {uploadingFile ? 'Processing…' : 'Import Nanoseq'}
              <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files[0]; if (!file) return;
                setUploadingFile(true);
                const formData = new FormData(); formData.append('file', file);
                const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/preview-nanoseq`, { method: 'POST', body: formData });
                const data = await res.json();
                if (data.newNanoseq) setPreviewNanoseq(data.newNanoseq);
                setUploadingFile(false); e.target.value = '';
              }} />
            </label>
          )}
        </div>
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
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
              <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Grant', 'Chartering', 'Flags', 'Total', 'Balance Remaining', 'Start Date', 'End Date', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grants.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No grants yet.{canManage ? ' Click "Add Grant" to add one.' : ''}</td></tr>
                  ) : grants.map((grant, i) => {
                    const { pct, daysLeft, isCritical, isLow, isExpiringUrgent, isExpiringSoon, balanceColor } = grantMeta(grant);
                    return (
                      <tr key={grant.id}
                        onClick={canManage ? () => openEditGrant(grant) : undefined}
                        style={{ borderTop: '1px solid var(--border)', cursor: canManage ? 'pointer' : 'default', background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}
                        onMouseEnter={canManage ? e => e.currentTarget.style.background = 'rgba(123,63,160,0.04)' : undefined}
                        onMouseLeave={canManage ? e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' : undefined}
                      >
                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{grant.name}</td>
                        <td style={{ padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{grant.chartstring || '—'}</td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {isCritical && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#FDEDEC', color: '#E74C3C' }}>Critical</span>}
                            {isLow && !isCritical && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#FEF9E7', color: '#F39C12' }}>Low</span>}
                            {isExpiringUrgent && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#FDEDEC', color: '#E74C3C' }}>{daysLeft}d left</span>}
                            {isExpiringSoon && !isExpiringUrgent && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#FEF9E7', color: '#F39C12' }}>{daysLeft}d left</span>}
                            {!isCritical && !isLow && !isExpiringUrgent && !isExpiringSoon && pct !== null && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#EAF7F0', color: '#27AE60' }}>Good</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {grant.total_amount != null ? `$${grant.total_amount.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', minWidth: '170px' }}>
                          {grant.remaining_balance != null ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: balanceColor }}>${grant.remaining_balance.toLocaleString()}</span>
                                {pct !== null && <span style={{ fontSize: '11px', fontWeight: 600, color: balanceColor, marginLeft: '8px' }}>{pct.toFixed(1)}%</span>}
                              </div>
                              {pct !== null && (
                                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${Math.min(Math.max(pct, 0), 100)}%`, background: balanceColor, borderRadius: '3px' }} />
                                </div>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{grant.start_date || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: isExpiringUrgent ? '#E74C3C' : 'var(--text-secondary)', fontWeight: isExpiringUrgent ? 600 : 400, whiteSpace: 'nowrap' }}>{grant.end_date || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grant.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'orders' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search orders..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sortedOrders.length} orders</span>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
                <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      {[
                        { label: 'Item', key: 'item' },
                        { label: 'Vendor', key: 'vendor' },
                        { label: 'Category', key: 'category' },
                        { label: 'Grant', key: 'grant_name' },
                        { label: 'Req ID', key: 'requisition_id' },
                        { label: 'Price', key: 'total_price' },
                        { label: 'Date', key: 'order_date' },
                        { label: 'Requestor', key: 'requestor' },
                        { label: 'Status', key: 'status' },
                      ].map(({ label, key }) => (
                        <th key={key}
                          onClick={() => {
                            if (ordersSortCol === key) setOrdersSortDir(d => d === 'asc' ? 'desc' : 'asc');
                            else { setOrdersSortCol(key); setOrdersSortDir('asc'); }
                          }}
                          style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: ordersSortCol === key ? 'var(--purple-primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                          {label}{ordersSortCol === key ? (ordersSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map(order => {
                      const isDeleted = order.status === 'deleted';
                      const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                      return (
                        <tr key={order.id} onClick={() => openEditOrder(order)}
                          style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', opacity: isDeleted ? 0.45 : 1 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.item}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{order.vendor}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.category}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--purple-primary)', whiteSpace: 'nowrap' }}>{order.grant_name}</td>
                          <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{order.requisition_id}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{order.total_price != null ? `$${order.total_price.toLocaleString()}` : ''}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{order.order_date}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{order.requestor}</td>
                          <td style={{ padding: '10px 12px' }} onClick={isDeleted ? undefined : e => e.stopPropagation()}>
                            {isDeleted ? (
                              <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: STATUS_STYLES.deleted.bg, color: STATUS_STYLES.deleted.text }}>Deleted</span>
                            ) : (
                              <select value={order.status || 'pending'} onChange={e => commitOrderSelectEdit(order.id, 'status', e.target.value)}
                                style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text, border: 'none', cursor: 'pointer', outline: 'none' }}>
                                <option value="pending">Pending</option>
                                <option value="processing">Processing</option>
                                <option value="complete">Complete</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            )}
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

              {reagentTab === 'misc' && (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        {[['name','Name'],['vendor','Vendor'],['catalog_number','Cat #'],['category','Category'],['quantity_in_lab','In Lab'],['fy24_purchases','FY24'],['fy25_purchases','FY25'],['fy26_purchases','FY26']].map(([key, label]) => (
                          <th key={key} onClick={() => { if (reagentsSortCol === key) { setReagentsSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setReagentsSortCol(key); setReagentsSortDir('asc'); } }} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: reagentsSortCol === key ? 'var(--purple-primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                            {label}{reagentsSortCol === key ? (reagentsSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedReagents.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{reagentSearch ? `No reagents match "${reagentSearch}"` : 'No reagents yet.'}</td></tr>
                      )}
                      {sortedReagents.map(r => (
                        <tr key={r.id} onClick={() => canManage && openEditReagent(r)} style={{ borderTop: '1px solid var(--border)', cursor: canManage ? 'pointer' : 'default' }}
                          onMouseEnter={e => { if (canManage) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.vendor}</td>
                          <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.catalog_number}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.category}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>{r.quantity_in_lab ?? '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>{r.fy24_purchases ?? '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>{r.fy25_purchases ?? '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>{r.fy26_purchases ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

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
                      <thead><tr style={{ background: 'var(--bg-secondary)' }}>{['Protocol','Reagent','Vendor','Code','Cost','Amount','nRxn','Link'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
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

          {activeTab === 'vendors' && <Vendors userRole={userRole} />}

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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Monthly Spending by Category</h3>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => { setDraftCategories(selectedCategories); setCategorySearch(''); setCategoryFilterOpen(v => !v); }}
                      style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {selectedCategories.length === 0 ? 'All Categories' : `${selectedCategories.length} Categor${selectedCategories.length > 1 ? 'ies' : 'y'} Selected`}
                      <span style={{ fontSize: '10px' }}>▼</span>
                    </button>
                    {categoryFilterOpen && (
                      <div style={{ position: 'absolute', zIndex: 200, top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', width: '320px', boxShadow: 'var(--shadow-lg)' }}>
                        <input
                          value={categorySearch}
                          onChange={e => setCategorySearch(e.target.value)}
                          placeholder="Search categories…"
                          style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <button onClick={() => setDraftCategories([...CATEGORIES])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Select All</button>
                          <button onClick={() => setDraftCategories([])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear</button>
                        </div>
                        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {filteredCategoryOptions.map(cat => (
                            <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', cursor: 'pointer', borderRadius: '4px' }}>
                              <input
                                type="checkbox"
                                checked={draftCategories.includes(cat)}
                                onChange={e => setDraftCategories(prev => e.target.checked ? [...prev, cat] : prev.filter(x => x !== cat))}
                              />
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[cat] || '#888888', flexShrink: 0 }} />
                              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{cat}</span>
                            </label>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                          <button onClick={() => setCategoryFilterOpen(false)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                          <button onClick={() => { setSelectedCategories(draftCategories); setCategoryFilterOpen(false); }} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>OK</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={520}>
                  <LineChart data={catData} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555' }} />
                    <YAxis scale="log" domain={[0.9, 250000]} ticks={[1, 10, 100, 1000, 10000, 100000]}
                           tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v.toFixed(0)}`}
                           tick={{ fontSize: 10, fill: '#555' }} width={55} />
                    <Tooltip formatter={(v, name) => v != null ? [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name] : ['-', name]} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }} />
                    {activeCats.map(cat => (
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
                      {activeCats.map((cat, i) => (
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

            </div>
          )}

        </>
      )}

      {showAddGrant && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '520px', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Grant</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {[
                { key: 'name', label: 'Grant Name', full: true, placeholder: 'e.g. R01 CA123456' },
                { key: 'chartstring', label: 'Chartering', full: true, placeholder: 'e.g. 21-31234-A-R01' },
                { key: 'total_amount', label: 'Total ($)', type: 'number', placeholder: '500000' },
                { key: 'remaining_balance', label: 'Balance Remaining ($)', type: 'number', placeholder: '125000' },
                { key: 'start_date', label: 'Start Date', type: 'date' },
                { key: 'end_date', label: 'End Date', type: 'date' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1 / -1' : 'auto' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                  <input type={f.type || 'text'} value={grantForm[f.key]} placeholder={f.placeholder || ''} onChange={e => setGrantForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
                <textarea value={grantForm.notes} onChange={e => setGrantForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddGrant(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAddGrant} disabled={!grantForm.name.trim()} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: grantForm.name.trim() ? 'var(--purple-primary)' : 'var(--border)', color: grantForm.name.trim() ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: grantForm.name.trim() ? 'pointer' : 'default' }}>Add Grant</button>
            </div>
          </div>
        </div>
      )}

      {editingGrant && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '520px', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Edit Grant</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {[
                { key: 'name', label: 'Grant Name', full: true },
                { key: 'chartstring', label: 'Chartering', full: true },
                { key: 'total_amount', label: 'Total ($)', type: 'number' },
                { key: 'remaining_balance', label: 'Balance Remaining ($)', type: 'number' },
                { key: 'start_date', label: 'Start Date', type: 'date' },
                { key: 'end_date', label: 'End Date', type: 'date' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1 / -1' : 'auto' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                  <input type={f.type || 'text'} value={editGrantForm[f.key] || ''} onChange={e => setEditGrantForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
                <textarea value={editGrantForm.notes || ''} onChange={e => setEditGrantForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {confirmDeleteGrant ? (
                  <>
                    <button onClick={handleDeleteGrant} style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--danger)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Confirm Delete</button>
                    <button onClick={() => setConfirmDeleteGrant(false)} style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDeleteGrant(true)} style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontWeight: 500, cursor: 'pointer' }}>Delete Grant</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setEditingGrant(null)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveGrant} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddOrder && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '580px', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Order</h2>
            {addOrderError && (
              <div style={{ padding: '10px 14px', background: '#FEF0F0', border: '1px solid #FADBD8', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '12px', marginBottom: '16px' }}>
                {addOrderError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {[{label:'Item Name',key:'item',full:true},{label:'Catalog Number',key:'catalog_number'},{label:'Category',key:'category'},{label:'Requisition ID',key:'requisition_id'},{label:'Unit Description',key:'unit_description'},{label:'Unit Price ($)',key:'unit_price',type:'number'},{label:'Units (n)',key:'units',type:'number'},{label:'Order Date',key:'order_date',type:'date'}].map(field => (
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
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requestor</label>
                <input
                  type="text"
                  autoCapitalize="words"
                  value={newOrder.requestor}
                  onChange={e => setNewOrder(p => ({ ...p, requestor: e.target.value }))}
                  onBlur={e => setNewOrder(p => ({ ...p, requestor: e.target.value.trim().replace(/\b\w/g, c => c.toUpperCase()) }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                <select value={newOrder.status} onChange={e => setNewOrder(p => ({ ...p, status: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="pending">Pending</option><option value="processing">Processing</option><option value="complete">Complete</option><option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAddOrder(false); setAddOrderError(''); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleAddOrder} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600 }}>Add Order</button>
            </div>
          </div>
        </div>
      )}

      {editingOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '600px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Edit Order</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item Name</label>
                <input value={editOrderForm.item} onChange={e => setEditOrderForm(p => ({ ...p, item: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendor</label>
                <select value={editOrderForm.vendor} onChange={e => setEditOrderForm(p => ({ ...p, vendor: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', background: 'var(--bg-primary)' }}>
                  <option value="">— Select vendor —</option>
                  {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  {editOrderForm.vendor && !vendors.some(v => v.name === editOrderForm.vendor) && (
                    <option value={editOrderForm.vendor}>{editOrderForm.vendor}</option>
                  )}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
                <select value={editOrderForm.category} onChange={e => setEditOrderForm(p => ({ ...p, category: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', background: 'var(--bg-primary)' }}>
                  <option value="">— Select category —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grant</label>
                <select value={editOrderForm.grant_name} onChange={e => setEditOrderForm(p => ({ ...p, grant_name: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', background: 'var(--bg-primary)' }}>
                  <option value="">— Select grant —</option>
                  {[...new Set([...grants.map(g => g.name), ...GRANT_NAMES])].sort().map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                <select value={editOrderForm.status} onChange={e => setEditOrderForm(p => ({ ...p, status: e.target.value }))}
                  disabled={editingOrder?.status === 'deleted'}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', background: 'var(--bg-primary)' }}>
                  {editingOrder?.status === 'deleted' && <option value="deleted">Deleted</option>}
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="complete">Complete</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {[
                { key: 'catalog_number', label: 'Catalog Number' },
                { key: 'requisition_id', label: 'Requisition ID' },
                { key: 'unit_description', label: 'Unit Description' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                  <input value={editOrderForm[f.key]} onChange={e => setEditOrderForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requestor</label>
                <input
                  type="text"
                  autoCapitalize="words"
                  value={editOrderForm.requestor}
                  onChange={e => setEditOrderForm(p => ({ ...p, requestor: e.target.value }))}
                  onBlur={e => setEditOrderForm(p => ({ ...p, requestor: e.target.value.trim().replace(/\b\w/g, c => c.toUpperCase()) }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unit Price ($)</label>
                <input type="number" value={editOrderForm.unit_price} onChange={e => setEditOrderForm(p => ({ ...p, unit_price: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Units (n)</label>
                <input type="number" value={editOrderForm.units} onChange={e => setEditOrderForm(p => ({ ...p, units: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Price ($)</label>
                <input type="number" value={editOrderForm.total_price} onChange={e => setEditOrderForm(p => ({ ...p, total_price: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Date</label>
                <input type="date" value={editOrderForm.order_date} onChange={e => setEditOrderForm(p => ({ ...p, order_date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
                <textarea value={editOrderForm.notes} onChange={e => setEditOrderForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: editingOrder?.status === 'deleted' ? 'flex-end' : 'space-between', alignItems: 'center' }}>
              {editingOrder?.status !== 'deleted' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {confirmDeleteOrder ? (
                    <>
                      <button onClick={handleDeleteOrder} style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--danger)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Confirm Delete</button>
                      <button onClick={() => setConfirmDeleteOrder(false)} style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteOrder(true)} style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontWeight: 500, cursor: 'pointer' }}>Delete Order</button>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setEditingOrder(null)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                {editingOrder?.status === 'deleted' ? (
                  <button onClick={handleReinstateOrder} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: '#27AE60', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Reinstate Order</button>
                ) : (
                  <button onClick={saveEditOrder} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddReagent && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '480px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Reagent</h2>
            <form onSubmit={handleAddReagent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Name *</label>
                <input required value={reagentForm.name} onChange={e => setReagentForm(p => ({ ...p, name: e.target.value }))} placeholder="Reagent name" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Vendor</label>
                  <input list="reagent-vendor-list" value={reagentForm.vendor} onChange={e => setReagentForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Select or type vendor..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  <datalist id="reagent-vendor-list">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Catalog #</label>
                  <input value={reagentForm.catalog_number} onChange={e => setReagentForm(p => ({ ...p, catalog_number: e.target.value }))} placeholder="e.g. ABC-12345" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Category</label>
                <input value={reagentForm.category} onChange={e => setReagentForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Antibody, Buffer..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                {[['quantity_in_lab','In Lab'],['fy24_purchases','FY24'],['fy25_purchases','FY25'],['fy26_purchases','FY26']].map(([key, label]) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</label>
                    <input type="number" value={reagentForm[key]} onChange={e => setReagentForm(p => ({ ...p, [key]: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddReagent(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Add Reagent</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingReagent && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '480px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Edit Reagent</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Name *</label>
                <input required value={editReagentForm.name} onChange={e => setEditReagentForm(p => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Vendor</label>
                  <input list="reagent-edit-vendor-list" value={editReagentForm.vendor} onChange={e => setEditReagentForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Select or type vendor..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  <datalist id="reagent-edit-vendor-list">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Catalog #</label>
                  <input value={editReagentForm.catalog_number} onChange={e => setEditReagentForm(p => ({ ...p, catalog_number: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Category</label>
                <input value={editReagentForm.category} onChange={e => setEditReagentForm(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                {[['quantity_in_lab','In Lab'],['fy24_purchases','FY24'],['fy25_purchases','FY25'],['fy26_purchases','FY26']].map(([key, label]) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</label>
                    <input type="number" value={editReagentForm[key]} onChange={e => setEditReagentForm(p => ({ ...p, [key]: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <div>
                  {!confirmDeleteReagent ? (
                    <button onClick={() => setConfirmDeleteReagent(true)} style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid #e74c3c', background: 'transparent', color: '#e74c3c', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>Delete</button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#e74c3c' }}>Sure?</span>
                      <button onClick={handleDeleteReagent} style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#e74c3c', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Yes, delete</button>
                      <button onClick={() => setConfirmDeleteReagent(false)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setEditingReagent(null); setConfirmDeleteReagent(false); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleSaveReagent} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
