-- Task mentions: notifications are created by a narrow authenticated RPC,
-- never by an unrestricted INSERT policy on public.notifications.
-- Existing task/comment/notification schemas and data remain untouched.

CREATE OR REPLACE FUNCTION public.notify_task_mentions(
  _comment_id uuid,
  _mentioned_user_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_comment public.project_comments%ROWTYPE;
  v_sent integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF _comment_id IS NULL OR _mentioned_user_ids IS NULL THEN
    RAISE EXCEPTION 'Comment and mentioned users required';
  END IF;
  IF cardinality(_mentioned_user_ids) > 10 THEN
    RAISE EXCEPTION 'Too many mentions';
  END IF;

  -- Lock one comment so retries cannot race each other into duplicating notifications.
  SELECT * INTO v_comment
  FROM public.project_comments
  WHERE id = _comment_id AND author_id = v_actor
  FOR UPDATE;
  IF NOT FOUND OR v_comment.task_id IS NULL OR
     NOT public.can_contribute_project(v_comment.project_id, v_actor) THEN
    RAISE EXCEPTION 'Comment not found or access denied';
  END IF;

  INSERT INTO public.notifications(
    user_id, workspace_id, type, title, body, url, entity_type, entity_id
  )
  SELECT DISTINCT member.user_id,
    v_comment.workspace_id,
    'task_mention',
    'Mentioned in a task discussion',
    'A teammate mentioned you in a project task.',
    '/projects/' || v_comment.project_id::text || '?task=' || v_comment.task_id::text,
    'comment',
    v_comment.id
  FROM public.project_members member
  JOIN public.workspaces workspace ON workspace.id = v_comment.workspace_id
  LEFT JOIN public.workspace_members wm
    ON wm.workspace_id = v_comment.workspace_id AND wm.user_id = member.user_id
  WHERE member.project_id = v_comment.project_id
    AND member.workspace_id = v_comment.workspace_id
    AND member.role::text IN ('owner','manager','member')
    AND member.user_id <> v_actor
    AND member.user_id = ANY(_mentioned_user_ids)
    AND (wm.status::text = 'active' OR workspace.owner_id = member.user_id)
    -- Only the explicit token in this saved comment can authorize a notification.
    AND position('](' || member.user_id::text || ')' IN v_comment.content) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = member.user_id
        AND n.type = 'task_mention'
        AND n.entity_type = 'comment'
        AND n.entity_id = v_comment.id
    );

  GET DIAGNOSTICS v_sent = ROW_COUNT;
  RETURN v_sent;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_task_mentions(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_task_mentions(uuid,uuid[]) TO authenticated;
