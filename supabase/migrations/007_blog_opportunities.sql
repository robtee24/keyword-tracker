-- Blog opportunities: stores AI-generated blog topic ideas
create table if not exists blog_opportunities (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  project_id text,
  title text not null,
  target_keyword text,
  related_keywords jsonb default '[]'::jsonb,
  search_volume text default 'medium',
  estimated_searches integer default 0,
  difficulty text default 'medium',
  funnel_stage text default 'awareness',
  description text,
  content_type text default 'guide',
  status text default 'pending',
  generated_blog jsonb,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_blog_opportunities_site on blog_opportunities(site_url);
create index if not exists idx_blog_opportunities_project on blog_opportunities(project_id);
create index if not exists idx_blog_opportunities_status on blog_opportunities(site_url, status);
