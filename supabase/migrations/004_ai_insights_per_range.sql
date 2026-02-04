-- Add date_range column to ai_insights table for range-specific insights
-- The table was created manually, so we need to alter it

-- Add the date_range column
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS date_range TEXT NOT NULL DEFAULT '12m';

-- Drop the existing unique constraint on user_id (if it exists)
ALTER TABLE ai_insights DROP CONSTRAINT IF EXISTS ai_insights_user_id_key;

-- Add new composite unique constraint
ALTER TABLE ai_insights ADD CONSTRAINT ai_insights_user_id_date_range_key UNIQUE (user_id, date_range);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_range ON ai_insights(user_id, date_range);
