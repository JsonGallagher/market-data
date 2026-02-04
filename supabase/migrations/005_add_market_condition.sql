-- Add market_condition column to ai_insights table
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS market_condition JSONB;
