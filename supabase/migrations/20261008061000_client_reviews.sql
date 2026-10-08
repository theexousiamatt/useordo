-- Shared deliverables are the client review boundary; internal tasks stay private.
DROP POLICY "View deliverables" ON public.deliverables;
CREATE POLICY "View deliverables" ON public.deliverables FOR SELECT TO authenticated
 USING(public.can_contribute_project(project_id,auth.uid())
 OR (public.is_project_client(project_id,auth.uid()) AND status<>'draft'));
DROP POLICY "Create projects" ON public.projects;
CREATE POLICY "Create projects" ON public.projects FOR INSERT TO authenticated
 WITH CHECK(public.is_workspace_collaborator(workspace_id,auth.uid()));

CREATE TABLE public.deliverable_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 deliverable_id uuid NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
 reviewer_id uuid NOT NULL REFERENCES auth.users(id),
 decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 note text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deliverable_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.deliverable_reviews TO authenticated;
GRANT ALL ON public.deliverable_reviews TO service_role;
CREATE POLICY "View project reviews" ON public.deliverable_reviews
 FOR SELECT TO authenticated USING(public.can_view_project(project_id,auth.uid()));
CREATE OR REPLACE FUNCTION public.review_deliverable(_id uuid,_decision text,_note text DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.deliverables%ROWTYPE; actor uuid:=auth.uid(); review_id uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF _decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 IF length(coalesce(_note,''))>5000 THEN RAISE EXCEPTION 'Feedback is too long'; END IF;
 SELECT * INTO d FROM public.deliverables WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR NOT public.is_project_client(d.project_id,actor) THEN
   RAISE EXCEPTION 'You cannot review this deliverable';
 END IF;
 IF d.status<>'submitted' OR NOT d.requires_approval THEN
   RAISE EXCEPTION 'This deliverable is no longer awaiting approval';
 END IF;
 UPDATE public.deliverables SET status=_decision,
 approved_at=CASE WHEN _decision='approved' THEN now() END,
 approved_by=CASE WHEN _decision='approved' THEN actor END WHERE id=_id;
 INSERT INTO public.deliverable_reviews(workspace_id,project_id,deliverable_id,reviewer_id,decision,note)
 VALUES(d.workspace_id,d.project_id,d.id,actor,_decision,_note) RETURNING id INTO review_id;
 INSERT INTO public.notifications(user_id,workspace_id,type,title,body,url,entity_type,entity_id)
 SELECT p.owner_id,d.workspace_id,'deliverable_review',
 CASE WHEN _decision='approved' THEN 'Deliverable approved' ELSE 'Changes requested' END,
 d.title,'/projects/'||d.project_id,'deliverable',d.id
 FROM public.projects p WHERE p.id=d.project_id AND p.owner_id IS NOT NULL AND p.owner_id<>actor;
 RETURN review_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_deliverable(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_deliverable(uuid,text,text) TO authenticated;
