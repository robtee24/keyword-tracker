-- Add batch_id to blog_opportunities for grouping generation runs
ALTER TABLE blog_opportunities ADD COLUMN IF NOT EXISTS batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_blog_opportunities_batch ON blog_opportunities(batch_id);
