-- Chart annotations for user-added markers and events
CREATE TABLE chart_annotations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annotation_date DATE NOT NULL,
  metric_type_id TEXT REFERENCES metric_types(id) ON DELETE SET NULL,  -- NULL = applies to all charts
  label TEXT NOT NULL CHECK (char_length(label) <= 50),
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom'
    CHECK (category IN ('fed_rate', 'local_event', 'market_event', 'custom')),
  color TEXT DEFAULT '#d4a853' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  is_auto_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient queries by user and date
CREATE INDEX idx_chart_annotations_user_date ON chart_annotations(user_id, annotation_date);
CREATE INDEX idx_chart_annotations_category ON chart_annotations(category);

-- Row Level Security
ALTER TABLE chart_annotations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own annotations
CREATE POLICY "Users can view own annotations"
  ON chart_annotations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own annotations
CREATE POLICY "Users can insert own annotations"
  ON chart_annotations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own annotations
CREATE POLICY "Users can update own annotations"
  ON chart_annotations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own annotations
CREATE POLICY "Users can delete own annotations"
  ON chart_annotations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_annotation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chart_annotations_timestamp
  BEFORE UPDATE ON chart_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_annotation_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON chart_annotations TO authenticated;
GRANT USAGE ON SEQUENCE chart_annotations_id_seq TO authenticated;
