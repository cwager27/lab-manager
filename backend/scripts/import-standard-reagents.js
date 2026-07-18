const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function getFiscalYear(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  const fyYear = d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  return `fy${String(fyYear).slice(2)}`;
}

// Extract leading number from text like "310 preps", "72 preps", "1 kit (50)"
function extractNum(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  if (s === '0') return 0;
  const m = s.match(/^(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

async function run() {
  // 1. Parse Excel
  const wb = XLSX.readFile('/Users/ceceliawager/Desktop/For Cece/Standard lab reagents copy.xlsx');
  const sheet = wb.Sheets['Misc.'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  // Row 0 = person names, Row 1 = column headers, Row 2+ = data
  const headers = rows[1];
  const catIdx     = headers.indexOf('Cat number');
  const nameIdx    = headers.indexOf('Item (name)');
  const vendorIdx  = 2;
  const categoryIdx = 0;
  const unitIdx    = 4; // 'Units'
  const inLabIdx   = 12; // 'Number of Items in Lab'

  const excelReagents = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const rawName = r[nameIdx];
    if (!rawName) continue;
    const rawCat = String(r[catIdx] || '').trim();
    // Split compound catalog numbers: "R1055 / R1054" → ['R1055', 'R1054']
    const cats = rawCat ? rawCat.split('/').map(c => c.trim()).filter(Boolean) : [];
    excelReagents.push({
      name: String(rawName).trim(),
      vendor: r[vendorIdx] ? String(r[vendorIdx]).trim() : null,
      category: r[categoryIdx] ? String(r[categoryIdx]).trim() : null,
      unit_description: r[unitIdx] ? String(r[unitIdx]).trim() : null,
      quantity_in_lab: extractNum(r[inLabIdx]),
      primaryCat: cats[0] || null,
      allCats: cats,
    });
  }
  console.log(`Parsed ${excelReagents.length} reagents from Excel`);

  // 2. Fetch all orders to build FY order-count map
  const { data: allOrders, error: oErr } = await supabase.from('orders').select('catalog_number, order_date');
  if (oErr) { console.error('Orders fetch error:', oErr.message); process.exit(1); }

  const orderCounts = {}; // catalog_number → { fy24: N, fy25: N, fy26: N }
  for (const o of allOrders) {
    const cat = (o.catalog_number || '').trim();
    if (!cat || cat === 'NA') continue;
    const fy = getFiscalYear(o.order_date);
    if (!fy) continue;
    if (!orderCounts[cat]) orderCounts[cat] = { fy24: 0, fy25: 0, fy26: 0 };
    if (orderCounts[cat][fy] !== undefined) orderCounts[cat][fy]++;
  }
  console.log(`Built order count map for ${Object.keys(orderCounts).length} catalog numbers`);

  // 3. Upsert each reagent — match on primary catalog number
  let upserted = 0;
  for (const reagent of excelReagents) {
    // Sum order counts across all catalog variants
    const counts = { fy24: 0, fy25: 0, fy26: 0 };
    for (const cat of reagent.allCats) {
      if (orderCounts[cat]) {
        counts.fy24 += orderCounts[cat].fy24;
        counts.fy25 += orderCounts[cat].fy25;
        counts.fy26 += orderCounts[cat].fy26;
      }
    }

    const payload = {
      name: reagent.name,
      vendor: reagent.vendor,
      catalog_number: reagent.primaryCat,
      category: reagent.category,
      unit_description: reagent.unit_description,
      quantity_in_lab: reagent.quantity_in_lab,
      fy24_purchases: counts.fy24 || null,
      fy25_purchases: counts.fy25 || null,
      fy26_purchases: counts.fy26 || null,
    };

    // Try to find existing row by primary catalog number
    let matched = false;
    if (reagent.primaryCat) {
      const { data: existing } = await supabase
        .from('reagents').select('id').eq('catalog_number', reagent.primaryCat).limit(1);
      if (existing && existing.length > 0) {
        await supabase.from('reagents').update(payload).eq('id', existing[0].id);
        matched = true;
      }
    }
    if (!matched) {
      // Also try any of the compound catalog variants
      for (const cat of reagent.allCats.slice(1)) {
        const { data: existing } = await supabase
          .from('reagents').select('id').eq('catalog_number', cat).limit(1);
        if (existing && existing.length > 0) {
          await supabase.from('reagents').update(payload).eq('id', existing[0].id);
          matched = true; break;
        }
      }
    }
    if (!matched) {
      await supabase.from('reagents').insert(payload);
    }

    const fyStr = `fy24=${counts.fy24} fy25=${counts.fy25} fy26=${counts.fy26}`;
    console.log(`  ${matched ? '↺' : '+'} ${reagent.name} [${reagent.primaryCat}] ${fyStr}`);
    upserted++;
  }

  console.log(`\nDone — ${upserted} reagents upserted`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
