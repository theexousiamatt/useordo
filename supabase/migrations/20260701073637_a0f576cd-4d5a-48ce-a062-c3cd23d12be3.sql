-- 1. Deep-link task-assignment notifications directly to the task via ?task= param.
CREATE OR REPLACE FUNCTION public.notify_task_assignee_added()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      '/projects/' || NEW.project_id || '?task=' || NEW.task_id,
      'task', NEW.task_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Attach the trigger so in-app notifications actually fire on assignment.
DROP TRIGGER IF EXISTS trg_notify_task_assignee_added ON public.task_assignees;
CREATE TRIGGER trg_notify_task_assignee_added
  AFTER INSERT ON public.task_assignees
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignee_added();

-- 3. Realtime for notifications so badges update live across sessions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;