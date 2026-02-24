-- User plans: tracks which plan each user is on
create table if not exists user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  plan text not null default 'base' check (plan in ('base', 'plus', 'managed_digital')),
  stripe_customer_id text,
  stripe_subscription_id text,
  started_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_plans_user_id on user_plans(user_id);
create index if not exists idx_user_plans_stripe on user_plans(stripe_customer_id);

-- Usage tracking: monthly counters for rate-limited features
create table if not exists usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  period text not null,  -- format: 'YYYY-MM'
  page_audits integer not null default 0,
  keyword_scans integer not null default 0,
  blog_posts integer not null default 0,
  page_builds integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, period)
);

create index if not exists idx_usage_tracking_user_period on usage_tracking(user_id, period);

-- Auto-create a base plan record when a new user signs up
create or replace function handle_new_user_plan()
returns trigger as $$
begin
  insert into public.user_plans (user_id, plan)
  values (new.id, 'base')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_plan on auth.users;
create trigger on_auth_user_created_plan
  after insert on auth.users
  for each row execute function handle_new_user_plan();
