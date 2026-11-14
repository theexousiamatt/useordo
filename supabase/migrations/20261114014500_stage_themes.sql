-- Stage-level themes for legacy Ordo. No existing tasks or project data are reset.
-- Original projects.theme column is retained temporarily for old-client compatibility;
-- the application now exclusively reads project_stages.theme.
BEGIN;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'neutral';
ALTER TABLE public.project_stages
  ADD CONSTRAINT project_stages_theme_allowed
  CHECK (theme IN ('neutral','forest','ocean','lavender','rose','amber','slate'));

-- Atomic stage creation with chosen theme; existing reporting category stays internal.
-- Receipt-based replay protection matches manage_project_stage's request discipline.
CREATE FUNCTION public.create_custom_stage(
  _project_id uuid, _name text, _theme text, _category text, _request_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  actor uuid; project_workspace uuid; result uuid;
  previous public.project_stage_receipts%ROWTYPE; payload jsonb;
BEGIN
  actor := auth.uid();
  IF actor IS NULL OR _project_id IS NULL OR _request_id IS NULL THEN
    RAISE EXCEPTION 'Authentication, project and request ID required' USING ERRCODE='42501';
  END IF;
  IF _name IS NULL OR length(btrim(_name)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Stage name must be between 1 and 160 characters' USING ERRCODE='22023';
  END IF;
  IF _theme IS NULL OR _theme NOT IN ('neutral','forest','ocean','lavender','rose','amber','slate') THEN
    RAISE EXCEPTION 'Choose a valid stage theme' USING ERRCODE='22023';
  END IF;
  IF _category IS NULL OR _category NOT IN ('backlog','todo','in_progress','review','done') THEN
    RAISE EXCEPTION 'Invalid internal reporting category' USING ERRCODE='22023';
  END IF;
  SELECT p.workspace_id INTO project_workspace FROM public.projects p
    WHERE p.id = _project_id AND p.archived_at IS NULL FOR UPDATE;
  IF project_workspace IS NULL OR NOT public.can_manage_project(_project_id, actor) THEN
    RAISE EXCEPTION 'Stage management denied' USING ERRCODE='42501';
  END IF;
  payload := jsonb_build_object('project',_project_id,'action','create_custom_stage',
    'name',btrim(_name),'theme',_theme,'category',_category);
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||_request_id::text,0));
  SELECT * INTO previous FROM public.project_stage_receipts
    WHERE actor_id=actor AND request_id=_request_id;
  IF FOUND THEN
    IF previous.payload IS DISTINCT FROM payload THEN
      RAISE EXCEPTION 'Request ID already used for different stage input' USING ERRCODE='22023';
    END IF;
    RETURN previous.result_id;
  END IF;
  INSERT INTO public.project_stages(workspace_id,project_id,name,category,theme,position)
  VALUES(project_workspace,_project_id,btrim(_name),_category,_theme,
    (SELECT coalesce(max(position)+1,0) FROM public.project_stages WHERE project_id=_project_id))
  RETURNING id INTO result;
  INSERT INTO public.project_stage_receipts(actor_id,request_id,project_id,payload,result_id)
    VALUES(actor,_request_id,_project_id,payload,result);
  RETURN result;
END $$;

-- Theme changes are stage-scoped and version checked, not per task or per board.
CREATE FUNCTION public.set_project_stage_theme(
  _project_id uuid, _stage_id uuid, _theme text, _expected_revision integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid; project_workspace uuid; result uuid;
BEGIN
  actor := auth.uid();
  IF actor IS NULL OR _project_id IS NULL OR _stage_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and stage are required' USING ERRCODE='42501';
  END IF;
  IF _theme IS NULL OR _theme NOT IN ('neutral','forest','ocean','lavender','rose','amber','slate') THEN
    RAISE EXCEPTION 'Unknown stage theme' USING ERRCODE='22023';
  END IF;
  SELECT p.workspace_id INTO project_workspace FROM public.projects p
    WHERE p.id=_project_id AND p.archived_at IS NULL FOR UPDATE;
  IF project_workspace IS NULL OR NOT public.can_manage_project(_project_id,actor) THEN
    RAISE EXCEPTION 'Stage management denied' USING ERRCODE='42501';
  END IF;
  UPDATE public.project_stages
  SET theme=_theme,revision=revision+CASE WHEN theme IS DISTINCT FROM _theme THEN 1 ELSE 0 END
  WHERE project_id=_project_id AND id=_stage_id AND revision=_expected_revision
  RETURNING id INTO result;
  IF result IS NULL THEN
    RAISE EXCEPTION 'Stage changed; reload before saving' USING ERRCODE='40001';
  END IF;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.create_custom_stage(uuid,text,text,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_project_stage_theme(uuid,uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_custom_stage(uuid,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_project_stage_theme(uuid,uuid,text,integer) TO authenticated;
COMMENT ON COLUMN public.project_stages.theme IS
 'Theme for cards in this stage, unrelated to task labels and internal status.';
COMMIT;
