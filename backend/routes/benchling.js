const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseAdmin');

const BENCHLING_TENANT = process.env.BENCHLING_TENANT;
const BENCHLING_API_KEY = process.env.BENCHLING_API_KEY;

function benchlingAuthHeader() {
  const encoded = Buffer.from(`${BENCHLING_API_KEY}:`).toString('base64');
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' };
}

async function fetchAllPages(path, resultKey) {
  const baseUrl = `https://${BENCHLING_TENANT}.benchling.com/api/v2`;
  const headers = benchlingAuthHeader();
  const results = [];
  let nextToken = null;

  do {
    const url = nextToken
      ? `${baseUrl}${path}&nextToken=${encodeURIComponent(nextToken)}`
      : `${baseUrl}${path}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Benchling ${res.status}: ${body}`);
    }
    const data = await res.json();
    if (data[resultKey]) results.push(...data[resultKey]);
    nextToken = data.nextToken || null;
  } while (nextToken);

  return results;
}

// POST /api/benchling/sync
// Fetches all custom entities and recent ELN entries from Benchling, caches in Supabase.
router.post('/benchling/sync', async (req, res) => {
  if (!BENCHLING_TENANT || !BENCHLING_API_KEY) {
    return res.status(500).json({
      error: 'Benchling not configured. Add BENCHLING_TENANT and BENCHLING_API_KEY to your .env / Vercel environment variables.',
    });
  }

  try {
    const [entities, entries] = await Promise.all([
      fetchAllPages('/custom-entities?pageSize=100&archiveRecord.reason=NOT_ARCHIVED', 'customEntities'),
      fetchAllPages('/entries?pageSize=100', 'entries'),
    ]);

    const now = new Date().toISOString();

    const entityRows = entities.map(e => ({
      benchling_id: e.id,
      entity_type: 'registry_entity',
      name: e.name,
      registry_id: e.entityRegistryId || null,
      schema_name: e.schema?.name || null,
      fields: e.fields || {},
      web_url: e.webURL || null,
      synced_at: now,
    }));

    const entryRows = entries.map(e => ({
      benchling_id: e.id,
      entity_type: 'eln_entry',
      name: e.name,
      registry_id: e.displayId || null,
      schema_name: 'ELN Entry',
      fields: {
        displayId: e.displayId,
        createdAt: e.createdAt,
        modifiedAt: e.modifiedAt,
        authors: (e.authors || []).map(a => a.name || a.handle).join(', '),
      },
      web_url: e.webURL || null,
      synced_at: now,
    }));

    const rows = [...entityRows, ...entryRows];

    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from('benchling_cache')
        .upsert(rows, { onConflict: 'benchling_id' });
      if (error) throw new Error(error.message);
    }

    res.json({ synced: rows.length, entities: entityRows.length, entries: entryRows.length, timestamp: now });
  } catch (err) {
    console.error('Benchling sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/benchling/sequencing
// Live fetch: Libraries (ts_UPl03umOxM) joined with Subjects Sequencing Samples (ts_4aMFYaEXNb).
router.get('/benchling/sequencing', async (req, res) => {
  if (!BENCHLING_TENANT || !BENCHLING_API_KEY) {
    return res.status(500).json({ error: 'Benchling not configured. Add BENCHLING_TENANT and BENCHLING_API_KEY to environment variables.' });
  }
  try {
    const [libraries, samples] = await Promise.all([
      fetchAllPages('/custom-entities?pageSize=100&schemaId=ts_UPl03umOxM', 'customEntities'),
      fetchAllPages('/custom-entities?pageSize=100&schemaId=ts_4aMFYaEXNb', 'customEntities'),
    ]);

    const sampleById = {};
    for (const s of samples) sampleById[s.id] = s;

    const rows = libraries.map(lib => {
      const f = lib.fields || {};
      const sampleId = f['Sample']?.value || null;
      const sample = sampleId ? sampleById[sampleId] : null;
      const sf = sample?.fields || {};

      return {
        id: lib.id,
        name: lib.name,
        registryId: lib.entityRegistryId || null,
        webURL: lib.webURL || null,
        createdAt: lib.createdAt || null,
        creator: lib.creator?.name || null,
        qcStatus: f['QC Status']?.displayValue || null,
        coverage: f['Coverage']?.displayValue != null ? `${f['Coverage'].displayValue}x` : null,
        strategy: f['Sequencing Strategy']?.displayValue || null,
        location: f['Sequencing Location']?.displayValue || null,
        assay: f['Assay']?.displayValue || null,
        indexBarcode: f['Index barcode']?.displayValue || null,
        sampleId: sampleId,
        sampleName: f['Sample']?.displayValue || null,
        sampleWebURL: sample?.webURL || null,
        subject: sf['Subject']?.displayValue || null,
        project: sf['Project']?.displayValue || null,
        tissueType: sf['Isolate Type Name']?.displayValue || null,
        tissueState: sf['Tissue State']?.displayValue || null,
        sex: sf['Sex']?.displayValue || null,
        age: sf['Age']?.displayValue || null,
        species: sf['Species']?.displayValue || null,
        sampleDate: sf['Date']?.displayValue || null,
        matchedNormal: sf['Matched Normal Sample']?.displayValue || null,
        bioReplicate: sf['Biological Replicate Number']?.displayValue || null,
        techReplicate: sf['Technical Replicate #']?.displayValue || null,
      };
    });

    res.json({ rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Benchling sequencing error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/benchling/cache
// Returns cached Benchling data from Supabase.
router.get('/benchling/cache', async (req, res) => {
  const { entity_type } = req.query;
  let query = supabaseAdmin.from('benchling_cache').select('*').order('schema_name').order('name');
  if (entity_type) query = query.eq('entity_type', entity_type);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data || [] });
});

module.exports = router;
