-- A retry returns the same pending invitation instead of issuing another token/email event.
CREATE OR REPLACE FUNCTION public.prepare_workspace_invitations(
 _workspace_id uuid, _emails text[], _role public.workspace_role
) RETURNS TABLE(email text, invitation_id uuid, outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); address text; pending public.workspace_invitations%ROWTYPE;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor AND email_confirmed_at IS NOT NULL) THEN
   RAISE EXCEPTION 'A verified account is required';
 END IF;
 IF NOT public.can_manage_workspace(_workspace_id,actor) THEN RAISE EXCEPTION 'Workspace access denied'; END IF;
 IF _role IS NULL OR _role='owner' THEN RAISE EXCEPTION 'Choose member, manager or client'; END IF;
 IF _emails IS NULL OR cardinality(_emails)>50 THEN RAISE EXCEPTION 'Invite up to 50 people at a time'; END IF;
 FOR address IN SELECT DISTINCT lower(trim(value)) FROM unnest(_emails) AS addresses(value) ORDER BY 1 LOOP
   IF address IS NULL OR length(address)>254 OR address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
     RAISE EXCEPTION 'Enter valid email addresses';
   END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(_workspace_id::text||':'||address,0));
   IF EXISTS(SELECT 1 FROM auth.users u WHERE lower(u.email)=address
     AND public.is_workspace_member(_workspace_id,u.id)) THEN
     RETURN QUERY SELECT address,NULL::uuid,'member'::text;
     CONTINUE;
   END IF;
   SELECT i.* INTO pending FROM public.workspace_invitations i
     WHERE i.workspace_id=_workspace_id AND lower(trim(i.email))=address
       AND i.status='pending' AND i.expires_at>now()
     ORDER BY i.created_at DESC,i.id LIMIT 1 FOR UPDATE;
   IF FOUND THEN
     IF pending.role<>_role THEN RAISE EXCEPTION 'An invitation with a different role already exists. Manage it from Team.'; END IF;
     RETURN QUERY SELECT address,pending.id,'pending'::text;
   ELSE
     INSERT INTO public.workspace_invitations(workspace_id,email,role,invited_by,status)
       VALUES(_workspace_id,address,_role,actor,'pending') RETURNING * INTO pending;
     RETURN QUERY SELECT address,pending.id,'created'::text;
   END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.prepare_workspace_invitations(uuid,text[],public.workspace_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_workspace_invitations(uuid,text[],public.workspace_role) TO authenticated,service_role;
