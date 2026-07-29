const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const transporter = { sendMail: async () => {} }; // emails disabled

const MONTH_MAP = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };

function excelDateToString(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string' && excelDate.includes('-')) return excelDate;
  // "Mon , YYYY" format from CSV (e.g. "Aug , 2025")
  if (typeof excelDate === 'string') {
    const m = excelDate.match(/^([A-Za-z]{3})\s*,\s*(\d{4})$/);
    if (m && MONTH_MAP[m[1]]) return `${m[2]}-${MONTH_MAP[m[1]]}-01`;
  }
  // Excel serial number
  if (typeof excelDate === 'number') {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + excelDate * 86400000).toISOString().split('T')[0];
  }
  return null;
}

const ORDERS_HEADERS = ['Item','Vendor','Catalog Number','Category','Grant ID','Requsition ID','Unit description','Unit price','Units (n)','Total price','Date','Requestor','Status','Notes'];

function missingColumns(fileHeaders, required) {
  const present = new Set(fileHeaders.map(h => String(h ?? '').trim()));
  return required.filter(h => !present.has(h));
}

// Derive fallback date for dateless rows: FY27 → 2026-07-01
function fyFallbackDate(fiscalYear) {
  const m = (fiscalYear || '').match(/^fy(\d{2})$/i);
  if (!m) return null;
  const calYear = 2000 + parseInt(m[1]) - 1;
  return `${calYear}-07-01`;
}

// Preview new orders from uploaded file
router.post('/preview-orders', upload.single('file'), async (req, res) => {
  try {
    const fallbackDate = fyFallbackDate(req.body.fiscalYear);
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets['Orders'] || workbook.Sheets[workbook.SheetNames[0]];

    const rawHeaders = (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })[0] || []).map(h => String(h ?? '').trim());
    const missing = missingColumns(rawHeaders, ORDERS_HEADERS);
    if (missing.length > 0) return res.status(400).json({ error: `File rejected — ${missing.length} required column(s) missing. Column order does not matter.`, details: missing.map(h => `Missing: "${h}"`) });

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    // Build dedup set from DB — paginate to get all rows past Supabase 1000-row limit.
    // Key: req_id::catalog_number when catalog is real (stable even if item names change between exports)
    //      req_id::item_name as fallback when catalog is NA/empty
    function makeKey(reqId, catNum, item) {
      const cat = String(catNum||'').trim();
      const req = String(reqId||'NA').trim();  // null in DB → "NA" to match CSV default
      // Strip all non-alphanumeric so "SureOne" == "Sure One", "1000uL" == "1000 ul", etc.
      const itm = String(item||'').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (cat && cat !== 'NA') ? `${req}::${cat}` : `${req}::${itm}`;
    }
    const existingSet = new Set();
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data: page } = await supabase
        .from('orders').select('item, requisition_id, catalog_number')
        .range(from, from + PAGE - 1);
      if (!page?.length) break;
      page.forEach(e => existingSet.add(makeKey(e.requisition_id, e.catalog_number, e.item)));
      if (page.length < PAGE) break;
      from += PAGE;
    }

    const newOrders = [];
    for (const row of rows) {
      const item = String(row['Item'] || row['item'] || '').trim();
      if (!item) continue;
      const reqId = String(row['Requsition ID'] || row['Requisition ID'] || 'NA').trim();
      const catNum = String(row['Catalog Number'] || row['Catalog #'] || row['catalog_number'] || '').trim();

      const key = makeKey(reqId, catNum, item);
      if (existingSet.has(key)) continue;
      existingSet.add(key);

      const rawUnitPrice = String(row['Unit Price'] || row['Unit price'] || row['unit_price'] || '').replace(/[$,]/g, '');
      const rawTotalPrice = String(row['Total Price'] || row['Total price'] || row['total_price'] || '').replace(/[$,]/g, '');

      newOrders.push({
        item,
        vendor: row['Vendor'] || row['vendor'] || null,
        catalog_number: catNum || null,
        category: String(row['Category '] ?? row['Category'] ?? row['category'] ?? '').trim() || null,
        grant_name: String(row['Grant ID'] ?? row['Grant Name'] ?? row['Grant'] ?? row['grant_name'] ?? '').trim() || null,
        requisition_id: reqId,
        unit_description: String(row['Unit Description'] ?? row['Unit description'] ?? row['unit_description'] ?? '').trim() || null,
        unit_price: parseFloat(rawUnitPrice) || null,
        units: parseInt(row['Units (n)'] || row['Units'] || row['units']) || null,
        total_price: parseFloat(rawTotalPrice) || null,
        order_date: excelDateToString(row['Date'] || row['Order Date'] || row['date']) || fallbackDate,
        requestor: (row['Requestor'] || row['requestor'] || '').trim() || null,
        status: (row['Status'] || row['status'] || 'pending').trim().toLowerCase(),
        notes: (row['Notes'] || row['notes'] || '').trim() || null
      });
    }

    res.json({ newOrders, count: newOrders.length });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete all orders and replace with CSV contents
