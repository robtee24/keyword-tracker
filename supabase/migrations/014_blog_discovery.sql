-- Blog discovery: stores discovered blog sections and their posts
create table if not exists blog_discoveries (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  site_url text not null,
  root_path text not null,
  blog_name text,
  posts jsonb default '[]'::jsonb,
  overview jsonb,
  gsc_data jsonb default '{}'::jsonb,
  crawled_at timestamptz default now(),
  unique(project_id, site_url, root_path)
);

create index if not exists idx_blog_disc_project on blog_discoveries(project_id);
create index if not exists idx_blog_disc_site on blog_discoveries(project_id, site_url);
