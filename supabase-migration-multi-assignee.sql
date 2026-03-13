-- =====================================================
-- マイグレーション: 単一担当者 → 複数担当者 + レビュアー + 自動削除
-- 既存DBに対して実行してください
-- =====================================================

-- 1. 中間テーブル作成
create table if not exists public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (task_id, user_id)
);

-- 2. 既存の assignee_id データを中間テーブルへ移行
insert into public.task_assignees (task_id, user_id)
select id, assignee_id from public.tasks
where assignee_id is not null
on conflict do nothing;

-- 3. 旧カラムを削除
alter table public.tasks drop column if exists assignee_id;

-- 4. レビュアーカラム追加
alter table public.tasks add column if not exists reviewer_id uuid references public.users(id) on delete set null;

-- 5. 完了日時カラム追加（自動削除用）
alter table public.tasks add column if not exists completed_at timestamptz;

-- 6. RLS設定
alter table public.task_assignees enable row level security;

create policy "auth users can manage task_assignees"
  on public.task_assignees for all
  using (auth.role() = 'authenticated');
