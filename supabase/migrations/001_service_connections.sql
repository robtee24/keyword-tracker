create table if not exists service_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  site_url text not null,
  service text not null,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  account_name text,
  account_id text,
  scopes text,
  connected_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, site_url, service)
);

create index if not exists idx_service_connections_user_site
  on service_connections(user_id, site_url);
