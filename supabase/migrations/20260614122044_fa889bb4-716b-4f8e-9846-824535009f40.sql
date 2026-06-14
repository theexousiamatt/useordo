
-- ============ workspace_members extensions ============
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_workspace_user_unique'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT workspace_members_workspace_user_unique UNIQUE (workspace_id, user_id);
  END IF;
END $$;

-- ============ helper: owner or manager ============
CREATE OR REPLACE FUNCTION public.can_manage_workspace(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
      AND role IN ('owner','manager') AND status = 'active'
  );
$$;

-- ============ workspace_invitations ============
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_invitations_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON public.workspace_invitations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations (email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON public.workspace_invitations (status);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON public.workspace_invitations (token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO authenticated;
GRANT ALL ON public.workspace_invitations TO service_role;

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view workspace invitations"
ON public.workspace_invitations FOR SELECT TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE POLICY "Managers can create workspace invitations"
ON public.workspace_invitations FOR INSERT TO authenticated
WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()) AND role <> 'owner');

CREATE POLICY "Managers can update workspace invitations"
ON public.workspace_invitations FOR UPDATE TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()))
WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE POLICY "Managers can delete workspace invitations"
ON public.workspace_invitations FOR DELETE TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_workspace_invitations_updated_at
  BEFORE UPDATE ON public.workspace_invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_workspace_members_updated_at
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ widen member management to managers ============
DROP POLICY IF EXISTS "Owners can update members" ON public.workspace_members;
CREATE POLICY "Managers can update members"
ON public.workspace_members FOR UPDATE TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()))
WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can remove members" ON public.workspace_members;
CREATE POLICY "Managers can remove members"
ON public.workspace_members FOR DELETE TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can add members" ON public.workspace_members;
CREATE POLICY "Managers can add members"
ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_workspace(workspace_id, auth.uid())
  OR (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()
  ))
);
