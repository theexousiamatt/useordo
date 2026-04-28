-- Restrict internal helper/trigger functions
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.log_task_activity() from anon, authenticated, public;
revoke execute on function public.log_file_activity() from anon, authenticated, public;
revoke execute on function public.log_milestone_activity() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;

-- Tighten activity insert policy
drop policy if exists "Anyone can insert activity" on public.activity;
create policy "Members can insert activity"
  on public.activity for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin') or public.is_project_member(project_id, auth.uid())
  );
