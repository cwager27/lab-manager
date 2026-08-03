-- Benchling sync cache: stores entities and ELN entries fetched from the Benchling API.
-- The backend /api/benchling/sync route upserts here; the UI reads from this table
-- and only re-fetches Benchling on an explicit "Refresh" click.

CREATE TABLE IF NOT EXISTS benchling_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchling_id  text UNIQUE NOT NULL,           -- Benchling internal ID (e.g. ce_xxx, etr_xxx)
  entity_type   text NOT NULL,                  -- 'registry_entity' | 'eln_entry'
  name          text,
  registry_id   text,                           -- human-readable registry ID, e.g. CL-001
  schema_name   text,                           -- schema / entity type name from Benchling
  fields        jsonb DEFAULT '{}',             -- all custom fields, keyed by field name
  web_url       text,                           -- direct link back to Benchling
  synced_at     timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE benchling_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON benchling_cache USING (true) WITH CHECK (true);

-- Index for fast filtering by type and schema
CREATE INDEX IF NOT EXISTS benchling_cache_entity_type_idx ON benchling_cache (entity_type);
CREATE INDEX IF NOT EXISTS benchling_cache_schema_name_idx ON benchling_cache (schema_name);
