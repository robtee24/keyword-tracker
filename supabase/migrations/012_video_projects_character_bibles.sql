-- Add character bibles and color grading columns to video_projects
alter table video_projects add column if not exists character_bibles jsonb default '[]'::jsonb;
alter table video_projects add column if not exists color_grading text default '';
