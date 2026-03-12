-- Add missing columns to blog_opportunities
-- Use this when you get "Could not find the 'title' column" or similar schema cache errors.
--
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Go to Project Settings > API > click "Reload schema cache" (or wait 2-3 min)
-- 3. Try Retry Save again

-- Create table first if it doesn't exist
CREATE TABLE IF NOT EXISTS blog_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- Add each column if missing (safe to run multiple times)
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS site_url text;
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS target_keyword text;
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS related_keywords jsonb DEFAULT '[]'::jsonb;
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS search_volume text DEFAULT 'medium';
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS estimated_searches integer DEFAULT 0;
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'medium';
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS funnel_stage text DEFAULT 'awareness';
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'guide';
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS generated_blog jsonb;
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS batch_id uuid;

-- Drop NOT NULL from title if we need to fix existing rows (run only if ADD fails)
-- ALTER TABLE blog_opportunities ALTER COLUMN title DROP NOT NULL;
-- UPDATE blog_opportunities SET title = '' WHERE title IS NULL;
-- ALTER TABLE blog_opportunities ALTER COLUMN title SET NOT NULL;
