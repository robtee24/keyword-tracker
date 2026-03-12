-- Repair script for blog_opportunities table
-- Run this in Supabase SQL Editor if blog ideas fail to save with "missing columns" or similar errors.

-- 1. Create table if it doesn't exist (from 007)
CREATE TABLE IF NOT EXISTS blog_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url text NOT NULL,
  project_id text,
  title text NOT NULL,
  target_keyword text,
  related_keywords jsonb DEFAULT '[]'::jsonb,
  search_volume text DEFAULT 'medium',
  estimated_searches integer DEFAULT 0,
  difficulty text DEFAULT 'medium',
  funnel_stage text DEFAULT 'awareness',
  description text,
  content_type text DEFAULT 'guide',
  status text DEFAULT 'pending',
  generated_blog jsonb,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 2. Add batch_id if missing (from 008)
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS batch_id uuid;

-- 3. Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_blog_opportunities_site ON blog_opportunities(site_url);
CREATE INDEX IF NOT EXISTS idx_blog_opportunities_project ON blog_opportunities(project_id);
CREATE INDEX IF NOT EXISTS idx_blog_opportunities_status ON blog_opportunities(site_url, status);
CREATE INDEX IF NOT EXISTS idx_blog_opportunities_batch ON blog_opportunities(batch_id);

-- 4. If RLS is blocking inserts, enable access for service role (service role bypasses RLS by default)
-- If you use anon/authenticated keys, uncomment and adjust:
-- ALTER TABLE blog_opportunities ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow service role full access" ON blog_opportunities;
-- CREATE POLICY "Allow service role full access" ON blog_opportunities FOR ALL USING (true) WITH CHECK (true);
