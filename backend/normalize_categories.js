const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://kjouuyuozvbudegyraym.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqb3V1eXVvenZidWRlZ3lyYXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk0MjkxOCwiZXhwIjoyMDk2NTE4OTE4fQ.pNUwZobJhvkJTMEh_wFAar8pWE9MDO4NcFsMH1CUJRg'
);

// Maps old Excel category names → standard CATEGORIES
const MAP = {
  'lab reagents':         'Specialized Reagents, Kits, Supplies',
  'TC reagents':          'Tissue Culture Reagents',
  'TC supplies':          'Disposable Supplies',
  'lab supplies':         'Disposable Supplies',
  'office supplies':      'Disposable Supplies',
  'computer hardware':    'Capital',
  'capital':              'Capital',
  'subcapital':           'Subcapital',
  'core facilities':      'Cores',
  'CR':                   'CR/CO',
  'CO':                   'CR/CO',
  'meals and fun':        'Meals and fun',
  'travel and conferences': 'Travel & Conferences',
};

async function run() {
  for (const [old, normalized] of Object.entries(MAP)) {
    const { data: rows } = await supabase.from('orders').select('id').eq('category', old);
    if (!rows?.length) { console.log(`  ${old}: 0 rows`); continue; }
    const { error } = await supabase.from('orders').update({ category: normalized }).eq('category', old);
    if (error) console.error(`  ERROR updating ${old}:`, error.message);
    else console.log(`  ✓ ${old} → ${normalized} (${rows.length} rows)`);
  }
  console.log('\nDone.');
}
run().catch(console.error);
