-- Explicit API access for the independently hosted backend.
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
 public.profiles, public.workspaces, public.workspace_members,
 public.workspace_invitations, public.projects, public.project_members,
 public.tasks, public.task_assignees,
 public.project_labels, public.task_labels, public.milestones, public.deliverables,
 public.approvals, public.files, public.project_files, public.project_comments,
 public.project_activity, public.activity, public.activity_logs,
 public.ai_plans, public.ai_plan_items, public.notifications
TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Invitations are email-bound and consumed in the same transaction as membership.
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(
 _token text, _user_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
 inv public.workspace_invitations%ROWTYPE;
 user_email text;
 verified_at timestamptz;
BEGIN
 SELECT email, email_confirmed_at INTO user_email, verified_at
 FROM auth.users WHERE id = _user_id;
 IF user_email IS NULL OR verified_at IS NULL THEN
   RAISE EXCEPTION 'Verify your email before accepting an invitation';
 END IF;
 SELECT * INTO inv FROM public.workspace_invitations
 WHERE token = _token FOR UPDATE;
 IF NOT FOUND OR inv.status <> 'pending' OR inv.expires_at <= now() THEN
   RAISE EXCEPTION 'Invitation is invalid or expired';
 END IF;
 IF lower(trim(inv.email)) <> lower(trim(user_email)) THEN
   RAISE EXCEPTION 'Sign in with the email address this invitation was sent to';
 END IF;
 IF inv.role = 'owner' THEN RAISE EXCEPTION 'Ownership cannot be granted by invitation'; END IF;
 INSERT INTO public.workspace_members(workspace_id,user_id,role,invited_by,status)
 VALUES(inv.workspace_id,_user_id,inv.role,inv.invited_by,'active')
 ON CONFLICT(workspace_id,user_id) DO NOTHING;
 UPDATE public.workspace_invitations
 SET status='accepted',accepted_at=now() WHERE id=inv.id;
 RETURN inv.workspace_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_workspace_invitation(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(text,uuid) TO service_role;

-- A manager must not promote themselves or other users to owner.
CREATE OR REPLACE FUNCTION public.protect_workspace_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); actual_owner uuid;
BEGIN
 IF current_user = 'postgres' AND actor IS NULL THEN
   RETURN COALESCE(NEW,OLD);
 END IF;
 IF auth.role() = 'service_role' THEN RETURN COALESCE(NEW,OLD); END IF;
 SELECT owner_id INTO actual_owner FROM public.workspaces
 WHERE id=COALESCE(NEW.workspace_id,OLD.workspace_id);
 IF TG_OP='UPDATE' AND (NEW.workspace_id<>OLD.workspace_id OR NEW.user_id<>OLD.user_id) THEN
   RAISE EXCEPTION 'Membership identity cannot be changed';
 END IF;
 IF TG_OP='DELETE' AND OLD.user_id=actual_owner THEN
   RAISE EXCEPTION 'Workspace owner cannot be removed';
 END IF;
 IF TG_OP<>'DELETE' AND NEW.role='owner' AND NEW.user_id<>actual_owner THEN
   RAISE EXCEPTION 'Ownership must match the workspace owner';
 END IF;
 IF TG_OP='UPDATE' AND OLD.user_id=actual_owner AND (NEW.role<>'owner' OR NEW.status<>'active') THEN
   RAISE EXCEPTION 'Workspace owner membership cannot be changed';
 END IF;
 RETURN COALESCE(NEW,OLD);
END;
$$;
CREATE TRIGGER protect_workspace_membership
 BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_members
 FOR EACH ROW EXECUTE FUNCTION public.protect_workspace_membership();
