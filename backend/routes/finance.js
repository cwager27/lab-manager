const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const multer = require('multer');
const XLSX = require('xlsx');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage() });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

function excelDateToString(excelDate) {
  if (!excelDate || isNaN(excelDate)) return null;
  if (typeof excelDate === 'string' && excelDate.includes('-')) return excelDate;
  const epoch = new Date(1899, 11, 30);
  const date = new Date(epoch.getTime() + excelDate * 86400000);
  return date.toISOString().split('T')[0];
}

// Preview new orders from uploaded file
router.post('/preview-orders', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets['Orders'] || workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    // Get existing requisition IDs
    const { data: existing } = await supabase
      .from('orders').select('requisition_id');
    const existingIds = new Set((existing || []).map(e => String(e.requisition_id)));

    const newOrders = [];
    for (const row of rows) {
      const reqId = row['Requsition ID'] || row['Requisition ID'];
      if (!reqId || existingIds.has(String(reqId))) continue;
      if (!row['Item'] && !row['item']) continue;

      newOrders.push({
        item: row['Item'] || row['item'],
        vendor: row['Vendor'] || row['vendor'],
        catalog_number: row['Catalog Number'] || row['catalog_number'],
        category: row['Category '] || row['Category'] || row['category'],
        grant_name: row['Grant ID'] || row['grant_name'],
        requisition_id: String(reqId),
        unit_description: row['Unit description'] || row['unit_description'],
        unit_price: parseFloat(row['Unit price'] || row['unit_price']) || null,
        units: parseInt(row['Units (n)'] || row['units']) || null,
        total_price: parseFloat(row['Total price'] || row['total_price']) || null,
        order_date: excelDateToString(row['Date'] || row['date']),
        requestor: row['Requestor'] || row['requestor'],
        status: (row['Status'] || row['status'] || 'pending').toLowerCase(),
        notes: row['Notes'] || row['notes'] || null
      });
    }

    res.json({ newOrders, count: newOrders.length });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import confirmed orders
router.post('/import-orders', async (req, res) => {
  const { orders } = req.body;
  try {
    let imported = 0;
    for (const order of orders) {
      const { error } = await supabase
        .from('orders')
        .upsert(order, { onConflict: 'requisition_id', ignoreDuplicates: true });
      if (!error) imported++;
    }
    res.json({ success: true, imported });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Preview new reagents from uploaded file
router.post('/preview-reagents', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets['Misc.'] || workbook.Sheets[workbook.SheetNames[0]];
    
    // Get all rows as arrays, skip row 1 (person names), use row 2 as headers
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const headers = allRows[1]; // Row 2 = index 1
    const dataRows = allRows.slice(2); // Row 3+ = data

    console.log('Headers:', headers.slice(0, 6));
    console.log('First data row:', dataRows[0]?.slice(0, 6));

    const { data: existing } = await supabase
      .from('reagents').select('catalog_number');
    const existingCats = new Set((existing || []).map(e => String(e.catalog_number)));

    const newReagents = [];
    for (const row of dataRows) {
      const name = row[1]; // Item (name) is column B
      const cat = row[3];  // Cat number is column D
      const category = row[0]; // Category is column A
      const units = row[4]; // Units is column E
      const vendor = row[2]; // Vendor is column C

      if (!name || existingCats.has(String(cat))) continue;

      newReagents.push({
        name: String(name),
        vendor: vendor ? String(vendor) : null,
        catalog_number: cat ? String(cat) : null,
        category: category ? String(category) : null,
        unit_description: units ? String(units) : null,
        quantity_in_lab: null,
        fy24_purchases: null,
        fy25_purchases: null,
        fy26_purchases: null,
        notes: null
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
  // Preview Nanoseq reagents
router.post('/preview-nanoseq', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets['Nanoseq'] || workbook.Sheets[workbook.SheetNames[1]];
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const headers = allRows[0];
    const dataRows = allRows.slice(1);

    console.log('Nanoseq headers:', headers);

    const { data: existing } = await supabase.from('nanoseq_reagents').select('code');
    const existingCodes = new Set((existing || []).map(e => String(e.code)));

    const newReagents = [];
    for (const row of dataRows) {
      const name = row[1];
      const code = row[3];
      if (!name || existingCodes.has(String(code))) continue;
      newReagents.push({
        protocol: row[0] ? String(row[0]) : null,
        name: String(name),
        company: row[2] ? String(row[2]) : null,
        code: code ? String(code) : null,
        link: row[4] ? String(row[4]) : null,
        cost: parseFloat(row[5]) || null,
        amount: row[6] ? String(row[6]) : null,
        n_reactions: parseFloat(row[7]) || null,
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

// Daily grant alert check (called from cron)
async function checkGrantAlerts() {
  const { data: grants } = await supabase.from('grants').select('*');
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
