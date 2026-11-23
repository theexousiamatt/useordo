CREATE FUNCTION public.list_project_reviewers(_project_id uuid)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT candidate.id, nullif(btrim(profile.full_name), '')
  FROM (
    SELECT p.client_id AS id FROM public.projects p WHERE p.id = _project_id
    UNION
    SELECT pm.user_id FROM public.project_members pm WHERE pm.project_id = _project_id AND pm.role = 'client'
  ) candidate
  LEFT JOIN public.profiles profile ON profile.id = candidate.id
  WHERE public.can_contribute_project(_project_id, auth.uid())
    AND public.is_project_client(_project_id, candidate.id)
  ORDER BY 2 NULLS LAST, 1;
$$;

CREATE FUNCTION public.request_deliverable_review(_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item public.deliverables%ROWTYPE;
BEGIN
  SELECT * INTO item FROM public.deliverables WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.can_contribute_project(item.project_id, auth.uid()) THEN
    RAISE EXCEPTION 'You cannot send this deliverable for review';
  END IF;
  IF NOT item.requires_approval OR item.status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'This deliverable is no longer ready to send for client approval';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.list_project_reviewers(item.project_id)) THEN
    RAISE EXCEPTION 'Add an active client reviewer to the project first';
  END IF;

  UPDATE public.deliverables SET status = 'submitted', approved_at = NULL, approved_by = NULL WHERE id = _id;
  INSERT INTO public.notifications(user_id,workspace_id,type,title,body,url,entity_type,entity_id)
  SELECT reviewer.user_id, item.workspace_id, 'deliverable_review', 'Ready for your approval',
         item.title, '/client/deliverables/' || item.id, 'deliverable', item.id
  FROM public.list_project_reviewers(item.project_id) reviewer;
  RETURN item.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_project_reviewers(uuid), public.request_deliverable_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_project_reviewers(uuid), public.request_deliverable_review(uuid) TO authenticated;
