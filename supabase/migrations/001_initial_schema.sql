-- Market Data Dashboard Schema
-- Run this in your Supabase SQL Editor

-- Lookup table for metric types
CREATE TABLE IF NOT EXISTS metric_types (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  unit TEXT,
  format_pattern TEXT,
  min_value NUMERIC,
  max_value NUMERIC
);

-- Seed metric types
INSERT INTO metric_types (id, display_name, unit, format_pattern, min_value, max_value) VALUES
  ('median_price', 'Median Sale Price', 'USD', '$0,0', 10000, 50000000),
  ('price_per_sqft', 'Price Per Sq Ft', 'USD', '$0', 10, 5000),
  ('active_listings', 'Active Listings', 'count', '0,0', 0, 100000),
  ('days_on_market', 'Days on Market', 'days', '0', 0, 1000),
  ('months_of_supply', 'Months of Supply', 'months', '0.0', 0, 36),
  ('list_to_sale_ratio', 'List to Sale Ratio', 'ratio', '0.00%', 0.5, 1.5)
ON CONFLICT (id) DO NOTHING;

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Market metrics
CREATE TABLE IF NOT EXISTS metrics (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type_id TEXT NOT NULL REFERENCES metric_types(id),
  recorded_date DATE NOT NULL,
  value NUMERIC NOT NULL,
  is_manually_entered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, metric_type_id, recorded_date)
);

-- Shareable links
CREATE TABLE IF NOT EXISTS shared_links (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for metrics
CREATE POLICY "Users can view own metrics" ON metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metrics" ON metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics" ON metrics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own metrics" ON metrics
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for shared_links
CREATE POLICY "Users can view own links" ON shared_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own links" ON shared_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own links" ON shared_links
  FOR DELETE USING (auth.uid() = user_id);

-- Allow public access to metrics via shared links (read-only)
CREATE POLICY "Public can view metrics via shared link" ON metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shared_links
      WHERE shared_links.user_id = metrics.user_id
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_metrics_user_date ON metrics(user_id, recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
