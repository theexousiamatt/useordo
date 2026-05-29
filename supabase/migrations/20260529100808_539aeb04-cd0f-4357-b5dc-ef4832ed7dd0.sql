-- Add email to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Workspace role enum
DO $$ BEGIN
  CREATE TYPE public.workspace_role AS ENUM ('owner', 'member', 'client');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.workspace_type AS ENUM ('freelancer', 'agency', 'consultant', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- WORKSPACES
CREATE TABLE public.workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type public.workspace_type NOT NULL DEFAULT 'other',
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- WORKSPACE MEMBERS
CREATE TABLE public.workspace_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(_workspace_id uuid, _user_id uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND user_id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_workspace_id uuid, _user_id uuid, _role public.workspace_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id AND role = _role
  );
$$;

-- WORKSPACES policies
CREATE POLICY "Members can view their workspaces"
ON public.workspaces FOR SELECT TO authenticated
USING (public.is_workspace_member(id, auth.uid()));

CREATE POLICY "Users can create their own workspace"
ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their workspace"
ON public.workspaces FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their workspace"
ON public.workspaces FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- WORKSPACE MEMBERS policies
CREATE POLICY "Members can view co-members"
ON public.workspace_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners can add members"
ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (
  public.has_workspace_role(workspace_id, auth.uid(), 'owner')
  OR (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()
  ))
);

CREATE POLICY "Owners can update members"
ON public.workspace_members FOR UPDATE TO authenticated
USING (public.has_workspace_role(workspace_id, auth.uid(), 'owner'))
WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), 'owner'));

CREATE POLICY "Owners can remove members"
ON public.workspace_members FOR DELETE TO authenticated
USING (public.has_workspace_role(workspace_id, auth.uid(), 'owner'));

-- ACTIVITY LOGS policies
CREATE POLICY "Members can view activity"
ON public.activity_logs FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can insert activity"
ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));

-- Timestamp trigger
CREATE TRIGGER trg_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();