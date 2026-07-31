const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://kjouuyuozvbudegyraym.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqb3V1eXVvenZidWRlZ3lyYXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk0MjkxOCwiZXhwIjoyMDk2NTE4OTE4fQ.pNUwZobJhvkJTMEh_wFAar8pWE9MDO4NcFsMH1CUJRg'
);
const MAP = {
  'subscriptions': 'Subscriptions',
  'shipping': 'Shipping',
  'purchased services': 'Cores',
  'internal purchased services': 'Cores',
  'lab suppies': 'Disposable Supplies',
};
async function run() {
  for (const [old, norm] of Object.entries(MAP)) {
    const { data } = await supabase.from('orders').select('id').eq('category', old);
    if (!data?.length) { console.log(`  ${old}: 0 rows`); continue; }
    await supabase.from('orders').update({ category: norm }).eq('category', old);
    console.log(`  ✓ ${old} → ${norm} (${data.length} rows)`);
  }
  // Also check total_price distribution
  const { data: sample } = await supabase.from('orders').select('total_price').limit(10);
  console.log('\nSample total_price values:', sample?.map(r => r.total_price));
}
run().catch(console.error);
