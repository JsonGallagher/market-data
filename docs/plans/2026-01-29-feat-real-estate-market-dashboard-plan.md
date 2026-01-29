---
title: Real Estate Market Data Dashboard
type: feat
date: 2026-01-29
status: in-progress
---

# Real Estate Market Data Dashboard

A web application for residential real estate professionals to upload MLS reports (Excel/CSV), visualize market trends over time, and share insights via links.

## Tech Stack

- **Frontend**: SvelteKit + shadcn-svelte + Tailwind CSS
- **Backend**: Supabase (auth, database)
- **Deployment**: Cloudflare Pages
- **Charts**: Frappe Charts (lightweight, ~10kb)
- **Branding**: Black and gold color scheme

## Acceptance Criteria

### Authentication
- [x] User registration and login via email/password
- [x] Protected routes for authenticated users

### Data Upload
- [x] Upload Excel/CSV files with MLS data
- [x] Extract metrics by matching column headers (case-insensitive):
  - "Median Sale Price" or "Median Price" → median_price
  - "Price Per Sq Ft" or "$/SqFt" → price_per_sqft
  - "Active Listings" or "Inventory" → active_listings
  - "Days on Market" or "DOM" or "Avg DOM" → days_on_market
  - "Months of Supply" or "Absorption Rate" → months_of_supply
  - "List to Sale Ratio" or "SP/LP Ratio" → list_to_sale_ratio
  - "Date" or "Period" or "Month" → recorded_date
- [x] Review & Confirm step: show extracted data in editable form before saving
- [x] Manual data entry form as fallback
- [x] Validation bounds per metric (flag outliers for review)

### Dashboard Visualization
- [x] Line charts showing metric trends over time
- [x] Key metric cards with current values and % change from prior period
- [x] Display all uploaded data (no filtering for MVP)

### Sharing
- [x] Generate shareable links with unique tokens
- [x] Shared view shows read-only dashboard (no auth required)

## Review Follow-ups (2026-01-29)

- [x] Stop sending auth cookies to the client during layout load (security).
- [x] Guard `window` access in the dashboard so SSR doesn’t crash.
- [x] Validate `next` in auth callback to prevent open redirects.
- [x] Handle `Date` objects in Excel extraction (SheetJS `cellDates`).
- [x] Add server-side validation for uploaded metric IDs/dates (or rely on DB constraints).

## Database Schema (Supabase)

```sql
-- Lookup table for metric types
CREATE TABLE metric_types (
  id TEXT PRIMARY KEY,  -- e.g., 'median_price'
  display_name TEXT NOT NULL,  -- e.g., 'Median Sale Price'
  unit TEXT,  -- e.g., 'USD', 'days', 'ratio'
  format_pattern TEXT,  -- e.g., '$0,0', '0.00%'
  min_value NUMERIC,  -- validation bound
  max_value NUMERIC   -- validation bound
);

-- Seed data
INSERT INTO metric_types VALUES
  ('median_price', 'Median Sale Price', 'USD', '$0,0', 10000, 50000000),
  ('price_per_sqft', 'Price Per Sq Ft', 'USD', '$0', 10, 5000),
  ('active_listings', 'Active Listings', 'count', '0,0', 0, 100000),
  ('days_on_market', 'Days on Market', 'days', '0', 0, 1000),
  ('months_of_supply', 'Months of Supply', 'months', '0.0', 0, 36),
  ('list_to_sale_ratio', 'List to Sale Ratio', 'ratio', '0.00%', 0.5, 1.5);

-- User profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Market metrics
CREATE TABLE metrics (
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
CREATE TABLE shared_links (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users access own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users access own metrics" ON metrics
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own links" ON shared_links
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_metrics_user_date ON metrics(user_id, recorded_date DESC);
CREATE INDEX idx_shared_links_token ON shared_links(token);
```

## Key Technical Decisions

1. **Excel/CSV only** - PDF parsing deferred to v2 (unreliable, MLS formats vary wildly)
2. **No file storage** - Extract metrics and discard file (users keep originals)
3. **Review & Confirm** - Never auto-save extracted data; user must confirm
4. **Metric type lookup** - Prevents "Median Price" vs "median_price" variants
5. **Validation bounds** - Flag outliers (e.g., $50 median price) for user review
6. **Anonymous sharing** - No client entity; links work without recipient tracking

## MVP Scope

**In Scope:**
- Email/password authentication
- Excel/CSV upload with column header matching
- Review & Confirm extraction step
- Manual data entry fallback
- Dashboard with trend charts
- Shareable links (anonymous, no expiration)

**Out of Scope (Future):**
- Google OAuth
- PDF extraction
- Client management / CRM features
- PDF export, iframe embed
- View count analytics
- Date range / market filtering
- Link expiration
- Team/brokerage accounts

## File Structure

```
src/
├── routes/
│   ├── +layout.svelte           # Auth wrapper, navigation
│   ├── +layout.server.ts        # Session handling
│   ├── +page.svelte             # Landing page
│   ├── auth/
│   │   ├── login/+page.svelte
│   │   ├── register/+page.svelte
│   │   └── callback/+server.ts
│   ├── dashboard/
│   │   ├── +page.svelte         # Main dashboard with charts
│   │   └── +page.server.ts      # Load user metrics
│   ├── upload/
│   │   ├── +page.svelte         # Upload + review UI
│   │   └── +page.server.ts      # Save confirmed metrics
│   ├── manual-entry/
│   │   └── +page.svelte         # Manual data entry form
│   └── share/
│       └── [token]/
│           ├── +page.svelte     # Public shared view
│           └── +page.server.ts  # Load metrics by token
├── lib/
│   ├── components/ui/           # shadcn-svelte components
│   ├── extractors/
│   │   └── excel.ts             # SheetJS parsing + header matching
│   ├── charts/
│   │   └── TrendChart.svelte    # Frappe Charts wrapper
│   ├── validation.ts            # Metric bounds checking
│   └── supabase.ts              # Client setup
└── app.css                      # Theme variables (black/gold)
```

## Black & Gold Theme

```css
:root {
  --primary: oklch(0.75 0.15 85);        /* Gold */
  --primary-foreground: oklch(0.15 0 0); /* Black text on gold */
  --background: oklch(0.12 0 0);         /* Near black */
  --foreground: oklch(0.95 0.02 85);     /* Off-white/cream */
  --accent: oklch(0.85 0.12 85);         /* Light gold */
  --card: oklch(0.18 0 0);               /* Dark gray cards */
  --muted: oklch(0.25 0 0);              /* Muted backgrounds */
  --border: oklch(0.30 0.05 85);         /* Subtle gold border */
}
```

## User Flow

```
1. Sign up (email/password)
         ↓
2. Upload Excel/CSV  ──or──  Manual Entry
         ↓                        ↓
3. Review extracted data    Fill form
         ↓                        ↓
4. Confirm & Save  ←──────────────┘
         ↓
5. View Dashboard (charts + metrics)
         ↓
6. Generate Shareable Link
         ↓
7. Client views shared dashboard (no auth)
```

## References

- [SvelteKit Cloudflare Adapter](https://kit.svelte.dev/docs/adapter-cloudflare)
- [shadcn-svelte](https://shadcn-svelte.com/docs)
- [Supabase SvelteKit Guide](https://supabase.com/docs/guides/auth/server-side/sveltekit)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [SheetJS](https://docs.sheetjs.com/)
- [Frappe Charts](https://frappe.io/charts)
