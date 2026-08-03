import { useState, useEffect, useMemo, useRef } from 'react';
import { useResizableColumns, ColResizer } from '../lib/useResizableColumns';
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
function fyLabel(fy) { return `FY'${fy.slice(2)}`; }
const VENDOR_PALETTE = ['#4472C4','#E46C0A','#7030A0','#538135','#CC4125','#1F3864','#9DC3E6','#C00000','#00B0F0','#4BACC6','#92D050','#FAC090','#CCCC00','#FF00FF','#A9D18E','#C4A265','#FF6B6B','#4ECDC4'];
const FY_PALETTE = ['#4472C4','#E46C0A','#538135','#7030A0','#CC4125','#1F3864','#9DC3E6','#C55A11'];


const STATUS_STYLES = {
  complete: { bg: '#EAF7F0', text: '#27AE60', label: 'Complete' },
  processing: { bg: '#EBF5FB', text: '#2980B9', label: 'Processing' },
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



function getFiscalYear(dateStr) {
  if (!dateStr) return 'fy26';
  const d = new Date(dateStr + 'T00:00:00Z');
  const fyYear = d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  return `fy${String(fyYear).slice(2)}`;
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
  const [showAddNanoseq, setShowAddNanoseq] = useState(false);
  const [nanoseqForm, setNanoseqForm] = useState({ protocol: '', name: '', company: '', code: '', link: '', cost: '', amount: '', n_reactions: '' });
  const [newOrder, setNewOrder] = useState({
    item: '', vendor: '', catalog_number: '', category: '', grant_name: '',
    requisition_id: '', unit_description: '', unit_price: '', units: '',
    order_date: '', requestor: '', status: 'pending', notes: ''
  });
  const [selectedGrants, setSelectedGrants] = useState([]);
  const [grantFilterOpen, setGrantFilterOpen] = useState(false);
  const [draftGrants, setDraftGrants] = useState([]);
  const [grantSearch, setGrantSearch] = useState('');
  const [selectedGlobalYears, setSelectedGlobalYears] = useState([]);
  const [globalYearOpen, setGlobalYearOpen] = useState(false);
  const [draftGlobalYears, setDraftGlobalYears] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [draftCategories, setDraftCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedGrantsExpType, setSelectedGrantsExpType] = useState([]);
  const [grantFilterExpTypeOpen, setGrantFilterExpTypeOpen] = useState(false);
  const [draftGrantsExpType, setDraftGrantsExpType] = useState([]);
  const [grantSearchExpType, setGrantSearchExpType] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userFilterOpen, setUserFilterOpen] = useState(false);
  const [draftUsers, setDraftUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [catalogSortCol, setCatalogSortCol] = useState('total');
  const [catalogSortDir, setCatalogSortDir] = useState('desc');
  const [vcSelectedVendors, setVcSelectedVendors] = useState([]);
  const [vcVendorOpen, setVcVendorOpen] = useState(false);
  const [vcDraftVendors, setVcDraftVendors] = useState([]);
  const [vcVendorSearch, setVcVendorSearch] = useState('');
  const [vcSelectedYears, setVcSelectedYears] = useState([]);
  const [vcYearOpen, setVcYearOpen] = useState(false);
  const [vcDraftYears, setVcDraftYears] = useState([]);
  const [vcSelectedCategories, setVcSelectedCategories] = useState([]);
  const [vcCategoryOpen, setVcCategoryOpen] = useState(false);
  const [vcDraftCategories, setVcDraftCategories] = useState([]);
  const [vcCategorySearch, setVcCategorySearch] = useState('');
  const [annualSummaryYears, setAnnualSummaryYears] = useState([]);
  const [annualSummaryYearOpen, setAnnualSummaryYearOpen] = useState(false);
  const [annualSummaryDraftYears, setAnnualSummaryDraftYears] = useState([]);
  const chartData = useMemo(() => {
    const real = orders.filter(o => {
      if (!o.item || o.item.trim() === '' || o.status === 'deleted') return false;
      if (selectedGlobalYears.length > 0 && !selectedGlobalYears.includes(getFiscalYear(o.order_date))) return false;
      return true;
    });

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
  }, [orders, selectedGlobalYears]);

  const { months: MONTHS, catStatusData, grantNames: GRANT_NAMES, byGrant: ordersDataByGrant } = chartData;

  const [vendors, setVendors] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editOrderForm, setEditOrderForm] = useState({});
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(false);
  const [ordersYearTab, setOrdersYearTab] = useState('fy27');
  const [importError, setImportError] = useState(null);
  const [showImportFYModal, setShowImportFYModal] = useState(false);
  const [importFYInput, setImportFYInput] = useState('');
  const [importFYError, setImportFYError] = useState('');
  const importFileInputRef = useRef(null);
  const pendingFYRef = useRef('');
  const [ordersSortCol, setOrdersSortCol] = useState(null);
  const [ordersSortDir, setOrdersSortDir] = useState('asc');
  const [showAddGrant, setShowAddGrant] = useState(false);
  const [grantForm, setGrantForm] = useState(EMPTY_GRANT);
  const [editingGrant, setEditingGrant] = useState(null);
  const [editGrantForm, setEditGrantForm] = useState({});
  const [confirmDeleteGrant, setConfirmDeleteGrant] = useState(false);
  const [reagentsSortCol, setReagentsSortCol] = useState(null);
  const [reagentsSortDir, setReagentsSortDir] = useState('asc');
  const [importReagentError, setImportReagentError] = useState(null);
  const [showAddReagent, setShowAddReagent] = useState(false);
  const [reagentForm, setReagentForm] = useState({ name: '', vendor: '', catalog_number: '', category: '', unit_description: '', unit_price: '', units: '', quantity_in_lab: '', fy24_purchases: '', fy25_purchases: '', fy26_purchases: '' });
  const [editingReagent, setEditingReagent] = useState(null);
  const [editReagentForm, setEditReagentForm] = useState({});
  const [confirmDeleteReagent, setConfirmDeleteReagent] = useState(false);

  const allFYs = useMemo(() => {
    const s = new Set(['fy26', 'fy25', 'fy24']);
    orders.forEach(o => { if (o.order_date) s.add(getFiscalYear(o.order_date)); });
    return [...s].sort().reverse();
  }, [orders]);

  const { widths: grantsWidths, onColMouseDown: grantsResize } = useResizableColumns(8);
  const { widths: ordersWidths, onColMouseDown: ordersResize } = useResizableColumns(14);
  const { widths: reagentsWidths, onColMouseDown: reagentsResize } = useResizableColumns(8 + allFYs.length + 1);
  const { widths: nanoseqWidths, onColMouseDown: nanoseqResize } = useResizableColumns(8 + allFYs.length + 1);

  const canManage = userRole === 'admin' || userRole === 'pm';

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    // Fetch all orders in pages (Supabase default limit is 1000)
    async function fetchAllOrders() {
      const PAGE = 1000;
      let all = [], from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('orders').select('*')
          .order('created_at', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error || !data?.length) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    }

    const [{ data: grantData }, allOrders, { data: reagentData }, { data: nanoseqData }, { data: vendorData }] = await Promise.all([
      supabase.from('grants').select('*').order('name'),
      fetchAllOrders(),
      supabase.from('reagents').select('*').order('category').order('name'),
      supabase.from('nanoseq_reagents').select('*').order('protocol').order('name'),
      supabase.from('vendors').select('*').order('name'),
    ]);
    setGrants(grantData || []);
    setOrders(allOrders || []);
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
      ['units', 'Units'], ['order_date', 'Order Date'], ['requestor', 'Requestor'],
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

  function handleConfirmImportFY() {
    const trimmed = importFYInput.trim();
    if (!/^fy\d{2}$/i.test(trimmed)) {
      setImportFYError('Must be in format FYXX (e.g. FY27). Accepts upper or lower case.');
      return;
    }
    pendingFYRef.current = trimmed.toUpperCase();
    setShowImportFYModal(false);
    importFileInputRef.current?.click();
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

  const userNames = useMemo(() => {
    const names = new Set();
    orders.forEach(o => { if (o.requestor) names.add(o.requestor); });
    return [...names].sort();
  }, [orders]);

  const userCatData = useMemo(() => {
    const real = orders.filter(o => {
      if (!o.item || o.item.trim() === '' || o.status === 'deleted') return false;
      if (selectedUsers.length > 0 && !selectedUsers.includes(o.requestor)) return false;
      if (selectedGlobalYears.length > 0 && !selectedGlobalYears.includes(getFiscalYear(o.order_date))) return false;
      return true;
    });
    const monthMap = {};
    real.forEach(o => { const m = orderDateToMonth(o.order_date); if (m) monthMap[m] = o.order_date; });
    const months = Object.entries(monthMap).sort((a, b) => a[1].localeCompare(b[1])).map(([m]) => m);
    const byMonth = {};
    months.forEach(m => { byMonth[m] = { month: m }; });
    real.forEach(o => {
      const m = orderDateToMonth(o.order_date);
      const v = Number(o.total_price);
      if (!m || !o.category || !v || v <= 0) return; // skip 0/null — log scale can't handle 0
      byMonth[m][o.category] = (byMonth[m][o.category] || 0) + v;
    });
    return { data: months.map(m => byMonth[m]), months };
  }, [orders, selectedUsers, selectedGlobalYears]);

  const catalogRows = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const cat = (o.catalog_number || '').trim();
      if (!cat || cat === 'NA') return;
      if (!map[cat]) map[cat] = { catalog_number: cat, item: '', vendor: '', category: '', unit_description: null, unit_price: null, units: null, fyCounts: {}, total: 0 };
      const r = map[cat];
      if (o.item) r.item = o.item;
      if (o.vendor) r.vendor = o.vendor;
      if (o.category) r.category = o.category;
      if (o.unit_description) r.unit_description = o.unit_description;
      if (o.unit_price != null) r.unit_price = o.unit_price;
      if (o.units != null) r.units = o.units;
      const fy = getFiscalYear(o.order_date);
      const units = parseInt(o.units) || 0;
      if (fy) r.fyCounts[fy] = (r.fyCounts[fy] || 0) + units;
      r.total += units;
    });
    const reagentCats = new Set(reagents.map(r => (r.catalog_number || '').trim()).filter(Boolean));
    return Object.values(map).map(r => ({ ...r, is_standardized: reagentCats.has(r.catalog_number) }));
  }, [orders, reagents]);

  const catalogByNum = useMemo(() => {
    const m = {};
    catalogRows.forEach(r => { m[r.catalog_number] = r; });
    return m;
  }, [catalogRows]);

  const sortedCatalogRows = useMemo(() => {
    const rows = [...catalogRows];
    if (!catalogSortCol) return rows;
    return rows.sort((a, b) => {
      let av, bv;
      if (catalogSortCol.startsWith('fy')) { av = a.fyCounts[catalogSortCol] || 0; bv = b.fyCounts[catalogSortCol] || 0; }
      else if (catalogSortCol === 'total') { av = a.total; bv = b.total; }
      else if (catalogSortCol === 'is_standardized') { av = a.is_standardized ? 1 : 0; bv = b.is_standardized ? 1 : 0; }
      else { av = a[catalogSortCol]; bv = b[catalogSortCol]; }
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return catalogSortDir === 'asc' ? cmp : -cmp;
    });
  }, [catalogRows, catalogSortCol, catalogSortDir]);

  const allVendorNames = useMemo(() => {
    const s = new Set(); orders.forEach(o => { if (o.vendor) s.add(o.vendor); }); return [...s].sort();
  }, [orders]);

  const vendorChartData = useMemo(() => {
    const activeV = vcSelectedVendors.length === 0 ? allVendorNames : vcSelectedVendors;
    const activeYrs = vcSelectedYears.length === 0 ? allFYs : vcSelectedYears;
    const activeCatsFilter = vcSelectedCategories.length > 0 ? new Set(vcSelectedCategories) : null;
    const real = orders.filter(o =>
      o.item && o.status !== 'deleted' && o.total_price != null && o.vendor &&
      activeV.includes(o.vendor) && (activeYrs.length === 0 || activeYrs.includes(getFiscalYear(o.order_date))) &&
      (!activeCatsFilter || activeCatsFilter.has(o.category))
    );
    const monthMap = {};
    real.forEach(o => { const m = orderDateToMonth(o.order_date); if (m) monthMap[m] = o.order_date; });
    const months = Object.entries(monthMap).sort((a, b) => a[1].localeCompare(b[1])).map(([m]) => m);
    const byMonth = {};
    months.forEach(m => { byMonth[m] = { month: m }; });
    real.forEach(o => {
      const m = orderDateToMonth(o.order_date);
      if (!m || !o.vendor || o.total_price == null) return;
      byMonth[m][o.vendor] = (byMonth[m][o.vendor] || 0) + Number(o.total_price);
    });
    const vendorYearSpend = {};
    activeV.forEach(v => { vendorYearSpend[v] = {}; });
    real.forEach(o => {
      if (!o.vendor || !activeV.includes(o.vendor) || o.total_price == null) return;
      const fy = getFiscalYear(o.order_date);
      if (fy) vendorYearSpend[o.vendor][fy] = (vendorYearSpend[o.vendor][fy] || 0) + Number(o.total_price);
    });
    // Sort vendors by total spend desc for consistent colour assignment
    const sortedV = [...activeV].sort((a, b) =>
      Object.values(vendorYearSpend[b] || {}).reduce((s, v) => s + v, 0) -
      Object.values(vendorYearSpend[a] || {}).reduce((s, v) => s + v, 0)
    );
    return { data: months.map(m => byMonth[m]), months, vendorYearSpend, activeV: sortedV, activeYrs };
  }, [orders, vcSelectedVendors, vcSelectedYears, vcSelectedCategories, allVendorNames, allFYs]);

  const multiYearData = useMemo(() => {
    const activeYears = (annualSummaryYears.length > 0 ? annualSummaryYears : allFYs).slice().sort();

    const fyTotals = {};
    activeYears.forEach(fy => { fyTotals[fy] = { total: 0, complete: 0, processing: 0, pending: 0, count: 0 }; });

    const monthlyByFY = {};
    activeYears.forEach(fy => { monthlyByFY[fy] = Array(12).fill(0); });

    const catByFY = {};
    activeYears.forEach(fy => { catByFY[fy] = {}; });

    orders.forEach(o => {
      if (!o.item || o.item.trim() === '' || o.status === 'deleted' || !o.order_date || o.total_price == null) return;
      const fy = getFiscalYear(o.order_date);
      if (!activeYears.includes(fy)) return;
      const price = Number(o.total_price);
      if (!price || isNaN(price)) return;

      fyTotals[fy].total += price;
      fyTotals[fy].count += 1;
      const s = (o.status || '').toLowerCase();
      if (s === 'complete') fyTotals[fy].complete += price;
      else if (s === 'processing') fyTotals[fy].processing += price;
      else fyTotals[fy].pending += price;

      const d = new Date(o.order_date + 'T00:00:00Z');
      monthlyByFY[fy][d.getUTCMonth()] += price;

      if (o.category) catByFY[fy][o.category] = (catByFY[fy][o.category] || 0) + price;
    });

    const monthlyData = MON_ABBR.map((m, mi) => {
      const row = { month: m };
      activeYears.forEach(fy => { row[fy] = monthlyByFY[fy][mi] || 0; });
      return row;
    });

    const catData = CATEGORIES.map(cat => {
      const row = { name: cat };
      activeYears.forEach(fy => { row[fy] = catByFY[fy]?.[cat] || 0; });
      return row;
    }).filter(row => activeYears.some(fy => (row[fy] || 0) > 0));

    const fyTotalsData = activeYears.map(fy => ({
      fy: fy.toUpperCase(),
      complete: fyTotals[fy]?.complete || 0,
      processing: fyTotals[fy]?.processing || 0,
      pending: fyTotals[fy]?.pending || 0,
      total: fyTotals[fy]?.total || 0,
      count: fyTotals[fy]?.count || 0,
    }));

    return { fyTotals, monthlyData, catData, fyTotalsData, activeYears };
  }, [orders, annualSummaryYears, allFYs]);

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

  const EMPTY_REAGENT_FORM = { name: '', vendor: '', catalog_number: '', category: '', unit_description: '', unit_price: '', units: '', quantity_in_lab: '', fy24_purchases: '', fy25_purchases: '', fy26_purchases: '' };

  async function handleAddReagent(e) {
    e.preventDefault();
    if (!reagentForm.name.trim()) return;
    const numF = v => v !== '' ? parseFloat(v) : null;
    const payload = { name: reagentForm.name.trim(), vendor: reagentForm.vendor || null, catalog_number: reagentForm.catalog_number || null, category: reagentForm.category || null, unit_description: reagentForm.unit_description || null, unit_price: numF(reagentForm.unit_price), units: reagentForm.units !== '' ? parseInt(reagentForm.units) || null : null, quantity_in_lab: numF(reagentForm.quantity_in_lab), fy24_purchases: numF(reagentForm.fy24_purchases), fy25_purchases: numF(reagentForm.fy25_purchases), fy26_purchases: numF(reagentForm.fy26_purchases) };
    const { data, error } = await supabase.from('reagents').insert([payload]).select().single();
    if (!error && data) { setReagents(prev => [...prev, data]); setShowAddReagent(false); setReagentForm(EMPTY_REAGENT_FORM); }
  }

  function openEditReagent(r) {
    setConfirmDeleteReagent(false);
    setEditingReagent(r);
    setEditReagentForm({ name: r.name || '', vendor: r.vendor || '', catalog_number: r.catalog_number || '', category: r.category || '', unit_description: r.unit_description || '', unit_price: r.unit_price != null ? String(r.unit_price) : '', units: r.units != null ? String(r.units) : '', quantity_in_lab: r.quantity_in_lab != null ? String(r.quantity_in_lab) : '', fy24_purchases: r.fy24_purchases != null ? String(r.fy24_purchases) : '', fy25_purchases: r.fy25_purchases != null ? String(r.fy25_purchases) : '', fy26_purchases: r.fy26_purchases != null ? String(r.fy26_purchases) : '' });
  }

  async function handleSaveReagent() {
    const numF = v => v !== '' ? parseFloat(v) : null;
    const payload = { name: editReagentForm.name.trim(), vendor: editReagentForm.vendor || null, catalog_number: editReagentForm.catalog_number || null, category: editReagentForm.category || null, unit_description: editReagentForm.unit_description || null, unit_price: numF(editReagentForm.unit_price), units: editReagentForm.units !== '' ? parseInt(editReagentForm.units) || null : null, quantity_in_lab: numF(editReagentForm.quantity_in_lab), fy24_purchases: numF(editReagentForm.fy24_purchases), fy25_purchases: numF(editReagentForm.fy25_purchases), fy26_purchases: numF(editReagentForm.fy26_purchases) };
    await supabase.from('reagents').update(payload).eq('id', editingReagent.id);
    setReagents(prev => prev.map(r => r.id === editingReagent.id ? { ...r, ...payload } : r));
    setEditingReagent(null);
  }

  async function handleDeleteReagent() {
    await supabase.from('reagents').delete().eq('id', editingReagent.id);
    setReagents(prev => prev.filter(r => r.id !== editingReagent.id));
    setEditingReagent(null); setConfirmDeleteReagent(false);
  }

  const REAGENT_DRAFT_HEADERS = ['Category', 'Item (name)', 'Vendor', 'Cat number', 'Unit description', 'Unit price', 'Units (n)', 'Unused', "FY'26", "FY'25", "FY'24"];

  function handleExportReagents() {
    const rows = sortedReagents.map(r => ({ 'Category': r.category||'', 'Item (name)': r.name||'', 'Vendor': r.vendor||'', 'Cat number': r.catalog_number||'', 'Unit description': r.unit_description||'', 'Unit price': r.unit_price??'', 'Units (n)': r.units??'', 'Unused': r.quantity_in_lab??'', "FY'26": r.fy26_purchases??'', "FY'25": r.fy25_purchases??'', "FY'24": r.fy24_purchases??'' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reagents');
    XLSX.writeFile(wb, `reagents_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function handleReagentDraft() {
    const ws = XLSX.utils.aoa_to_sheet([REAGENT_DRAFT_HEADERS, REAGENT_DRAFT_HEADERS.map(() => '')]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reagents');
    XLSX.writeFile(wb, 'reagents_draft.xlsx');
  }

  function handleExportNanoseq() {
    const rows = nanoseq.map(r => ({ 'Protocol': r.protocol||'', 'Name': r.name||'', 'Company': r.company||'', 'Code': r.code||'', 'Link': r.link||'', 'Cost': r.cost??'', 'Amount': r.amount||'', 'N Reactions': r.n_reactions??'' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nanoseq');
    XLSX.writeFile(wb, `nanoseq_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function handleNanoseqDraft() {
    const headers = ['Protocol', 'Name', 'Company', 'Code', 'Link', 'Cost', 'Amount', 'N Reactions'];
    const ws = XLSX.utils.aoa_to_sheet([headers, headers.map(() => '')]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nanoseq');
    XLSX.writeFile(wb, 'nanoseq_draft.xlsx');
  }

  async function handleAddNanoseq(e) {
    e.preventDefault();
    const toInsert = {
      protocol: nanoseqForm.protocol.trim() || null,
      name: nanoseqForm.name.trim(),
      company: nanoseqForm.company.trim() || null,
      code: nanoseqForm.code.trim() || null,
      link: nanoseqForm.link.trim() || null,
      cost: parseFloat(nanoseqForm.cost) || null,
      amount: nanoseqForm.amount.trim() || null,
      n_reactions: parseFloat(nanoseqForm.n_reactions) || null,
    };
    const { data, error } = await supabase.from('nanoseq_reagents').insert([toInsert]).select().single();
    if (!error && data) { setNanoseq(prev => [...prev, data]); setShowAddNanoseq(false); setNanoseqForm({ protocol: '', name: '', company: '', code: '', link: '', cost: '', amount: '', n_reactions: '' }); }
  }


  const sortedReagents = useMemo(() => {
    const q = reagentSearch.toLowerCase();
    const filtered = q ? reagents.filter(r => ['name','vendor','catalog_number','category'].some(k => r[k] != null && String(r[k]).toLowerCase().includes(q))) : reagents;
    if (!reagentsSortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let av, bv;
      if (allFYs.includes(reagentsSortCol)) {
        av = catalogByNum[a.catalog_number]?.fyCounts?.[reagentsSortCol] || 0;
        bv = catalogByNum[b.catalog_number]?.fyCounts?.[reagentsSortCol] || 0;
      } else if (reagentsSortCol === 'fy_total') {
        av = Object.values(catalogByNum[a.catalog_number]?.fyCounts || {}).reduce((s,n) => s+n, 0);
        bv = Object.values(catalogByNum[b.catalog_number]?.fyCounts || {}).reduce((s,n) => s+n, 0);
      } else {
        av = a[reagentsSortCol]; bv = b[reagentsSortCol];
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return reagentsSortDir === 'asc' ? cmp : -cmp;
    });
  }, [reagents, reagentSearch, reagentsSortCol, reagentsSortDir, catalogByNum, allFYs]);

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

  const filteredGrantOptionsExpType = GRANT_NAMES.filter(g => g.toLowerCase().includes(grantSearchExpType.toLowerCase()));
  const activeGrantsExpType = selectedGrantsExpType.length === 0 ? GRANT_NAMES : selectedGrantsExpType;
  const ordersReal = orders.filter(o => {
    if (!o.item || o.item.trim() === '' || o.status === 'deleted') return false;
    if (selectedGlobalYears.length > 0 && !selectedGlobalYears.includes(getFiscalYear(o.order_date))) return false;
    return true;
  });
  const expTypeOrders = activeGrantsExpType.length === GRANT_NAMES.length && selectedGrantsExpType.length === 0 ? ordersReal : ordersReal.filter(o => activeGrantsExpType.includes(o.grant_name));
  const byCatFiltered = {};
  CATEGORIES.forEach(cat => { byCatFiltered[cat] = { name: cat, complete: 0, processing: 0 }; });
  expTypeOrders.forEach(o => {
    if (!o.category || o.total_price == null) return;
    if (!byCatFiltered[o.category]) byCatFiltered[o.category] = { name: o.category, complete: 0, processing: 0 };
    const s = (o.status || '').trim().toLowerCase();
    if (s === 'complete') byCatFiltered[o.category].complete += Number(o.total_price);
    else if (s === 'processing') byCatFiltered[o.category].processing += Number(o.total_price);
  });
  const catStatusDataFiltered = CATEGORIES.map(cat => byCatFiltered[cat]);

  function exportTableXLSX(rows, filename) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, filename);
  }
  function exportTotalsTable() {
    exportTableXLSX([
      { Status: 'Complete',   Total: totalComplete   },
      { Status: 'Processing', Total: totalProcessing },
    ], 'totals.xlsx');
  }
  function exportMonthTable() {
    const rows = tableMonthRows.map(r => ({ Date: r.month, Complete: r.complete, Processing: r.processing }));
    rows.push({ Date: 'Grand Total', Complete: tableTotalComplete, Processing: tableTotalProcessing });
    exportTableXLSX(rows, 'complete_processing_by_month.xlsx');
  }
  function exportExpTypeTable() {
    const rows = catStatusDataFiltered.filter(r => r.complete > 0 || r.processing > 0).map(r => ({ Category: r.name, Complete: r.complete, Processing: r.processing }));
    exportTableXLSX(rows, 'complete_processing_by_expense_type.xlsx');
  }
  function exportCatMonthTable() {
    const date = new Date().toISOString().split('T')[0];
    const months = userCatData.months;
    const data = userCatData.data;

    const aoa = [
      ['Exported:', date],
      [],
      ['Category', ...months, 'Total'],
      ...activeCats.map(cat => {
        let rowTotal = 0;
        const vals = months.map((m, mi) => {
          const v = data[mi]?.[cat] ?? null;
          if (v != null) rowTotal += v;
          return v ?? '';
        });
        return [cat, ...vals, rowTotal];
      }),
      ['Grand Total',
        ...months.map((m, mi) => activeCats.reduce((s, cat) => s + (data[mi]?.[cat] || 0), 0)),
        activeCats.reduce((s, cat) => s + months.reduce((ss, m, mi) => ss + (data[mi]?.[cat] || 0), 0), 0),
      ],
    ];

    const yearPart = selectedGlobalYears.length === 0 ? 'allYears' : selectedGlobalYears.map(fy => fy.toUpperCase()).join('-');
    const userPart = selectedUsers.length === 0 ? 'allUsers' : selectedUsers.join('-');
    const catPart = (selectedCategories.length === 0 || selectedCategories.length === CATEGORIES.length) ? 'allCategories' : selectedCategories.join('-');
    const allAll = yearPart === 'allYears' && userPart === 'allUsers' && catPart === 'allCategories';
    const filename = (allAll
      ? `spending_summaries_all_data_${date}`
      : `spending_summaries_${yearPart}_${userPart}_${catPart}_${date}`
    ).replace(/\s+/g, '_') + '.xlsx';

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Spending');
    XLSX.writeFile(wb, filename);
  }

  function handleExportCatalog() {
    const wb = XLSX.utils.book_new();
    const makeRows = rows => rows.map(r => {
      const row = { 'Item': r.item, 'Vendor': r.vendor, 'Category': r.category, 'Cat #': r.catalog_number, 'Unit description': r.unit_description || '', 'Unit price': r.unit_price ?? '', 'Units (n)': r.units ?? '', 'Standardized Reagent': r.is_standardized ? 'Yes' : 'No' };
      allFYs.forEach(fy => { row[fyLabel(fy)] = r.fyCounts[fy] || 0; });
      row['Total'] = r.total;
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(makeRows(sortedCatalogRows)), 'All');
    allFYs.forEach(fy => {
      const filtered = sortedCatalogRows.filter(r => r.fyCounts[fy]);
      if (filtered.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(makeRows(filtered)), fyLabel(fy));
    });
    XLSX.writeFile(wb, 'catalog_orders.xlsx');
  }

  function handleExportVendorChart() {
    const { data, months, activeV } = vendorChartData;
    const monthLookup = {};
    data.forEach(d => { monthLookup[d.month] = d; });
    const rows = activeV.map(v => {
      const row = { 'Vendor': v };
      months.forEach(m => { row[m] = monthLookup[m]?.[v] ? `$${monthLookup[m][v].toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''; });
      row['Total'] = `$${months.reduce((s, m) => s + (monthLookup[m]?.[v] || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
      return row;
    });
    exportTableXLSX(rows, 'vendor_spending.xlsx');
  }

  const filteredOrders = useMemo(() => orders.filter(o => {
    if (ordersYearTab === 'misc') {
      if (o.order_date) return false;
    } else {
      if (!o.order_date) return false;
      if (getFiscalYear(o.order_date) !== ordersYearTab) return false;
    }
    if (searchQuery === '') return true;
    const q = searchQuery.toLowerCase();
    return o.item?.toLowerCase().includes(q) || o.vendor?.toLowerCase().includes(q) || o.requisition_id?.toLowerCase().includes(q);
  }), [orders, ordersYearTab, searchQuery]);

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
    const HEADERS = ['Item','Vendor','Catalog Number','Category','Grant ID','Requsition ID','Unit description','Unit price','Units (n)','Total price','Date','Requestor','Status','Notes'];
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, HEADERS.map(h => h === 'Date' ? 'YYYY-MM-DD' : h === 'Status' ? 'pending' : '')]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, 'orders_import_template.xlsx');
  }
  const fy26Spend = orders.filter(o => o.order_date && getFiscalYear(o.order_date) === 'fy26').reduce((sum, o) => sum + (o.total_price || 0), 0);
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
          { label: 'FY26 Spend', value: `$${Math.round(fy26Spend).toLocaleString()}`, color: '#27AE60', bg: '#EAF7F0' },
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
          {['orders', 'charts', 'annual-summary', 'smart-summary', 'vendors', 'grants', 'reagents'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 20px', background: activeTab === tab ? 'var(--purple-primary)' : 'transparent', color: activeTab === tab ? 'white' : 'var(--text-secondary)', border: 'none', fontWeight: activeTab === tab ? 600 : 400, fontSize: '13px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
              {tab === 'reagents' ? 'Standardized Reagents' : tab === 'charts' ? 'Spending Summaries' : tab === 'smart-summary' ? 'Smart Summary' : tab === 'annual-summary' ? 'Annual Summary' : tab}
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
              <button onClick={() => { setShowImportFYModal(true); setImportFYInput(''); setImportFYError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                <Upload size={14} /> {uploadingFile ? 'Processing…' : 'Import'}
              </button>
              <input ref={importFileInputRef} type="file" accept=".xlsx,.csv,.tsv" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files[0]; if (!file) return;
                setUploadingFile(true); setImportError(null);
                const formData = new FormData();
                formData.append('file', file);
                formData.append('fiscalYear', pendingFYRef.current);
                const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/preview-orders`, { method: 'POST', body: formData });
                const data = await res.json();
                if (data.error) { setImportError(data); }
                else if (data.newOrders) { setPreviewData(data.newOrders); }
                setUploadingFile(false);
                e.target.value = '';
              }} />
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
              <button onClick={handleReagentDraft} title="Download blank draft to fill in" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>Draft</button>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                <Upload size={14} /> {uploadingFile ? 'Processing…' : 'Import Misc'}
                <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files[0]; if (!file) return;
                  setUploadingFile(true); setImportReagentError(null);
                  const formData = new FormData(); formData.append('file', file);
                  const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/preview-reagents`, { method: 'POST', body: formData });
                  const data = await res.json();
                  if (data.error) { setImportReagentError(data); }
                  else if (data.newReagents) setPreviewReagents(data.newReagents);
                  setUploadingFile(false); e.target.value = '';
                }} />
              </label>
              <button onClick={() => { setReagentForm(EMPTY_REAGENT_FORM); setShowAddReagent(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}><Plus size={16} /> Add Reagent</button>
            </>
          )}
          {activeTab === 'reagents' && reagentTab === 'nanoseq' && (
            <button onClick={handleExportNanoseq} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
              <Download size={14} /> Export
            </button>
          )}
          {canManage && activeTab === 'reagents' && reagentTab === 'nanoseq' && (
            <>
              <button onClick={handleNanoseqDraft} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>Draft</button>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                <Upload size={14} /> {uploadingFile ? 'Processing…' : 'Import Nanoseq'}
                <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files[0]; if (!file) return;
                  setUploadingFile(true);
                  const formData = new FormData(); formData.append('file', file);
                  const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/preview-nanoseq`, { method: 'POST', body: formData });
                  const data = await res.json();
                  if (data.error) { setImportReagentError(data); }
                  else if (data.newNanoseq && data.newNanoseq.length > 0) setPreviewNanoseq(data.newNanoseq);
                  else if (data.newNanoseq && data.newNanoseq.length === 0) setImportReagentError({ error: 'No new reagents found — all catalog codes in this file already exist in the table.' });
                  setUploadingFile(false); e.target.value = '';
                }} />
              </label>
              <button onClick={() => setShowAddNanoseq(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}><Plus size={16} /> Add Reagent</button>
            </>
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
              <table className="resizable-table" style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>{grantsWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Grant', 'Chartering', 'Flags', 'Total', 'Balance Remaining', 'Start Date', 'End Date', 'Notes'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontWeight: 600, position: 'relative' }}>{h}<ColResizer colIdx={i} totalCols={8} onColMouseDown={grantsResize} /></th>
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
              {importError && (
                <div style={{ background: '#FDEDEC', border: '1px solid #E74C3C', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#E74C3C', margin: '0 0 6px' }}>{importError.error}</p>
                      {importError.details?.map((d, i) => <p key={i} style={{ fontSize: '12px', color: '#C0392B', margin: '2px 0' }}>• {d}</p>)}
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0' }}>Download the Template to get a file with the correct column names and order.</p>
                    </div>
                    <button onClick={() => setImportError(null)} style={{ background: 'none', border: 'none', color: '#E74C3C', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 0 0 12px' }}>×</button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                {[{ id: 'fy27', label: 'FY27' }, { id: 'fy26', label: 'FY26' }, { id: 'fy25', label: 'FY25' }, { id: 'fy24', label: 'FY24' }, { id: 'fy23', label: 'FY23' }, { id: 'misc', label: 'Misc FY' }].map(({ id, label }) => (
                  <button key={id} onClick={() => setOrdersYearTab(id)}
                    style={{ padding: '5px 14px', borderRadius: 'var(--radius-md)', border: '1px solid', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderColor: ordersYearTab === id ? 'var(--purple-primary)' : 'var(--border)', background: ordersYearTab === id ? 'var(--purple-primary)' : 'transparent', color: ordersYearTab === id ? 'white' : 'var(--text-muted)' }}>
                    {label}
                  </button>
                ))}
              </div>

              <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search orders..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sortedOrders.length} orders</span>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
                <table className="resizable-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <colgroup>{ordersWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      {[
                        { label: 'Item', key: 'item' },
                        { label: 'Vendor', key: 'vendor' },
                        { label: 'Catalog Number', key: 'catalog_number' },
                        { label: 'Category', key: 'category' },
                        { label: 'Grant ID', key: 'grant_name' },
                        { label: 'Requsition ID', key: 'requisition_id' },
                        { label: 'Unit description', key: 'unit_description' },
                        { label: 'Unit price', key: 'unit_price' },
                        { label: 'Units (n)', key: 'units' },
                        { label: 'Total price', key: 'total_price' },
                        { label: 'Date', key: 'order_date' },
                        { label: 'Requestor', key: 'requestor' },
                        { label: 'Status', key: 'status' },
                        { label: 'Notes', key: 'notes' },
                      ].map(({ label, key }, i) => (
                        <th key={key}
                          onClick={() => {
                            if (ordersSortCol === key) setOrdersSortDir(d => d === 'asc' ? 'desc' : 'asc');
                            else { setOrdersSortCol(key); setOrdersSortDir('asc'); }
                          }}
                          style={{ padding: '7px 6px', textAlign: 'left', fontSize: '10px', color: ordersSortCol === key ? 'var(--purple-primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', userSelect: 'none', position: 'relative' }}>
                          {label}{ordersSortCol === key ? (ordersSortDir === 'asc' ? ' ↑' : ' ↓') : ''}<ColResizer colIdx={i} totalCols={14} onColMouseDown={ordersResize} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map(order => {
                      const isDeleted = order.status === 'deleted';
                      const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                      const cell = (content, opts = {}) => (
                        <td style={{ padding: '6px 6px', fontSize: '11px', color: opts.color || 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: opts.mono ? 'monospace' : undefined, fontWeight: opts.bold ? 600 : undefined }}>
                          {content}
                        </td>
                      );
                      return (
                        <tr key={order.id} onClick={() => openEditOrder(order)}
                          style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', opacity: isDeleted ? 0.45 : 1 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          {cell(order.item, { color: 'var(--text-primary)' })}
                          {cell(order.vendor)}
                          {cell(order.catalog_number, { mono: true, color: 'var(--text-muted)' })}
                          {cell(order.category)}
                          {cell(order.grant_name, { color: 'var(--purple-primary)' })}
                          {cell(order.requisition_id, { mono: true, color: 'var(--text-muted)' })}
                          {cell(order.unit_description)}
                          {cell(order.unit_price != null ? `$${Number(order.unit_price).toLocaleString()}` : '')}
                          {cell(order.units ?? '')}
                          {cell(order.total_price != null ? `$${Number(order.total_price).toLocaleString()}` : '', { bold: true, color: 'var(--text-primary)' })}
                          {cell(order.order_date, { color: 'var(--text-muted)' })}
                          {cell(order.requestor)}
                          <td style={{ padding: '6px 6px' }} onClick={isDeleted ? undefined : e => e.stopPropagation()}>
                            {isDeleted ? (
                              <span style={{ padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: 600, background: STATUS_STYLES.deleted.bg, color: STATUS_STYLES.deleted.text }}>Deleted</span>
                            ) : (
                              <select value={order.status || 'pending'} onChange={e => commitOrderSelectEdit(order.id, 'status', e.target.value)}
                                style={{ padding: '2px 4px', borderRadius: '12px', fontSize: '10px', fontWeight: 600, background: statusStyle.bg, color: statusStyle.text, border: 'none', cursor: 'pointer', outline: 'none', width: '100%' }}>
                                <option value="pending">Pending</option>
                                <option value="processing">Processing</option>
                                <option value="complete">Complete</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            )}
                          </td>
                          {cell(order.notes, { color: 'var(--text-muted)' })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
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

              {importReagentError && (
                <div style={{ background: '#FDEDEC', border: '1px solid #E74C3C', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#E74C3C', margin: '0 0 6px' }}>{importReagentError.error}</p>
                      {importReagentError.details?.map((d, i) => <p key={i} style={{ fontSize: '12px', color: '#C0392B', margin: '2px 0' }}>• {d}</p>)}
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0' }}>Download the Draft to get a file with the correct column names and order.</p>
                    </div>
                    <button onClick={() => setImportReagentError(null)} style={{ background: 'none', border: 'none', color: '#E74C3C', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 0 0 12px' }}>×</button>
                  </div>
                </div>
              )}

              {reagentTab === 'misc' && (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
                  <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <colgroup>{reagentsWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        {[['category','Category'],['name','Item'],['vendor','Vendor'],['catalog_number','Cat number'],['unit_description','Unit description'],['unit_price','Unit price'],['units','Units (n)'],['quantity_in_lab','Unused']].map(([key, label], i) => (
                          <th key={key} onClick={() => { if (reagentsSortCol === key) { setReagentsSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setReagentsSortCol(key); setReagentsSortDir('asc'); } }} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: reagentsSortCol === key ? 'var(--purple-primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', position: 'relative' }}>
                            {label}{reagentsSortCol === key ? (reagentsSortDir === 'asc' ? ' ↑' : ' ↓') : ''}<ColResizer colIdx={i} totalCols={8 + allFYs.length + 1} onColMouseDown={reagentsResize} />
                          </th>
                        ))}
                        {allFYs.map((fy, fi) => (
                          <th key={fy} onClick={() => { if (reagentsSortCol === fy) { setReagentsSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setReagentsSortCol(fy); setReagentsSortDir('asc'); } }} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', color: reagentsSortCol === fy ? 'var(--purple-primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', position: 'relative' }}>
                            {fyLabel(fy)}{reagentsSortCol === fy ? (reagentsSortDir === 'asc' ? ' ↑' : ' ↓') : ''}<ColResizer colIdx={8 + fi} totalCols={8 + allFYs.length + 1} onColMouseDown={reagentsResize} />
                          </th>
                        ))}
                        <th onClick={() => { if (reagentsSortCol === 'fy_total') { setReagentsSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setReagentsSortCol('fy_total'); setReagentsSortDir('asc'); } }} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', color: reagentsSortCol === 'fy_total' ? 'var(--purple-primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                          Total{reagentsSortCol === 'fy_total' ? (reagentsSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedReagents.length === 0 && (
                        <tr><td colSpan={8 + allFYs.length + 1} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{reagentSearch ? `No reagents match "${reagentSearch}"` : 'No reagents yet.'}</td></tr>
                      )}
                      {sortedReagents.map(r => (
                        <tr key={r.id} onClick={() => canManage && openEditReagent(r)} style={{ borderTop: '1px solid var(--border)', cursor: canManage ? 'pointer' : 'default' }}
                          onMouseEnter={e => { if (canManage) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.category}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.vendor}</td>
                          <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.catalog_number}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.unit_description ?? '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.unit_price != null ? `$${Number(r.unit_price).toLocaleString()}` : '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>{r.units ?? '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>{r.quantity_in_lab ?? '—'}</td>
                          {allFYs.map(fy => { const cnt = catalogByNum[r.catalog_number]?.fyCounts?.[fy] || 0; return <td key={fy} style={{ padding: '10px 12px', fontSize: '12px', color: cnt ? 'var(--purple-primary)' : 'var(--text-muted)', textAlign: 'center', fontWeight: cnt ? 600 : 400 }}>{cnt || '—'}</td>; })}
                          {(() => { const total = Object.values(catalogByNum[r.catalog_number]?.fyCounts || {}).reduce((s,n) => s+n, 0); return <td style={{ padding: '10px 12px', fontSize: '12px', color: total ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center', fontWeight: total ? 600 : 400 }}>{total || '—'}</td>; })()}
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
                    <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <colgroup>{nanoseqWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
                      <thead><tr style={{ background: 'var(--bg-secondary)' }}>{['Protocol','Item','Vendor','Code','Cost','Amount','nRxn','Link'].map((h, i) => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', position: 'relative' }}>{h}<ColResizer colIdx={i} totalCols={8 + allFYs.length + 1} onColMouseDown={nanoseqResize} /></th>)}{allFYs.map((fy, fi) => <th key={fy} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', position: 'relative' }}>{fyLabel(fy)}<ColResizer colIdx={8 + fi} totalCols={8 + allFYs.length + 1} onColMouseDown={nanoseqResize} /></th>)}<th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Total</th></tr></thead>
                      <tbody>
                        {filteredNanoseq.length === 0 && (
                          <tr><td colSpan={8 + allFYs.length + 1} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No reagents match "{reagentSearch}"</td></tr>
                        )}
                        {filteredNanoseq.map(r => { const fyData = catalogByNum[r.code]?.fyCounts || {}; const total = Object.values(fyData).reduce((s,n) => s+n, 0); return <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.protocol}</td><td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.company}</td><td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.code}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-primary)' }}>{r.cost ? `$${r.cost.toLocaleString()}` : '—'}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>{r.amount}</td><td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>{r.n_reactions ?? '—'}</td><td style={{ padding: '10px 12px', fontSize: '12px' }}>{r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple-primary)', textDecoration: 'none', fontSize: '11px' }}>View</a>}</td>{allFYs.map(fy => { const cnt = fyData[fy] || 0; return <td key={fy} style={{ padding: '10px 12px', fontSize: '12px', color: cnt ? 'var(--purple-primary)' : 'var(--text-muted)', textAlign: 'center', fontWeight: cnt ? 600 : 400 }}>{cnt || '—'}</td>; })}<td style={{ padding: '10px 12px', fontSize: '12px', color: total ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center', fontWeight: total ? 600 : 400 }}>{total || '—'}</td></tr>; })}
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

              {/* Global year filter bar for charts 1–3 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter charts by year:</span>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setDraftGlobalYears(selectedGlobalYears); setGlobalYearOpen(v => !v); }}
                    style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${selectedGlobalYears.length > 0 ? 'var(--purple-primary)' : 'var(--border)'}`, background: selectedGlobalYears.length > 0 ? '#F5EEF8' : 'var(--bg-primary)', color: selectedGlobalYears.length > 0 ? 'var(--purple-primary)' : 'var(--text-primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {selectedGlobalYears.length === 0 ? 'All Years' : selectedGlobalYears.map(fy => fy.toUpperCase()).join(', ')}
                    <span style={{ fontSize: '10px' }}>▼</span>
                  </button>
                  {globalYearOpen && (
                    <div style={{ position: 'absolute', zIndex: 200, top: 'calc(100% + 4px)', left: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', width: '200px', boxShadow: 'var(--shadow-lg)' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <button onClick={() => setDraftGlobalYears([...allFYs])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>All</button>
                        <button onClick={() => setDraftGlobalYears([])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {allFYs.map(fy => (
                          <label key={fy} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', cursor: 'pointer', borderRadius: '4px' }}>
                            <input type="checkbox" checked={draftGlobalYears.includes(fy)} onChange={e => setDraftGlobalYears(prev => e.target.checked ? [...prev, fy] : prev.filter(x => x !== fy))} />
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{fy.toUpperCase()}</span>
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                        <button onClick={() => setGlobalYearOpen(false)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => { setSelectedGlobalYears(draftGlobalYears); setGlobalYearOpen(false); }} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>OK</button>
                      </div>
                    </div>
                  )}
                </div>
                {selectedGlobalYears.length > 0 && (
                  <button onClick={() => setSelectedGlobalYears([])} style={{ fontSize: '12px', color: 'var(--purple-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear filter</button>
                )}
              </div>

              {/* 1. Complete and Processing, totals */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Complete and Processing, totals</h3>
                  <button onClick={exportTotalsTable} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px', cursor: 'pointer' }}><Download size={12} /> Export</button>
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={totalsChartData} margin={{ top: 16, right: 16, left: 8, bottom: 16 }} barCategoryGap="40%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#555' }} />
                        <YAxis tickFormatter={v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} tick={{ fontSize: 10, fill: '#555' }} width={90} />
                        <Tooltip formatter={(v, name) => [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name]} />
                        <Bar dataKey="value" radius={[2,2,0,0]}>
                          {totalsChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: '1 1 0', minWidth: '200px' }}>
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

              {/* 2. Complete and Processing, per month */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Complete and Processing, per month</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={exportMonthTable} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px', cursor: 'pointer' }}><Download size={12} /> Export</button>
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
                          <input value={grantSearch} onChange={e => setGrantSearch(e.target.value)} placeholder="Search grants…" style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <button onClick={() => setDraftGrants([...GRANT_NAMES])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Select All</button>
                            <button onClick={() => setDraftGrants([])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear</button>
                          </div>
                          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {filteredGrantOptions.map(g => (
                              <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', cursor: 'pointer', borderRadius: '4px' }}>
                                <input type="checkbox" checked={draftGrants.includes(g)} onChange={e => setDraftGrants(prev => e.target.checked ? [...prev, g] : prev.filter(x => x !== g))} />
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
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={300}>
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
                  <div style={{ flex: '1 1 0', minWidth: '240px', maxHeight: '340px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
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
                            <td style={{ padding: '5px 10px', textAlign: 'right', color: '#CC4125' }}>{r.complete > 0 ? `$${r.complete.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', color: '#C99000' }}>{r.processing > 0 ? `$${r.processing.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#9DA9C7', borderTop: '2px solid #7A8AB5', fontWeight: 700 }}>
                          <td style={{ padding: '7px 10px', color: 'white' }}>Grand Total</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066' }}>${tableTotalComplete.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066' }}>{tableTotalProcessing > 0 ? `$${tableTotalProcessing.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* 3. Complete and Processing, per expense type */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Complete and Processing, per expense type</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={exportExpTypeTable} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px', cursor: 'pointer' }}><Download size={12} /> Export</button>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => { setDraftGrantsExpType(selectedGrantsExpType); setGrantSearchExpType(''); setGrantFilterExpTypeOpen(v => !v); }}
                        style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {selectedGrantsExpType.length === 0 ? 'All Grants' : `${selectedGrantsExpType.length} Grant${selectedGrantsExpType.length > 1 ? 's' : ''} Selected`}
                        <span style={{ fontSize: '10px' }}>▼</span>
                      </button>
                      {grantFilterExpTypeOpen && (
                        <div style={{ position: 'absolute', zIndex: 200, top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', width: '340px', boxShadow: 'var(--shadow-lg)' }}>
                          <input value={grantSearchExpType} onChange={e => setGrantSearchExpType(e.target.value)} placeholder="Search grants…" style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <button onClick={() => setDraftGrantsExpType([...GRANT_NAMES])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Select All</button>
                            <button onClick={() => setDraftGrantsExpType([])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear</button>
                          </div>
                          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {filteredGrantOptionsExpType.map(g => (
                              <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', cursor: 'pointer', borderRadius: '4px' }}>
                                <input type="checkbox" checked={draftGrantsExpType.includes(g)} onChange={e => setDraftGrantsExpType(prev => e.target.checked ? [...prev, g] : prev.filter(x => x !== g))} />
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{g}</span>
                              </label>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                            <button onClick={() => setGrantFilterExpTypeOpen(false)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => { setSelectedGrantsExpType(draftGrantsExpType); setGrantFilterExpTypeOpen(false); }} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>OK</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={catStatusDataFiltered} margin={{ top: 24, right: 16, left: 16, bottom: 100 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#555' }} angle={-45} textAnchor="end" interval={0} />
                        <YAxis tickFormatter={v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} tick={{ fontSize: 11, fill: '#555' }} />
                        <Tooltip formatter={(v, name) => [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name === 'complete' ? 'Complete' : 'Processing']} />
                        <Legend verticalAlign="top" height={32} formatter={v => v === 'complete' ? 'complete' : 'processing'} />
                        <Bar dataKey="complete" name="complete" stackId="a" fill={CHART_BLUE} />
                        <Bar dataKey="processing" name="processing" stackId="a" fill={CHART_RED} radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: '1 1 0', minWidth: '220px', maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ background: '#9DA9C7' }}>
                          <th style={{ padding: '7px 10px', textAlign: 'left', color: 'white', fontWeight: 600 }}>Category</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600 }}>Complete</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600 }}>Processing</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catStatusDataFiltered.map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white', borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '5px 10px', color: '#1A1A2E' }}>{row.name}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', color: CHART_BLUE }}>{row.complete > 0 ? `$${row.complete.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', color: CHART_RED }}>{row.processing > 0 ? `$${row.processing.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E' }}>{(row.complete + row.processing) > 0 ? `$${(row.complete + row.processing).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#9DA9C7', borderTop: '2px solid #7A8AB5', fontWeight: 700 }}>
                          <td style={{ padding: '7px 10px', color: 'white' }}>Grand Total</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066' }}>${catStatusDataFiltered.reduce((s, r) => s + r.complete, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066' }}>${catStatusDataFiltered.reduce((s, r) => s + r.processing, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066' }}>${catStatusDataFiltered.reduce((s, r) => s + r.complete + r.processing, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* 4. Monthly Spending by Category/User */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Monthly Spending by Category/User</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={exportCatMonthTable} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px', cursor: 'pointer' }}><Download size={12} /> Export</button>

                    {/* User filter */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => { setDraftUsers(selectedUsers); setUserSearch(''); setUserFilterOpen(v => !v); }}
                        style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {selectedUsers.length === 0 ? 'All Users' : `${selectedUsers.length} User${selectedUsers.length > 1 ? 's' : ''} Selected`}
                        <span style={{ fontSize: '10px' }}>▼</span>
                      </button>
                      {userFilterOpen && (
                        <div style={{ position: 'absolute', zIndex: 200, top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', width: '260px', boxShadow: 'var(--shadow-lg)' }}>
                          <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users…" style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <button onClick={() => setDraftUsers([...userNames])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Select All</button>
                            <button onClick={() => setDraftUsers([])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear</button>
                          </div>
                          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {userNames.filter(u => u.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                              <label key={u} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', cursor: 'pointer', borderRadius: '4px' }}>
                                <input type="checkbox" checked={draftUsers.includes(u)} onChange={e => setDraftUsers(prev => e.target.checked ? [...prev, u] : prev.filter(x => x !== u))} />
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{u}</span>
                              </label>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                            <button onClick={() => setUserFilterOpen(false)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => { setSelectedUsers(draftUsers); setUserFilterOpen(false); }} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>OK</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Category filter */}
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
                          <input value={categorySearch} onChange={e => setCategorySearch(e.target.value)} placeholder="Search categories…" style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <button onClick={() => setDraftCategories([...CATEGORIES])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Select All</button>
                            <button onClick={() => setDraftCategories([])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear</button>
                          </div>
                          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {filteredCategoryOptions.map(cat => (
                              <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', cursor: 'pointer', borderRadius: '4px' }}>
                                <input type="checkbox" checked={draftCategories.includes(cat)} onChange={e => setDraftCategories(prev => e.target.checked ? [...prev, cat] : prev.filter(x => x !== cat))} />
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
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <LineChart data={userCatData.data} margin={{ top: 20, right: 16, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555' }} />
                        <YAxis scale="log" domain={[1, 'auto']} ticks={[1, 10, 100, 1000, 10000, 100000]}
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
                  </div>
                  <div style={{ flex: '1 1 0', minWidth: '240px', maxHeight: '420px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '11px', minWidth: '280px' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ background: '#9DA9C7' }}>
                          <th style={{ padding: '7px 10px', textAlign: 'left', color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>Category</th>
                          {userCatData.months.map(m => <th key={m} style={{ padding: '7px 8px', textAlign: 'right', color: '#FFE066', fontWeight: 600, whiteSpace: 'nowrap' }}>{m}</th>)}
                          <th style={{ padding: '7px 8px', textAlign: 'right', color: '#FFE066', fontWeight: 600, whiteSpace: 'nowrap' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCats.map((cat, i) => {
                          const rowTotal = userCatData.months.reduce((s, m, mi) => s + (userCatData.data[mi]?.[cat] || 0), 0);
                          return (
                            <tr key={cat} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white', borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                                <span style={{ backgroundColor: CATEGORY_COLORS[cat] || '#888888', width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                                <span style={{ color: '#1A1A2E', verticalAlign: 'middle' }}>{cat}</span>
                              </td>
                              {userCatData.months.map((m, mi) => {
                                const val = userCatData.data[mi]?.[cat];
                                return <td key={m} style={{ padding: '5px 8px', textAlign: 'right', color: '#1A1A2E', whiteSpace: 'nowrap' }}>{val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>;
                              })}
                              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', whiteSpace: 'nowrap' }}>{rowTotal > 0 ? `$${rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#9DA9C7', borderTop: '2px solid #7A8AB5', fontWeight: 700 }}>
                          <td style={{ padding: '7px 10px', color: 'white', whiteSpace: 'nowrap' }}>Grand Total</td>
                          {userCatData.months.map((m, mi) => {
                            const colTotal = activeCats.reduce((s, cat) => s + (userCatData.data[mi]?.[cat] || 0), 0);
                            return <td key={m} style={{ padding: '7px 8px', textAlign: 'right', color: '#FFE066', whiteSpace: 'nowrap' }}>{colTotal > 0 ? `$${colTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>;
                          })}
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: '#FFE066', whiteSpace: 'nowrap' }}>
                            ${activeCats.reduce((s, cat) => s + userCatData.months.reduce((ss, m, mi) => ss + (userCatData.data[mi]?.[cat] || 0), 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'annual-summary' && (() => {
            const { fyTotalsData, monthlyData, catData, activeYears } = multiYearData;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                {/* Year selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Years included:</span>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => { setAnnualSummaryDraftYears(annualSummaryYears); setAnnualSummaryYearOpen(v => !v); }}
                      style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${annualSummaryYears.length > 0 ? 'var(--purple-primary)' : 'var(--border)'}`, background: annualSummaryYears.length > 0 ? '#F5EEF8' : 'var(--bg-primary)', color: annualSummaryYears.length > 0 ? 'var(--purple-primary)' : 'var(--text-primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {annualSummaryYears.length === 0 ? 'All Years' : annualSummaryYears.map(fy => fy.toUpperCase()).join(', ')}
                      <span style={{ fontSize: '10px' }}>▼</span>
                    </button>
                    {annualSummaryYearOpen && (
                      <div style={{ position: 'absolute', zIndex: 200, top: 'calc(100% + 4px)', left: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', width: '180px', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <button onClick={() => setAnnualSummaryDraftYears([...allFYs])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>All</button>
                          <button onClick={() => setAnnualSummaryDraftYears([])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {allFYs.map(fy => (
                            <label key={fy} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', cursor: 'pointer', borderRadius: '4px' }}>
                              <input type="checkbox" checked={annualSummaryDraftYears.includes(fy)} onChange={e => setAnnualSummaryDraftYears(prev => e.target.checked ? [...prev, fy] : prev.filter(x => x !== fy))} />
                              <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{fy.toUpperCase()}</span>
                            </label>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                          <button onClick={() => setAnnualSummaryYearOpen(false)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                          <button onClick={() => { setAnnualSummaryYears(annualSummaryDraftYears); setAnnualSummaryYearOpen(false); }} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>OK</button>
                        </div>
                      </div>
                    )}
                  </div>
                  {annualSummaryYears.length > 0 && (
                    <button onClick={() => setAnnualSummaryYears([])} style={{ fontSize: '12px', color: 'var(--purple-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear filter</button>
                  )}
                </div>

                {/* KPI cards per FY */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {fyTotalsData.map((d, i) => (
                    <div key={d.fy} style={{ flex: '1 1 160px', background: 'var(--bg-primary)', border: `2px solid ${FY_PALETTE[i % FY_PALETTE.length]}22`, borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: FY_PALETTE[i % FY_PALETTE.length], textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>{d.fy}</div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>${Math.round(d.total).toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>{d.count} orders</div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                        <span style={{ color: CHART_BLUE }}>✓ ${Math.round(d.complete).toLocaleString()}</span>
                        <span style={{ color: CHART_RED }}>⟳ ${Math.round(d.processing).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart 1: Total spend per fiscal year */}
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 20px' }}>Total spend per fiscal year</h3>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 0', minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={fyTotalsData} margin={{ top: 16, right: 16, left: 8, bottom: 16 }} barCategoryGap="40%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                          <XAxis dataKey="fy" tick={{ fontSize: 13, fill: '#555', fontWeight: 600 }} />
                          <YAxis tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} tick={{ fontSize: 10, fill: '#555' }} width={70} />
                          <Tooltip formatter={(v, name) => [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name === 'complete' ? 'Complete' : name === 'processing' ? 'Processing' : 'Pending']} />
                          <Legend verticalAlign="top" height={32} />
                          <Bar dataKey="complete" name="complete" stackId="a" fill={CHART_BLUE} />
                          <Bar dataKey="processing" name="processing" stackId="a" fill={CHART_RED} />
                          <Bar dataKey="pending" name="pending" stackId="a" fill="#F39C12" radius={[2,2,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ flex: '0 0 auto', minWidth: '260px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', fontSize: '12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#9DA9C7' }}>
                            <th style={{ padding: '7px 12px', textAlign: 'left', color: 'white', fontWeight: 600 }}>FY</th>
                            <th style={{ padding: '7px 12px', textAlign: 'right', color: '#FFE066', fontWeight: 600 }}>Total spend</th>
                            <th style={{ padding: '7px 12px', textAlign: 'right', color: '#FFE066', fontWeight: 600 }}>Orders</th>
                            <th style={{ padding: '7px 12px', textAlign: 'right', color: '#FFE066', fontWeight: 600 }}>Avg/order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fyTotalsData.map((d, i) => (
                            <tr key={d.fy} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white', borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '6px 12px', fontWeight: 700, color: FY_PALETTE[i % FY_PALETTE.length] }}>{d.fy}</td>
                              <td style={{ padding: '6px 12px', textAlign: 'right', color: '#1A1A2E', fontWeight: 600 }}>${Math.round(d.total).toLocaleString()}</td>
                              <td style={{ padding: '6px 12px', textAlign: 'right', color: '#1A1A2E' }}>{d.count}</td>
                              <td style={{ padding: '6px 12px', textAlign: 'right', color: '#1A1A2E' }}>{d.count > 0 ? `$${Math.round(d.total / d.count).toLocaleString()}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        {fyTotalsData.length > 1 && (
                          <tfoot>
                            <tr style={{ background: '#9DA9C7', borderTop: '2px solid #7A8AB5', fontWeight: 700 }}>
                              <td style={{ padding: '7px 12px', color: 'white' }}>Total</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', color: '#FFE066' }}>${Math.round(fyTotalsData.reduce((s, d) => s + d.total, 0)).toLocaleString()}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', color: '#FFE066' }}>{fyTotalsData.reduce((s, d) => s + d.count, 0)}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', color: '#FFE066' }}>—</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>

                {/* Chart 2: Monthly spend overlay — same calendar months, one line per FY */}
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Monthly spend by year</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 20px' }}>Calendar months overlaid — compare seasonal patterns across fiscal years</p>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 0', minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={monthlyData} margin={{ top: 16, right: 16, left: 8, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555' }} />
                          <YAxis tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} tick={{ fontSize: 10, fill: '#555' }} width={70} />
                          <Tooltip formatter={(v, name) => v > 0 ? [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name.toUpperCase()] : ['-', name.toUpperCase()]} />
                          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} formatter={v => v.toUpperCase()} />
                          {activeYears.map((fy, i) => (
                            <Line key={fy} type="linear" dataKey={fy} stroke={FY_PALETTE[i % FY_PALETTE.length]}
                              dot={{ r: 3, fill: FY_PALETTE[i % FY_PALETTE.length], strokeWidth: 0 }}
                              strokeWidth={2} connectNulls={false} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ flex: '0 0 auto', minWidth: '260px', maxHeight: '340px', overflowX: 'auto', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '11px' }}>
                      <table style={{ borderCollapse: 'collapse', minWidth: '200px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr style={{ background: '#9DA9C7' }}>
                            <th style={{ padding: '7px 10px', textAlign: 'left', color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>Month</th>
                            {activeYears.map((fy, i) => <th key={fy} style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600, whiteSpace: 'nowrap' }}>{fy.toUpperCase()}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyData.map((row, i) => (
                            <tr key={row.month} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white', borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '5px 10px', color: '#1A1A2E', whiteSpace: 'nowrap', fontWeight: 600 }}>{row.month}</td>
                              {activeYears.map(fy => <td key={fy} style={{ padding: '5px 10px', textAlign: 'right', color: row[fy] > 0 ? '#1A1A2E' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{row[fy] > 0 ? `$${Math.round(row[fy]).toLocaleString()}` : '—'}</td>)}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#9DA9C7', borderTop: '2px solid #7A8AB5', fontWeight: 700 }}>
                            <td style={{ padding: '7px 10px', color: 'white' }}>Total</td>
                            {activeYears.map((fy, i) => (
                              <td key={fy} style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', whiteSpace: 'nowrap' }}>
                                ${Math.round(monthlyData.reduce((s, row) => s + (row[fy] || 0), 0)).toLocaleString()}
                              </td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Chart 3: Spend by category — year comparison */}
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 20px' }}>Spend by expense type — year comparison</h3>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 0', minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={catData} margin={{ top: 16, right: 16, left: 8, bottom: 100 }} barCategoryGap="25%" barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#555' }} angle={-45} textAnchor="end" interval={0} />
                          <YAxis tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} tick={{ fontSize: 10, fill: '#555' }} width={70} />
                          <Tooltip formatter={(v, name) => [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name.toUpperCase()]} />
                          <Legend verticalAlign="top" height={32} formatter={v => v.toUpperCase()} />
                          {activeYears.map((fy, i) => (
                            <Bar key={fy} dataKey={fy} name={fy} fill={FY_PALETTE[i % FY_PALETTE.length]} radius={[2,2,0,0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ flex: '0 0 auto', minWidth: '260px', maxHeight: '440px', overflowX: 'auto', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '11px' }}>
                      <table style={{ borderCollapse: 'collapse', minWidth: '220px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr style={{ background: '#9DA9C7' }}>
                            <th style={{ padding: '7px 10px', textAlign: 'left', color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>Category</th>
                            {activeYears.map(fy => <th key={fy} style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600, whiteSpace: 'nowrap' }}>{fy.toUpperCase()}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {catData.map((row, i) => (
                            <tr key={row.name} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white', borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '5px 10px', color: '#1A1A2E', whiteSpace: 'nowrap' }}>{row.name}</td>
                              {activeYears.map(fy => <td key={fy} style={{ padding: '5px 10px', textAlign: 'right', color: row[fy] > 0 ? '#1A1A2E' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{row[fy] > 0 ? `$${Math.round(row[fy]).toLocaleString()}` : '—'}</td>)}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#9DA9C7', borderTop: '2px solid #7A8AB5', fontWeight: 700 }}>
                            <td style={{ padding: '7px 10px', color: 'white' }}>Grand Total</td>
                            {activeYears.map(fy => (
                              <td key={fy} style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', whiteSpace: 'nowrap' }}>
                                ${Math.round(catData.reduce((s, row) => s + (row[fy] || 0), 0)).toLocaleString()}
                              </td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            );
          })()}

          {activeTab === 'smart-summary' && (() => {
            const thStyle = (key) => ({ padding: '8px 10px', textAlign: ['unit_price','units','total','is_standardized'].includes(key) || key.startsWith('fy') ? 'center' : 'left', fontSize: '11px', color: catalogSortCol === key ? 'var(--purple-primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', fontWeight: 600 });
            const tdStyle = (opts = {}) => ({ padding: '7px 10px', fontSize: '12px', color: opts.color || 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: opts.center ? 'center' : 'left', fontFamily: opts.mono ? 'monospace' : undefined, fontWeight: opts.bold ? 700 : undefined, maxWidth: opts.maxW || undefined });
            const sortHeader = (key, label) => (
              <th key={key} style={thStyle(key)} onClick={() => { if (catalogSortCol === key) setCatalogSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setCatalogSortCol(key); setCatalogSortDir('asc'); } }}>
                {label}{catalogSortCol === key ? (catalogSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            );
            const { data: vcData, months: vcMonths, activeV } = vendorChartData;
            const vcMonthLookup = {};
            vcData.forEach(d => { vcMonthLookup[d.month] = d; });
            const dropdownBox = { position: 'absolute', zIndex: 200, top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', width: '280px', boxShadow: 'var(--shadow-lg)' };
            const filterBtn = () => ({ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' });
            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

              {/* Vendor spending chart */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spending by Vendor</h3>
                    <button onClick={handleExportVendorChart} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px', cursor: 'pointer' }}><Download size={12} /> Export</button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>

                    <div style={{ position: 'relative' }}>
                      <button onClick={() => { setVcDraftYears(vcSelectedYears); setVcYearOpen(v => !v); }} style={filterBtn()}>
                        {vcSelectedYears.length === 0 ? 'All Years' : vcSelectedYears.map(fyLabel).join(', ')}
                        <span style={{ fontSize: '10px' }}>▼</span>
                      </button>
                      {vcYearOpen && (
                        <div style={{ ...dropdownBox, width: '180px' }}>
                          {allFYs.map(fy => (
                            <label key={fy} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                              <input type="checkbox" checked={vcDraftYears.includes(fy)} onChange={e => setVcDraftYears(prev => e.target.checked ? [...prev, fy] : prev.filter(x => x !== fy))} />
                              {fyLabel(fy)}
                            </label>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                            <button onClick={() => setVcYearOpen(false)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => { setVcSelectedYears(vcDraftYears); setVcYearOpen(false); }} style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>OK</button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ position: 'relative' }}>
                      <button onClick={() => { setVcDraftVendors(vcSelectedVendors); setVcVendorSearch(''); setVcVendorOpen(v => !v); }} style={filterBtn()}>
                        {vcSelectedVendors.length === 0 ? 'All Vendors' : `${vcSelectedVendors.length} Vendor${vcSelectedVendors.length > 1 ? 's' : ''} Selected`}
                        <span style={{ fontSize: '10px' }}>▼</span>
                      </button>
                      {vcVendorOpen && (
                        <div style={dropdownBox}>
                          <input value={vcVendorSearch} onChange={e => setVcVendorSearch(e.target.value)} placeholder="Search vendors…" style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <button onClick={() => setVcDraftVendors([...allVendorNames])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>All</button>
                            <button onClick={() => setVcDraftVendors([])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear</button>
                          </div>
                          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {allVendorNames.filter(v => v.toLowerCase().includes(vcVendorSearch.toLowerCase())).map(v => (
                              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', cursor: 'pointer', borderRadius: '4px' }}>
                                <input type="checkbox" checked={vcDraftVendors.includes(v)} onChange={e => setVcDraftVendors(prev => e.target.checked ? [...prev, v] : prev.filter(x => x !== v))} />
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{v}</span>
                              </label>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                            <button onClick={() => setVcVendorOpen(false)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => { setVcSelectedVendors(vcDraftVendors); setVcVendorOpen(false); }} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>OK</button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ position: 'relative' }}>
                      <button onClick={() => { setVcDraftCategories(vcSelectedCategories); setVcCategorySearch(''); setVcCategoryOpen(v => !v); }} style={filterBtn()}>
                        {vcSelectedCategories.length === 0 ? 'All Categories' : `${vcSelectedCategories.length} Categor${vcSelectedCategories.length > 1 ? 'ies' : 'y'} Selected`}
                        <span style={{ fontSize: '10px' }}>▼</span>
                      </button>
                      {vcCategoryOpen && (
                        <div style={{ ...dropdownBox, width: '280px' }}>
                          <input value={vcCategorySearch} onChange={e => setVcCategorySearch(e.target.value)} placeholder="Search categories…" style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <button onClick={() => setVcDraftCategories([...CATEGORIES])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>All</button>
                            <button onClick={() => setVcDraftCategories([])} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear</button>
                          </div>
                          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {CATEGORIES.filter(c => c.toLowerCase().includes(vcCategorySearch.toLowerCase())).map(c => (
                              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', cursor: 'pointer', borderRadius: '4px' }}>
                                <input type="checkbox" checked={vcDraftCategories.includes(c)} onChange={e => setVcDraftCategories(prev => e.target.checked ? [...prev, c] : prev.filter(x => x !== c))} />
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[c] || '#888888', flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{c}</span>
                              </label>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                            <button onClick={() => setVcCategoryOpen(false)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => { setVcSelectedCategories(vcDraftCategories); setVcCategoryOpen(false); }} style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>OK</button>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <LineChart data={vendorChartData.data} margin={{ top: 20, right: 16, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555' }} />
                        <YAxis tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} tick={{ fontSize: 10, fill: '#555' }} width={60} />
                        <Tooltip formatter={(v, name) => v != null ? [`$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, name] : ['-', name]} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }} />
                        {activeV.slice(0, 20).map((v, i) => (
                          <Line key={v} type="linear" dataKey={v} stroke={VENDOR_PALETTE[i % VENDOR_PALETTE.length]}
                            dot={{ r: 3, fill: VENDOR_PALETTE[i % VENDOR_PALETTE.length], strokeWidth: 0 }}
                            strokeWidth={1.5} connectNulls={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                    {activeV.length > 20 && <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>Showing top 20 vendors by spend. Use the vendor filter to select specific vendors.</p>}
                  </div>

                  <div style={{ flex: '1 1 0', minWidth: '220px', maxHeight: '420px', overflowX: 'auto', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
                    <table style={{ borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ background: '#9DA9C7' }}>
                          <th style={{ padding: '7px 10px', textAlign: 'left', color: 'white', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#9DA9C7', zIndex: 2 }}>Vendor</th>
                          {vcMonths.map(m => <th key={m} style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600, whiteSpace: 'nowrap' }}>{m}</th>)}
                          <th style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066', fontWeight: 600, whiteSpace: 'nowrap' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeV.map((v, i) => {
                          const total = vcMonths.reduce((s, m) => s + (vcMonthLookup[m]?.[v] || 0), 0);
                          return (
                            <tr key={v} style={{ background: i % 2 === 0 ? '#F0F3FA' : 'white', borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '5px 10px', color: '#1A1A2E', whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', position: 'sticky', left: 0, background: i % 2 === 0 ? '#F0F3FA' : 'white', zIndex: 1 }}>
                                <span style={{ backgroundColor: VENDOR_PALETTE[i % VENDOR_PALETTE.length], width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                                {v}
                              </td>
                              {vcMonths.map(m => <td key={m} style={{ padding: '5px 10px', textAlign: 'right', color: '#1A1A2E', whiteSpace: 'nowrap' }}>{vcMonthLookup[m]?.[v] ? `$${vcMonthLookup[m][v].toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}</td>)}
                              <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', whiteSpace: 'nowrap' }}>${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#9DA9C7', borderTop: '2px solid #7A8AB5', fontWeight: 700 }}>
                          <td style={{ padding: '7px 10px', color: 'white', position: 'sticky', left: 0, background: '#9DA9C7', zIndex: 1 }}>Grand Total</td>
                          {vcMonths.map(m => {
                            const t = activeV.reduce((s, v) => s + (vcMonthLookup[m]?.[v] || 0), 0);
                            return <td key={m} style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066' }}>{t > 0 ? `$${t.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}</td>;
                          })}
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#FFE066' }}>
                            ${activeV.reduce((s, v) => s + vcMonths.reduce((ss, m) => ss + (vcMonthLookup[m]?.[v] || 0), 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* Catalog table */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Orders by Catalog Number <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({sortedCatalogRows.length} unique)</span>
                  </h3>
                  <button onClick={handleExportCatalog} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px', cursor: 'pointer' }}><Download size={12} /> Export</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '1300px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        {sortHeader('item', 'Item')}
                        {sortHeader('vendor', 'Vendor')}
                        {sortHeader('category', 'Category')}
                        {sortHeader('catalog_number', 'Cat #')}
                        {sortHeader('unit_description', 'Unit description')}
                        {sortHeader('unit_price', 'Unit price')}
                        {sortHeader('units', 'Units (n)')}
                        {sortHeader('is_standardized', 'Std. Reagent')}
                        {allFYs.map(fy => sortHeader(fy, fyLabel(fy)))}
                        {sortHeader('total', 'Total')}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCatalogRows.length === 0 && (
                        <tr><td colSpan={9 + allFYs.length} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No orders with catalog numbers found.</td></tr>
                      )}
                      {sortedCatalogRows.map((r, i) => (
                        <tr key={r.catalog_number} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                          <td style={{ ...tdStyle(), whiteSpace: 'normal', minWidth: '200px' }}>{r.item}</td>
                          <td style={tdStyle({ maxW: '120px' })}>{r.vendor || '—'}</td>
                          <td style={tdStyle({ maxW: '140px' })}>{r.category || '—'}</td>
                          <td style={tdStyle({ mono: true, color: 'var(--text-muted)' })}>{r.catalog_number}</td>
                          <td style={tdStyle()}>{r.unit_description || '—'}</td>
                          <td style={tdStyle({ center: true })}>{r.unit_price != null ? `$${Number(r.unit_price).toLocaleString()}` : '—'}</td>
                          <td style={tdStyle({ center: true })}>{r.units ?? '—'}</td>
                          <td style={{ ...tdStyle({ center: true }), color: r.is_standardized ? '#27AE60' : 'var(--text-muted)', fontWeight: r.is_standardized ? 600 : 400 }}>{r.is_standardized ? 'Yes' : 'No'}</td>
                          {allFYs.map(fy => <td key={fy} style={tdStyle({ center: true, color: r.fyCounts[fy] ? 'var(--purple-primary)' : 'var(--text-muted)', bold: !!r.fyCounts[fy] })}>{r.fyCounts[fy] || '—'}</td>)}
                          <td style={tdStyle({ center: true, bold: true, color: 'var(--text-primary)' })}>{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
            );
          })()}

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

      {showImportFYModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '28px', width: '380px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Import Orders — Select Fiscal Year</h2>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fiscal Year *</label>
            <input
              type="text"
              value={importFYInput}
              onChange={e => { setImportFYInput(e.target.value); setImportFYError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmImportFY(); }}
              placeholder="e.g. FY27"
              autoFocus
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${importFYError ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '6px' }}
            />
            <p style={{ fontSize: '11px', color: importFYError ? 'var(--danger)' : 'var(--text-muted)', margin: '0 0 16px', fontWeight: importFYError ? 600 : 400 }}>
              {importFYError || 'Required format: FY followed by 2 digits (e.g. FY24, FY27). Upper or lower case accepted.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowImportFYModal(false)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConfirmImportFY} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Continue</button>
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
              {[{label:'Item Name *',key:'item',full:true},{label:'Catalog Number *',key:'catalog_number'},{label:'Requisition ID *',key:'requisition_id'},{label:'Unit Description *',key:'unit_description'},{label:'Unit Price ($) *',key:'unit_price',type:'number'},{label:'Units (n) *',key:'units',type:'number'},{label:'Order Date *',key:'order_date',type:'date'}].map(field => (
                <div key={field.key} style={{ gridColumn: field.full ? '1 / -1' : 'auto' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}</label>
                  <input type={field.type || 'text'} value={newOrder[field.key]} onChange={e => setNewOrder(p => ({ ...p, [field.key]: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category *</label>
                <select value={newOrder.category} onChange={e => setNewOrder(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', background: 'var(--bg-primary)' }}>
                  <option value="">— Select category —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grant *</label>
                <input list="order-grant-list" value={newOrder.grant_name} onChange={e => setNewOrder(p => ({ ...p, grant_name: e.target.value }))} placeholder="Select or type grant..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                <datalist id="order-grant-list">
                  {grants.map(g => <option key={g.id} value={g.name} />)}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendor *</label>
                <input list="order-vendor-list" value={newOrder.vendor} onChange={e => setNewOrder(p => ({ ...p, vendor: e.target.value }))} placeholder="Select or type vendor..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                <datalist id="order-vendor-list">
                  {vendors.map(v => <option key={v.id} value={v.name} />)}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requestor *</label>
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
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status *</label>
                <select value={newOrder.status} onChange={e => setNewOrder(p => ({ ...p, status: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}>
                  <option value="pending">Pending</option><option value="processing">Processing</option><option value="complete">Complete</option><option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
                <textarea value={newOrder.notes} onChange={e => setNewOrder(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Unit description</label>
                  <input value={reagentForm.unit_description} onChange={e => setReagentForm(p => ({ ...p, unit_description: e.target.value }))} placeholder="e.g. 1mg vial" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Unit price</label>
                  <input type="number" step="0.01" value={reagentForm.unit_price} onChange={e => setReagentForm(p => ({ ...p, unit_price: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Units (n)</label>
                  <input type="number" value={reagentForm.units} onChange={e => setReagentForm(p => ({ ...p, units: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                {[['quantity_in_lab','Unused'],['fy26_purchases',"FY'26"],['fy25_purchases',"FY'25"],['fy24_purchases',"FY'24"]].map(([key, label]) => (
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

      {showAddNanoseq && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '480px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Nanoseq Reagent</h2>
            <form onSubmit={handleAddNanoseq} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Protocol</label>
                  <input value={nanoseqForm.protocol} onChange={e => setNanoseqForm(p => ({ ...p, protocol: e.target.value }))} placeholder="e.g. DNA Library Prep" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Name *</label>
                  <input required value={nanoseqForm.name} onChange={e => setNanoseqForm(p => ({ ...p, name: e.target.value }))} placeholder="Reagent name" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Company</label>
                  <input value={nanoseqForm.company} onChange={e => setNanoseqForm(p => ({ ...p, company: e.target.value }))} placeholder="e.g. NEB" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Code</label>
                  <input value={nanoseqForm.code} onChange={e => setNanoseqForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. E7645L" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Link</label>
                <input value={nanoseqForm.link} onChange={e => setNanoseqForm(p => ({ ...p, link: e.target.value }))} placeholder="https://..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Cost</label>
                  <input type="number" step="0.01" value={nanoseqForm.cost} onChange={e => setNanoseqForm(p => ({ ...p, cost: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Amount</label>
                  <input value={nanoseqForm.amount} onChange={e => setNanoseqForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 24 rxns" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>N Reactions</label>
                  <input type="number" value={nanoseqForm.n_reactions} onChange={e => setNanoseqForm(p => ({ ...p, n_reactions: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddNanoseq(false)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Unit description</label>
                  <input value={editReagentForm.unit_description || ''} onChange={e => setEditReagentForm(p => ({ ...p, unit_description: e.target.value }))} placeholder="e.g. 1mg vial" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Unit price</label>
                  <input type="number" step="0.01" value={editReagentForm.unit_price || ''} onChange={e => setEditReagentForm(p => ({ ...p, unit_price: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Units (n)</label>
                  <input type="number" value={editReagentForm.units || ''} onChange={e => setEditReagentForm(p => ({ ...p, units: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                {[['quantity_in_lab','Unused'],['fy26_purchases',"FY'26"],['fy25_purchases',"FY'25"],['fy24_purchases',"FY'24"]].map(([key, label]) => (
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
