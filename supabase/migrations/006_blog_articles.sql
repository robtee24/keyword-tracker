-- Blog articles: stores generated blog articles permanently
create table if not exists blog_articles (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  site_url text not null,
  opportunity_id uuid,
  title text not null,
  slug text,
  meta_description text,
  content text not null,
  previous_content text,
  images jsonb default '[]'::jsonb,
  word_count integer default 0,
  internal_link_suggestions jsonb default '[]'::jsonb,
  suggested_images jsonb default '[]'::jsonb,
  status text default 'draft' check (status in ('draft', 'published', 'archived')),
  source text default 'idea' check (source in ('idea', 'writer', 'series')),
  series_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_blog_articles_project on blog_articles(project_id);
create index if not exists idx_blog_articles_source on blog_articles(project_id, source);
