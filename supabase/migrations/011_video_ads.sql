-- Video ad ideas: batches of 10 generated ideas
create table if not exists video_ad_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  site_url text not null,
  input_type text not null, -- 'general_idea', 'best_performer', 'website_analysis'
  input_text text,
  ideas jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_video_ad_ideas_project on video_ad_ideas(project_id);

-- Video ad variations: batches of 10 variations per idea
create table if not exists video_ad_variations (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references video_ad_ideas(id) on delete cascade,
  project_id text not null,
  source_idea jsonb not null,
  batch_number int not null default 1,
  variations jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_video_ad_variations_idea on video_ad_variations(idea_id);
create index if not exists idx_video_ad_variations_project on video_ad_variations(project_id);

-- Video projects: ad-tized ideas with scene-by-scene prompts
create table if not exists video_projects (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  site_url text not null,
  idea jsonb not null,
  source_type text not null default 'ad-tized', -- 'ad-tized', 'direct'
  platforms text[] not null default '{}',
  aspect_ratio text not null default '16:9',
  voice_style text not null default 'professional',
  video_style text not null default 'cinematic',
  overall_concept text,
  scenes jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_video_projects_project on video_projects(project_id);

-- Generated video clips
create table if not exists video_generated (
  id uuid primary key default gen_random_uuid(),
  video_project_id uuid references video_projects(id) on delete cascade,
  scene_index int not null,
  prompt text not null,
  video_url text,
  thumbnail_url text,
  operation_name text,
  status text not null default 'pending',
  duration_seconds int default 8,
  aspect_ratio text default '16:9',
  error_message text,
  regeneration_reason text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_video_generated_project on video_generated(video_project_id);
