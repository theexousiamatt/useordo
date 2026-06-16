-- 1. NOTIFICATIONS TABLE
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  url text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 2. NOTIFICATION TRIGGERS
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL
     AND NEW.assignee_id IS DISTINCT FROM auth.uid()
     AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN
    INSERT INTO public.notifications (user_id, workspace_id, type, title, body, url, entity_type, entity_id)
    VALUES (
      NEW.assignee_id, NEW.workspace_id, 'task_assigned',
      'New task assigned',
      NEW.title,
      '/projects/' || NEW.project_id,
      'task', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

CREATE OR REPLACE FUNCTION public.notify_deliverable_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.created_by IS NOT NULL
     AND NEW.created_by IS DISTINCT FROM auth.uid()
     AND NEW.status IN ('approved', 'changes_requested') THEN
    INSERT INTO public.notifications (user_id, workspace_id, type, title, body, url, entity_type, entity_id)
    VALUES (
      NEW.created_by, NEW.workspace_id,
      CASE WHEN NEW.status = 'approved' THEN 'deliverable_approved' ELSE 'deliverable_changes' END,
      CASE WHEN NEW.status = 'approved' THEN 'Deliverable approved' ELSE 'Changes requested' END,
      NEW.title,
      '/projects/' || NEW.project_id,
      'deliverable', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_deliverable_reviewed
  AFTER UPDATE OF status ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.notify_deliverable_reviewed();

-- 3. STORAGE POLICIES for project-files bucket (workspace/project membership)
CREATE POLICY "Project members read project files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.is_project_member((split_part(name, '/', 1))::uuid, auth.uid())
  );

CREATE POLICY "Project members upload project files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND public.is_project_member((split_part(name, '/', 1))::uuid, auth.uid())
  );

CREATE POLICY "Project members update project files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.is_project_member((split_part(name, '/', 1))::uuid, auth.uid())
  );

CREATE POLICY "Project members delete project files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.is_project_member((split_part(name, '/', 1))::uuid, auth.uid())
  );

-- 4. HARDEN email queue helper functions (set search_path)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;