-- Import sources table to track import history
CREATE TABLE IF NOT EXISTS import_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('google_sheets', 'csv', 'excel', 'manual')),
  source_url TEXT,
  source_name TEXT NOT NULL,
  sheet_tab TEXT,
  last_imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  row_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint for Google Sheets URLs only (allows multiple file uploads)
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_sources_unique_url
  ON import_sources(user_id, source_url)
  WHERE source_url IS NOT NULL;

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_import_sources_user_id
  ON import_sources(user_id);

-- Index for finding recent imports
CREATE INDEX IF NOT EXISTS idx_import_sources_last_imported
  ON import_sources(user_id, last_imported_at DESC);
