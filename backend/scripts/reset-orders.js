const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const MONTH_MAP = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };

function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.includes('-')) return val;
  if (typeof val === 'string') {
    const m = val.match(/^([A-Za-z]{3})\s*,\s*(\d{4})$/);
    if (m && MONTH_MAP[m[1]]) return `${m[2]}-${MONTH_MAP[m[1]]}-01`;
  }
  return null;
}

async function run() {
  const filePath = '/Users/ceceliawager/Downloads/FY2026 - Orders.tsv';
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split('\t').map(h => h.trim());

  console.log('Headers:', headers);

  const orders = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = line.split('\t');
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] != null ? vals[idx].trim() : ''; });

    const item = row['Item'] || '';
    if (!item) continue;

    const reqId = row['Requsition ID'] || row['Requisition ID'] || 'NA';
    const catNum = row['Catalog Number'] || '';
    const rawUnit = (row['Unit price'] || row['Unit Price'] || '').replace(/[$,]/g, '');
    const rawTotal = (row['Total price'] || row['Total Price'] || '').replace(/[$,]/g, '');

    orders.push({
      item,
      vendor: row['Vendor'] || null,
      catalog_number: catNum || null,
      category: row['Category '] || row['Category'] || null,
      grant_name: row['Grant ID'] || row['Grant Name'] || null,
      requisition_id: reqId || 'NA',
      unit_description: row['Unit description'] || row['Unit Description'] || null,
      unit_price: parseFloat(rawUnit) || null,
      units: parseInt(row['Units (n)'] || row['Units']) || null,
      total_price: parseFloat(rawTotal) || null,
      order_date: parseDate(row['Date'] || row['Order Date']),
      requestor: row['Requestor'] || null,
      status: (row['Status'] || 'pending').toLowerCase(),
      notes: row['Notes'] || null,
    });
  }

  console.log(`Parsed ${orders.length} orders from TSV`);

  // Delete all existing orders
  const { error: delErr } = await supabase.from('orders').delete().not('id', 'is', null);
  if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1); }
  console.log('Deleted all existing orders');

  // Insert in batches of 100
  let imported = 0;
  const BATCH = 100;
  for (let i = 0; i < orders.length; i += BATCH) {
    const batch = orders.slice(i, i + BATCH);
    const { error } = await supabase.from('orders').insert(batch);
    if (error) {
      console.error(`Batch ${i}-${i+BATCH} error:`, error.message);
      // Fall back to row-by-row for this batch
      for (const o of batch) {
        const { error: e2 } = await supabase.from('orders').insert(o);
        if (e2) console.error('  Row error:', e2.message, o.item);
        else imported++;
      }
    } else {
      imported += batch.length;
    }
    process.stdout.write(`\r  Inserted ${imported}/${orders.length}...`);
  }

  console.log(`\nDone — imported ${imported} orders`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
