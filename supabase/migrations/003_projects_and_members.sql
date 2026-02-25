-- Projects table: stores project info tied to a user
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  domain text not null,
  gsc_property text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(owner_id, domain)
);

create index if not exists idx_projects_owner
  on projects(owner_id);

-- Project members: tracks who has access to each project
create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  invited_at timestamptz default now(),
  unique(project_id, email)
);

create index if not exists idx_project_members_user
  on project_members(user_id);

create index if not exists idx_project_members_project
  on project_members(project_id);

-- Auto-insert owner into project_members when a project is created
create or replace function add_project_owner()
returns trigger as $$
declare
  owner_email text;
begin
  select email into owner_email from auth.users where id = NEW.owner_id;
  insert into project_members (project_id, user_id, email, role)
  values (NEW.id, NEW.owner_id, coalesce(owner_email, ''), 'owner');
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_add_project_owner on projects;
create trigger trg_add_project_owner
  after insert on projects
  for each row execute function add_project_owner();

-- RLS policies
alter table projects enable row level security;
alter table project_members enable row level security;

create policy "Users can view projects they are members of"
  on projects for select
  using (
    id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "Users can insert their own projects"
  on projects for insert
  with check (owner_id = auth.uid());

create policy "Owners can update their projects"
  on projects for update
  using (owner_id = auth.uid());

create policy "Owners can delete their projects"
  on projects for delete
  using (owner_id = auth.uid());

create policy "Members can view project members"
  on project_members for select
  using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "Owners can manage project members"
  on project_members for insert
  with check (
    project_id in (select id from projects where owner_id = auth.uid())
  );

create policy "Owners can remove project members"
  on project_members for delete
  using (
    project_id in (select id from projects where owner_id = auth.uid())
  );
