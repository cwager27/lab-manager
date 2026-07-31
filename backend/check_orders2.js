const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://kjouuyuozvbudegyraym.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqb3V1eXVvenZidWRlZ3lyYXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk0MjkxOCwiZXhwIjoyMDk2NTE4OTE4fQ.pNUwZobJhvkJTMEh_wFAar8pWE9MDO4NcFsMH1CUJRg'
);

function getFY(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const yr = d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  return `fy${String(yr).slice(2)}`;
}

async function run() {
  // Paginate all orders
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data } = await supabase.from('orders').select('order_date,category,total_price,status').range(from, from + PAGE - 1);
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log('Total rows:', all.length);

  const byFY = {};
  const catSet = {};
  all.forEach(o => {
    if (!o.order_date) return;
    const fy = getFY(o.order_date);
    byFY[fy] = (byFY[fy] || 0) + 1;
    if (o.category) catSet[o.category] = (catSet[o.category] || 0) + 1;
  });

  console.log('\nOrders per FY:', byFY);
  console.log('\nTop 25 categories:', Object.entries(catSet).sort((a,b)=>b[1]-a[1]).slice(0,25));
}
run().catch(console.error);
