const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://kjouuyuozvbudegyraym.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqb3V1eXVvenZidWRlZ3lyYXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk0MjkxOCwiZXhwIjoyMDk2NTE4OTE4fQ.pNUwZobJhvkJTMEh_wFAar8pWE9MDO4NcFsMH1CUJRg'
);
async function run() {
  // Check for zero total_price
  const { data: zeros } = await supabase.from('orders').select('id,category,total_price').eq('total_price', 0);
  console.log('Orders with total_price=0:', zeros?.length, zeros?.slice(0,3));
  // Check max monthly spending per category
  const PAGE = 1000; let all = [], from = 0;
  while (true) {
    const { data } = await supabase.from('orders').select('order_date,category,total_price,item,status').range(from, from + PAGE - 1);
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  const real = all.filter(o => o.item && o.item.trim() !== '' && o.status !== 'deleted' && o.category && o.total_price != null);
  const byMonth = {};
  real.forEach(o => {
    const d = new Date(o.order_date + 'T00:00:00Z');
    const m = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
    if (!byMonth[m]) byMonth[m] = {};
    byMonth[m][o.category] = (byMonth[m][o.category] || 0) + Number(o.total_price);
  });
  // Find max value
  let maxVal = 0, maxKey = '';
  Object.entries(byMonth).forEach(([m, cats]) => {
    Object.entries(cats).forEach(([cat, val]) => {
      if (val > maxVal) { maxVal = val; maxKey = `${m} / ${cat}`; }
    });
  });
  console.log('Max monthly category spend:', maxVal.toFixed(2), 'at', maxKey);
  console.log('Total unique months:', Object.keys(byMonth).length);
  // Check for any NaN values
  let nanCount = 0;
  Object.values(byMonth).forEach(cats => Object.values(cats).forEach(v => { if (isNaN(v) || v <= 0) nanCount++; }));
  console.log('Zero/NaN/negative values in data:', nanCount);
}
run().catch(console.error);
