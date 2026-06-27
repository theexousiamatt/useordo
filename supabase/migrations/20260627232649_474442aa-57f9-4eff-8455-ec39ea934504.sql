CREATE TABLE public.task_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View task assignees"
  ON public.task_assignees FOR SELECT
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "Add task assignees"
  ON public.task_assignees FOR INSERT
  WITH CHECK (public.can_contribute_project(project_id, auth.uid()));

CREATE POLICY "Remove task assignees"
  ON public.task_assignees FOR DELETE
  USING (public.can_contribute_project(project_id, auth.uid()));

CREATE INDEX idx_task_assignees_task_id ON public.task_assignees(task_id);
CREATE INDEX idx_task_assignees_project_id ON public.task_assignees(project_id);
CREATE INDEX idx_task_assignees_user_id ON public.task_assignees(user_id);
CREATE INDEX idx_task_assignees_workspace_id ON public.task_assignees(workspace_id);

-- Backfill from the existing single assignee column.
INSERT INTO public.task_assignees (task_id, user_id, project_id, workspace_id)
SELECT t.id, t.assignee_id, t.project_id, t.workspace_id
FROM public.tasks t
WHERE t.assignee_id IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- Notify a person when they are newly assigned to a task.
CREATE OR REPLACE FUNCTION public.notify_task_assignee_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title text;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    SELECT title INTO v_title FROM public.tasks WHERE id = NEW.task_id;
    INSERT INTO public.notifications (user_id, workspace_id, type, title, body, url, entity_type, entity_id)
    VALUES (
      NEW.user_id, NEW.workspace_id, 'task_assigned',
      'New task assigned',
      COALESCE(v_title, 'A task'),
      '/projects/' || NEW.project_id,
      'task', NEW.task_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_assignee_added
  AFTER INSERT ON public.task_assignees
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignee_added();

-- Realtime support.
ALTER TABLE public.task_assignees REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;