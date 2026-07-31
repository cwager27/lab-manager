const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://kjouuyuozvbudegyraym.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqb3V1eXVvenZidWRlZ3lyYXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk0MjkxOCwiZXhwIjoyMDk2NTE4OTE4fQ.pNUwZobJhvkJTMEh_wFAar8pWE9MDO4NcFsMH1CUJRg'
);

async function run() {
  // Check total counts per fiscal year
  let { data: all } = await supabase.from('orders').select('order_date,category,total_price,status').limit(5000);
  console.log('Total rows fetched:', all?.length);

  const byFY = {};
  const nullCat = {}, nullPrice = {};
  all.forEach(o => {
    if (!o.order_date) return;
    const d = new Date(o.order_date + 'T00:00:00Z');
    const yr = d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
    const fy = `fy${String(yr).slice(2)}`;
    byFY[fy] = (byFY[fy] || 0) + 1;
    if (!o.category) nullCat[fy] = (nullCat[fy] || 0) + 1;
    if (o.total_price == null) nullPrice[fy] = (nullPrice[fy] || 0) + 1;
  });

  console.log('\nOrders per FY:', byFY);
  console.log('Null category per FY:', nullCat);
  console.log('Null total_price per FY:', nullPrice);

  // Sample a few FY24 rows
  const fy24 = all.filter(o => {
    if (!o.order_date) return false;
    const d = new Date(o.order_date + 'T00:00:00Z');
    const yr = d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
    return yr === 2024;
  }).slice(0, 5);
  console.log('\nSample FY24 rows:', JSON.stringify(fy24, null, 2));
}
run().catch(console.error);
