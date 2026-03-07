-- Brand profiles: stores brand identity and style guidelines per project
create table if not exists brand_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id text not null unique,
  site_url text not null,
  brand_style text,
  logos jsonb default '[]'::jsonb,
  fonts jsonb default '{}'::jsonb,
  font_styling jsonb default '{}'::jsonb,
  colors jsonb default '[]'::jsonb,
  tagline text,
  mission_statement text,
  button_styles jsonb default '[]'::jsonb,
  spacing jsonb default '{}'::jsonb,
  voice_and_tone text,
  additional_notes text,
  raw_crawl_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_brand_profiles_project on brand_profiles(project_id);
