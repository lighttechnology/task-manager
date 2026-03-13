-- ユーザーテーブル
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  avatar_url text,
  google_access_token text,
  google_refresh_token text,
  created_at timestamptz default now()
);

-- カンバン列テーブル
create table public.columns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  position int not null,
  color text default '#6366f1',
  created_at timestamptz default now()
);

-- タスクテーブル（assignee_id は廃止 → task_assignees で複数管理）
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  column_id uuid references public.columns(id) on delete cascade,
  priority text check (priority in ('low','medium','high')) default 'medium',
  due_date timestamptz,
  position int not null default 0,
  google_calendar_event_id text,
  reviewer_id uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- タスク担当者 中間テーブル（複数アサイン対応）
create table public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (task_id, user_id)
);

-- デフォルト列を挿入
insert into public.columns (title, position, color) values
  ('未着手', 0, '#94a3b8'),
  ('進行中', 1, '#3b82f6'),
  ('レビュー中', 2, '#f59e0b'),
  ('完了', 3, '#22c55e');

-- Realtime を有効化
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.columns;

-- RLS（Row Level Security）設定
alter table public.tasks enable row level security;
alter table public.columns enable row level security;
alter table public.users enable row level security;
alter table public.task_assignees enable row level security;

-- 認証済みユーザーなら全操作許可
create policy "auth users can manage tasks"
  on public.tasks for all
  using (auth.role() = 'authenticated');

create policy "auth users can read columns"
  on public.columns for select
  using (auth.role() = 'authenticated');

create policy "auth users can read users"
  on public.users for select
  using (auth.role() = 'authenticated');

create policy "auth users can update own user"
  on public.users for update
  using (auth.role() = 'authenticated');

create policy "auth users can manage task_assignees"
  on public.task_assignees for all
  using (auth.role() = 'authenticated');
