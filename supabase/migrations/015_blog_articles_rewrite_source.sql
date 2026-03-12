-- Allow 'rewrite' and 'queue' as valid source values for blog articles
alter table blog_articles drop constraint if exists blog_articles_source_check;
alter table blog_articles add constraint blog_articles_source_check
  check (source in ('idea', 'writer', 'series', 'rewrite', 'queue'));
