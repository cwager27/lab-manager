const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  // Parse orders TSV — build catalog_number → unit info map
  const content = fs.readFileSync('/Users/ceceliawager/Downloads/FY2026 - Orders.tsv', 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split('\t').map(h => h.trim());

  const colIdx = name => headers.findIndex(h => h === name);
  const catIdx  = colIdx('Catalog Number');
  const descIdx = colIdx('Unit description');
  const priceIdx = colIdx('Unit price');
  const unitsIdx = colIdx('Units (n)');

  // catalog → { unit_description, unit_price, units } — last non-empty value wins
  const unitMap = {};
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split('\t');
    const cat = (vals[catIdx] || '').trim();
    if (!cat || cat === 'NA') continue;

    const desc  = (vals[descIdx]  || '').trim() || null;
    const rawPrice = (vals[priceIdx] || '').replace(/[$,]/g, '').trim();
    const price = parseFloat(rawPrice) || null;
    const units = parseInt(vals[unitsIdx]) || null;

    if (!unitMap[cat]) unitMap[cat] = { unit_description: null, unit_price: null, units: null };
    if (desc)  unitMap[cat].unit_description = desc;
    if (price) unitMap[cat].unit_price = price;
    if (units) unitMap[cat].units = units;
  }

  console.log(`Built unit map for ${Object.keys(unitMap).length} unique catalog numbers`);

  // Fetch all reagents with a catalog number
  const { data: reagents, error } = await supabase
    .from('reagents')
    .select('id, name, catalog_number')
    .not('catalog_number', 'is', null);

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }
  console.log(`Found ${reagents.length} reagents with catalog numbers`);

  let updated = 0, skipped = 0;
  for (const r of reagents) {
    const cat = (r.catalog_number || '').trim();
    const info = unitMap[cat];
    if (!info) { skipped++; continue; }

    const patch = {};
    if (info.unit_description) patch.unit_description = info.unit_description;
    if (info.unit_price)       patch.unit_price       = info.unit_price;
    if (info.units)            patch.units            = info.units;

    if (Object.keys(patch).length === 0) { skipped++; continue; }

    const { error: upErr } = await supabase.from('reagents').update(patch).eq('id', r.id);
    if (upErr) console.error(`  Error updating ${r.name}:`, upErr.message);
    else {
      console.log(`  ✓ ${r.name} [${cat}] →`, JSON.stringify(patch));
      updated++;
    }
  }

  console.log(`\nDone — updated ${updated}, skipped ${skipped} (no matching catalog in orders)`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
