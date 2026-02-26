-- Social audits: stores AI audit results for social posts
create table if not exists social_audits (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  site_url text not null,
  platform text not null check (platform in ('instagram', 'linkedin', 'x', 'facebook', 'tiktok', 'pinterest')),
  urls jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  summary text,
  strengths jsonb default '[]'::jsonb,
  recommendations jsonb default '[]'::jsonb,
  audited_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_social_audits_project on social_audits(project_id, platform);

-- Social ideas: stores AI-generated post ideas
create table if not exists social_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  site_url text not null,
  platform text not null check (platform in ('instagram', 'linkedin', 'x', 'facebook', 'tiktok', 'pinterest')),
  context text,
  ideas jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_social_ideas_project on social_ideas(project_id, platform);

-- Social posts: stores generated post drafts
create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  site_url text not null,
  platform text not null check (platform in ('instagram', 'linkedin', 'x', 'facebook', 'tiktok', 'pinterest')),
  post_type text not null,
  topic text,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_social_posts_project on social_posts(project_id, platform);
