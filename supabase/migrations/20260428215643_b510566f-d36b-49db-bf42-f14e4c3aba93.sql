-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'client', 'team');
create type public.project_status as enum ('on_track', 'at_risk', 'blocked', 'done', 'planning');
create type public.task_status as enum ('pending', 'in_progress', 'awaiting_approval', 'approved', 'changes_requested', 'done');
create type public.approval_decision as enum ('approved', 'changes_requested');
create type public.activity_type as enum ('project_created', 'project_updated', 'milestone_completed', 'task_created', 'task_status_changed', 'task_approved', 'task_changes_requested', 'file_uploaded', 'comment_added');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  company text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles are viewable by all authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  -- default role: client
  insert into public.user_roles (user_id, role) values (new.id, 'client');
  return new;
end;
$$;

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create policy "Users can view own roles"
  on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Admins can view all roles"
  on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============ PROJECTS ============
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status project_status not null default 'on_track',
  progress integer not null default 0 check (progress between 0 and 100),
  start_date date,
  due_date date,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'client',
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);
alter table public.project_members enable row level security;

-- security definer to avoid RLS recursion when checking membership
create or replace function public.is_project_member(_project_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.project_members where project_id = _project_id and user_id = _user_id)
      or exists (select 1 from public.projects where id = _project_id and owner_id = _user_id);
$$;

create policy "Members and admins can view projects"
  on public.projects for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_project_member(id, auth.uid()));
create policy "Admins can manage projects"
  on public.projects for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Owners can update their projects"
  on public.projects for update to authenticated using (owner_id = auth.uid());

create policy "Members can view membership"
  on public.project_members for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or user_id = auth.uid() or public.is_project_member(project_id, auth.uid()));
create policy "Admins can manage membership"
  on public.project_members for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ MILESTONES ============
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.milestones enable row level security;
create policy "Project members can view milestones"
  on public.milestones for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_project_member(project_id, auth.uid()));
create policy "Admins manage milestones"
  on public.milestones for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ TASKS ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'pending',
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
create policy "Project members can view tasks"
  on public.tasks for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_project_member(project_id, auth.uid()));
create policy "Project members can update task status"
  on public.tasks for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_project_member(project_id, auth.uid()));
create policy "Admins manage tasks"
  on public.tasks for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete tasks"
  on public.tasks for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ============ APPROVALS ============
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  decision approval_decision not null,
  note text,
  decided_at timestamptz not null default now()
);
alter table public.approvals enable row level security;
create policy "Project members can view approvals"
  on public.approvals for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin') or
    exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid()))
  );
create policy "Project members can create approvals"
  on public.approvals for insert to authenticated
  with check (
    client_id = auth.uid() and
    exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid()))
  );

-- ============ FILES ============
create table public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  storage_path text not null,
  size_bytes bigint,
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.files enable row level security;
create policy "Project members can view files"
  on public.files for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_project_member(project_id, auth.uid()));
create policy "Project members can upload files"
  on public.files for insert to authenticated
  with check (public.is_project_member(project_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "Admins delete files"
  on public.files for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ============ ACTIVITY ============
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type activity_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.activity enable row level security;
create policy "Project members can view activity"
  on public.activity for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_project_member(project_id, auth.uid()));
create policy "Anyone can insert activity"
  on public.activity for insert to authenticated with check (true);

-- ============ TRIGGERS for activity feed ============
create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.activity (project_id, actor_id, type, payload)
    values (new.project_id, auth.uid(), 'task_created', jsonb_build_object('task_id', new.id, 'title', new.title));
  elsif TG_OP = 'UPDATE' and old.status is distinct from new.status then
    insert into public.activity (project_id, actor_id, type, payload)
    values (new.project_id, auth.uid(),
      case when new.status = 'approved' then 'task_approved'::activity_type
           when new.status = 'changes_requested' then 'task_changes_requested'::activity_type
           else 'task_status_changed'::activity_type end,
      jsonb_build_object('task_id', new.id, 'title', new.title, 'from', old.status, 'to', new.status));
  end if;
  return new;
end; $$;
create trigger trg_task_activity after insert or update on public.tasks
  for each row execute function public.log_task_activity();

create or replace function public.log_file_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity (project_id, actor_id, type, payload)
  values (new.project_id, auth.uid(), 'file_uploaded',
    jsonb_build_object('file_id', new.id, 'name', new.name));
  return new;
end; $$;
create trigger trg_file_activity after insert on public.files
  for each row execute function public.log_file_activity();

create or replace function public.log_milestone_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.completed and (old.completed is distinct from new.completed) then
    insert into public.activity (project_id, actor_id, type, payload)
    values (new.project_id, auth.uid(), 'milestone_completed',
      jsonb_build_object('milestone_id', new.id, 'title', new.title));
  end if;
  return new;
end; $$;
create trigger trg_milestone_activity after update on public.milestones
  for each row execute function public.log_milestone_activity();

-- ============ updated_at trigger ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.touch_updated_at();
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============ NEW USER TRIGGER ============
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ STORAGE BUCKET ============
insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false)
  on conflict (id) do nothing;

create policy "Project members can read files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-files' and (
      public.has_role(auth.uid(), 'admin') or
      public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
    )
  );
create policy "Project members can upload files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files' and (
      public.has_role(auth.uid(), 'admin') or
      public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
    )
  );
