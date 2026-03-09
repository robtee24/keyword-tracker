-- Saved ad creatives (platform-specific ad copy and images)
create table if not exists ad_creatives (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  site_url text not null,
  platform text not null,
  creative_type text not null default 'static',
  objective text,
  target_audience text,
  value_proposition text,
  landing_page_url text,
  additional_context text,
  result jsonb not null,
  generated_images jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_ad_creatives_project on ad_creatives(project_id);
create index if not exists idx_ad_creatives_platform on ad_creatives(project_id, platform);

-- Page publishing workflow
create table if not exists page_publish (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  site_url text not null,
  source_type text not null default 'new',
  source_id text,
  title text not null,
  slug text,
  meta_description text,
  og_image text,
  html_content text,
  schema_markup text,
  page_url text,
  status text not null default 'queued',
  published_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  publish_method text,
  publish_result jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_page_publish_project on page_publish(project_id);
create index if not exists idx_page_publish_status on page_publish(project_id, status);

-- Add status tracking to build_suggestions for Ideas/Created/Rejected
alter table build_suggestions add column if not exists suggestion_statuses jsonb default '[]'::jsonb;
