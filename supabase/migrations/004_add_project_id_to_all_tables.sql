-- Migration: Add project_id to all data tables for project-level isolation
-- Previously all data was scoped by site_url, causing cross-project leakage
-- when multiple projects share the same domain.

-- Helper: add project_id column + index to a table if the column doesn't exist
-- We make it nullable so existing rows aren't broken; new writes will always include it.

-- 1. completed_tasks
ALTER TABLE IF EXISTS completed_tasks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_completed_tasks_project ON completed_tasks(project_id);

-- 2. page_audits
ALTER TABLE IF EXISTS page_audits
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_page_audits_project ON page_audits(project_id);

-- 3. recommendations
ALTER TABLE IF EXISTS recommendations
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_recommendations_project ON recommendations(project_id);

-- 4. keywords
ALTER TABLE IF EXISTS keywords
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_keywords_project ON keywords(project_id);

-- 5. keyword_groups
ALTER TABLE IF EXISTS keyword_groups
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_keyword_groups_project ON keyword_groups(project_id);

-- 6. keyword_group_members
ALTER TABLE IF EXISTS keyword_group_members
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_keyword_group_members_project ON keyword_group_members(project_id);

-- 7. keyword_intents
ALTER TABLE IF EXISTS keyword_intents
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_keyword_intents_project ON keyword_intents(project_id);

-- 8. search_volumes
ALTER TABLE IF EXISTS search_volumes
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_search_volumes_project ON search_volumes(project_id);

-- 9. ad_keywords
ALTER TABLE IF EXISTS ad_keywords
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ad_keywords_project ON ad_keywords(project_id);

-- 10. blog_audits
ALTER TABLE IF EXISTS blog_audits
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_blog_audits_project ON blog_audits(project_id);

-- 11. blog_urls
ALTER TABLE IF EXISTS blog_urls
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_blog_urls_project ON blog_urls(project_id);

-- 12. blog_opportunities
ALTER TABLE IF EXISTS blog_opportunities
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_blog_opportunities_project ON blog_opportunities(project_id);

-- 13. blog_schedules
ALTER TABLE IF EXISTS blog_schedules
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_blog_schedules_project ON blog_schedules(project_id);

-- 14. build_suggestions
ALTER TABLE IF EXISTS build_suggestions
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_build_suggestions_project ON build_suggestions(project_id);

-- 15. build_results
ALTER TABLE IF EXISTS build_results
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_build_results_project ON build_results(project_id);

-- 16. gsc_cache
ALTER TABLE IF EXISTS gsc_cache
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_gsc_cache_project ON gsc_cache(project_id);
