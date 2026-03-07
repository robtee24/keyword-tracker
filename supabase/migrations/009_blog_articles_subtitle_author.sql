-- Add subtitle and author fields to blog_articles
alter table blog_articles add column if not exists subtitle text;
alter table blog_articles add column if not exists author text;
