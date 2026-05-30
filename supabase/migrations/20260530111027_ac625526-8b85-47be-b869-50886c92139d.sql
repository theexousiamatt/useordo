-- 1. Restrict profile visibility to self or shared-workspace members
CREATE OR REPLACE FUNCTION public.shares_workspace_with(_profile_id uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm_self
    JOIN public.workspace_members wm_other
      ON wm_self.workspace_id = wm_other.workspace_id
    WHERE wm_self.user_id = _viewer
      AND wm_other.user_id = _profile_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE w.owner_id = _profile_id AND wm.user_id = _viewer
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE w.owner_id = _viewer AND wm.user_id = _profile_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w1
    JOIN public.workspaces w2 ON w1.owner_id = _viewer AND w2.owner_id = _profile_id
    WHERE w1.id = w2.id
  );
$$;

DROP POLICY IF EXISTS "Profiles are viewable by all authenticated users" ON public.profiles;

CREATE POLICY "Profiles viewable by self or shared workspace members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.shares_workspace_with(id, auth.uid())
);

-- 2. Add UPDATE/DELETE storage policies for project-files (folder = project_id)
CREATE POLICY "Project members can update project files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-files'
  AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
)
WITH CHECK (
  bucket_id = 'project-files'
  AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Project members can delete project files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-files'
  AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