router.post('/replace-all-orders', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets['Orders'] || workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const allOrders = [];
    for (const row of rows) {
      const item = String(row['Item'] || row['item'] || '').trim();
      if (!item) continue;
      const reqId = String(row['Requsition ID'] || row['Requisition ID'] || 'NA').trim();
      const catNum = String(row['Catalog Number'] || row['Catalog #'] || row['catalog_number'] || '').trim();
      const rawUnitPrice = String(row['Unit Price'] || row['Unit price'] || row['unit_price'] || '').replace(/[$,]/g, '');
      const rawTotalPrice = String(row['Total Price'] || row['Total price'] || row['total_price'] || '').replace(/[$,]/g, '');
      allOrders.push({
        item,
        vendor: row['Vendor'] || row['vendor'] || null,
        catalog_number: catNum || null,
        category: String(row['Category '] ?? row['Category'] ?? row['category'] ?? '').trim() || null,
        grant_name: String(row['Grant ID'] ?? row['Grant Name'] ?? row['Grant'] ?? row['grant_name'] ?? '').trim() || null,
        requisition_id: reqId,
        unit_description: String(row['Unit Description'] ?? row['Unit description'] ?? row['unit_description'] ?? '').trim() || null,
        unit_price: parseFloat(rawUnitPrice) || null,
        units: parseInt(row['Units (n)'] || row['Units'] || row['units']) || null,
        total_price: parseFloat(rawTotalPrice) || null,
        order_date: excelDateToString(row['Date'] || row['Order Date'] || row['date']),
        requestor: (row['Requestor'] || row['requestor'] || '').trim() || null,
        status: (row['Status'] || row['status'] || 'pending').trim().toLowerCase(),
        notes: (row['Notes'] || row['notes'] || '').trim() || null,
      });
    }

    // Wipe existing orders
    const { error: deleteError } = await supabase.from('orders').delete().not('id', 'is', null);
    if (deleteError) return res.status(500).json({ error: deleteError.message });

    // Insert all rows from CSV
    let imported = 0;
    for (const order of allOrders) {
      const { error } = await supabase.from('orders').insert(order);
      if (error) console.error('Replace insert error:', error.message, order.item);
      else imported++;
    }

    res.json({ success: true, imported });
  } catch (error) {
    console.error('Replace-all error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import confirmed orders
router.post('/import-orders', async (req, res) => {
  const { orders } = req.body;
  try {
    let imported = 0;
    for (const order of orders) {
      const { error } = await supabase.from('orders').insert(order);
      if (error) console.error('Order insert error:', error.message, order.item);
      else imported++;
    }
    res.json({ success: true, imported });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

const REAGENT_HEADERS_REQUIRED = ['Category', 'Item (name)', 'Vendor', 'Cat number', 'Unit description', 'Unit price', 'Units (n)', 'Unused'];
const REAGENT_FY_COLS = ["FY'26", "FY'25", "FY'24"];

// Preview new reagents from uploaded file
router.post('/preview-reagents', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rawHeaders = (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })[0] || []).map(h => String(h ?? '').trim());
    const allRequired = [...REAGENT_HEADERS_REQUIRED, ...REAGENT_FY_COLS];
    const missing = missingColumns(rawHeaders, allRequired);
    if (missing.length > 0) return res.status(400).json({ error: `File rejected — ${missing.length} required column(s) missing. Column order does not matter.`, details: missing.map(h => `Missing: "${h}"`) });

    const { data: existing } = await supabase.from('reagents').select('catalog_number');
    const existingCats = new Set((existing || []).map(e => String(e.catalog_number)));

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const newReagents = [];
    for (const row of rows) {
      const name = String(row['Item (name)'] || '').trim();
      if (!name) continue;
      const cat = String(row['Cat number'] || '').trim();
      if (cat && existingCats.has(cat)) continue;
      newReagents.push({
        name,
        vendor: row['Vendor'] ? String(row['Vendor']).trim() : null,
        catalog_number: cat || null,
        category: row['Category'] ? String(row['Category']).trim() : null,
        unit_description: row['Unit description'] ? String(row['Unit description']).trim() : null,
        unit_price: parseFloat(String(row['Unit price'] || '').replace(/[$,]/g, '')) || null,
        units: parseInt(row['Units (n)']) || null,
        quantity_in_lab: parseFloat(row['Unused']) || null,
        fy26_purchases: parseInt(row["FY'26"]) || null,
        fy25_purchases: parseInt(row["FY'25"]) || null,
        fy24_purchases: parseInt(row["FY'24"]) || null,
      });
    }

    console.log('New reagents found:', newReagents.length);
    res.json({ newReagents, count: newReagents.length });
  } catch (error) {
    console.error('Reagent preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import confirmed reagents
router.post('/import-reagents', async (req, res) => {
  const { reagents } = req.body;
  try {
    let imported = 0;
    for (const reagent of reagents) {
      const { error } = await supabase
        .from('reagents')
        .insert(reagent);
      if (error) {
        console.error('Reagent insert error:', error.message, reagent.name);
      } else {
        imported++;
      }
    }
    console.log('Imported:', imported, 'of', reagents.length);
    res.json({ success: true, imported });
  } catch (error) {
    console.error('Reagent import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Preview Nanoseq reagents
const NANOSEQ_HEADERS = ['Protocol', 'Name', 'Company', 'Code', 'Link', 'Cost', 'Amount', 'N Reactions'];

router.post('/preview-nanoseq', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets['Nanoseq'] || workbook.Sheets[workbook.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const rawHeaders = (allRows[0] || []).map(h => String(h ?? '').trim());
    const missing = missingColumns(rawHeaders, NANOSEQ_HEADERS);
    if (missing.length > 0) return res.status(400).json({ error: `File rejected — ${missing.length} required column(s) missing. Make sure you are using the Nanoseq Draft template, not the Misc template.`, details: missing.map(h => `Missing: "${h}"`) });

    const { data: existing } = await supabase.from('nanoseq_reagents').select('code');
    const existingCodes = new Set((existing || []).map(e => String(e.code)));

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const newReagents = [];
    for (const row of rows) {
      const name = String(row['Name'] || '').trim();
      const code = String(row['Code'] || '').trim();
      if (!name || existingCodes.has(code)) continue;
      newReagents.push({
        protocol: String(row['Protocol'] || '').trim() || null,
        name,
        company: String(row['Company'] || '').trim() || null,
        code: code || null,
        link: String(row['Link'] || '').trim() || null,
        cost: parseFloat(row['Cost']) || null,
        amount: String(row['Amount'] || '').trim() || null,
        n_reactions: parseFloat(row['N Reactions']) || null,
      });
    }

    res.json({ newNanoseq: newReagents, count: newReagents.length });
  } catch (error) {
    console.error('Nanoseq preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import Nanoseq reagents
router.post('/import-nanoseq', async (req, res) => {
  const { reagents } = req.body;
  try {
    let imported = 0;
    for (const reagent of reagents) {
      const { error } = await supabase.from('nanoseq_reagents').insert(reagent);
      if (!error) imported++;
    }
    res.json({ success: true, imported });
  } catch (error) {
    console.error('Nanoseq import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Daily grant alert check — PAUSED until reinstated
async function checkGrantAlerts() {
  return; // emails paused — remove this line to reinstate
  const { data: grants } = await supabase.from('grants').select('*'); // eslint-disable-line no-unreachable
  const { data: managers } = await supabase
    .from('profiles').select('email, full_name').in('role', ['admin', 'pm']);

  const today = new Date();
  const alerts = [];

  for (const grant of (grants || [])) {
    const pct = grant.total_amount && grant.remaining_balance
      ? (grant.remaining_balance / grant.total_amount) * 100 : null;
    const daysLeft = grant.end_date
      ? Math.ceil((new Date(grant.end_date) - today) / (1000 * 60 * 60 * 24)) : null;

    if (pct !== null && pct < 10) {
      alerts.push({ grant, type: 'critical_balance', message: `${grant.name} is critically low — only ${pct.toFixed(1)}% remaining ($${grant.remaining_balance?.toLocaleString()})` });
    } else if (pct !== null && pct < 25) {
      alerts.push({ grant, type: 'low_balance', message: `${grant.name} balance is low — ${pct.toFixed(1)}% remaining ($${grant.remaining_balance?.toLocaleString()})` });
    }

    if (daysLeft !== null && (daysLeft === 14 || daysLeft === 30 || daysLeft === 90)) {
      alerts.push({ grant, type: 'expiring', message: `${grant.name} expires in ${daysLeft} days (${grant.end_date})` });
    }
  }

  if (alerts.length > 0) {
    const alertRows = alerts.map(a => `<li style="margin-bottom:8px;color:#F39C12;">${a.message}</li>`).join('');
    for (const manager of (managers || [])) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: manager.email,
        subject: `Petljak Lab — Grant Alerts (${alerts.length} issue${alerts.length > 1 ? 's' : ''})`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">Grant Alerts</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 20px;">The following grants require your attention:</p>
              <ul style="padding-left:20px;margin:0 0 24px;">${alertRows}</ul>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
                style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">
                View Finance Dashboard
              </a>
            </div>
          </div>
        `
      });
    }
  }
}

router.get('/check-grant-alerts', async (req, res) => {
  await checkGrantAlerts();
  res.json({ success: true });
});


module.exports = { router, checkGrantAlerts };
