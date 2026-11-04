-- Canonical Ordo S1 baseline. Apply only to a separately verified empty target.
-- This file is deliberately outside the active legacy migration directory.
BEGIN;

CREATE TABLE public.foundation_environment (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  environment text NOT NULL CHECK (environment IN ('development','staging','production')),
  target_ref text NOT NULL CHECK (length(trim(target_ref)) > 0),
  schema_version text NOT NULL CHECK (schema_version = 'ordo-foundation-v1'),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- No environment identity is inferred or seeded by a migration.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text CHECK (length(full_name) <= 200),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 80),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.organization_memberships (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('owner','admin','manager','member','client')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,user_id)
);
CREATE INDEX organization_memberships_user_idx ON public.organization_memberships(user_id,organization_id) WHERE status='active';
CREATE TABLE public.capabilities (
  key text PRIMARY KEY,
  description text NOT NULL
);
INSERT INTO public.capabilities(key,description) VALUES
 ('organization.manage','Manage studio settings and scoped capabilities'),
 ('memberships.manage','Manage studio memberships'),
 ('clients.manage','Create and manage client businesses and contacts'),
 ('initiatives.manage','Create and manage studio initiatives'),
 ('projects.create','Create a project and its production context'),
 ('production.read_all','Read production work throughout the studio'),
 ('production.write_all','Manage production work throughout the studio'),
 ('commercials.manage','Read and manage commercial agreements');
CREATE TABLE public.organization_role_capabilities (
  role text NOT NULL CHECK (role IN ('owner','admin','manager','member','client')),
  capability_key text NOT NULL REFERENCES public.capabilities(key) ON DELETE RESTRICT,
  PRIMARY KEY(role,capability_key)
);
INSERT INTO public.organization_role_capabilities(role,capability_key)
 SELECT role,key FROM (VALUES('owner'),('admin')) roles(role) CROSS JOIN public.capabilities;
INSERT INTO public.organization_role_capabilities(role,capability_key) VALUES
 ('manager','clients.manage'),('manager','initiatives.manage'),('manager','projects.create');
CREATE TABLE public.organization_capability_grants (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  capability_key text NOT NULL REFERENCES public.capabilities(key) ON DELETE RESTRICT,
  granted_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,user_id,capability_key),
  FOREIGN KEY(organization_id,user_id) REFERENCES public.organization_memberships(organization_id,user_id) ON DELETE CASCADE
);

CREATE TABLE public.client_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id)
);
CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_organization_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  email text NOT NULL CHECK(length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND email=lower(trim(email))),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id),
  UNIQUE(organization_id,client_organization_id,id),
  UNIQUE(organization_id,client_organization_id,email),
  FOREIGN KEY(organization_id,client_organization_id) REFERENCES public.client_organizations(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.internal_initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  description text CHECK(length(description) <= 10000),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id)
);
-- Commercial terms are a separate table with a separate permission boundary.
CREATE TABLE public.engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_organization_id uuid NOT NULL,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  scope text CHECK(length(scope) <= 20000),
  amount_minor bigint CHECK(amount_minor >= 0),
  currency text CHECK(currency ~ '^[A-Z]{3}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id),
  UNIQUE(organization_id,client_organization_id,id),
  FOREIGN KEY(organization_id,client_organization_id) REFERENCES public.client_organizations(organization_id,id) ON DELETE RESTRICT,
  CHECK((amount_minor IS NULL) = (currency IS NULL))
);

CREATE TABLE public.work_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK(kind IN ('project','operational')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id),
  UNIQUE(organization_id,id,kind)
);
CREATE TABLE public.work_context_memberships (
  organization_id uuid NOT NULL,
  work_context_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN ('owner','manager','contributor','viewer')),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,work_context_id,user_id),
  FOREIGN KEY(organization_id,work_context_id) REFERENCES public.work_contexts(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,user_id) REFERENCES public.organization_memberships(organization_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE public.operational_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  work_context_id uuid NOT NULL UNIQUE,
  context_kind text NOT NULL DEFAULT 'operational' CHECK(context_kind='operational'),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  description text CHECK(length(description) <= 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,work_context_id,context_kind) REFERENCES public.work_contexts(organization_id,id,kind) ON DELETE RESTRICT
);
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  work_context_id uuid NOT NULL UNIQUE,
  context_kind text NOT NULL DEFAULT 'project' CHECK(context_kind='project'),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  description text CHECK(length(description) <= 10000),
  ownership text NOT NULL CHECK(ownership IN ('client','internal')),
  lifecycle text NOT NULL CHECK(lifecycle IN ('fixed_scope','recurring','continuous','operational')),
  client_organization_id uuid,
  internal_initiative_id uuid,
  engagement_id uuid,
  owner_id uuid NOT NULL,
  due_date date,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id),
  UNIQUE(organization_id,client_organization_id,id),
  FOREIGN KEY(organization_id,work_context_id,context_kind) REFERENCES public.work_contexts(organization_id,id,kind) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,owner_id) REFERENCES public.organization_memberships(organization_id,user_id) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,client_organization_id) REFERENCES public.client_organizations(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,internal_initiative_id) REFERENCES public.internal_initiatives(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,client_organization_id,engagement_id) REFERENCES public.engagements(organization_id,client_organization_id,id) ON DELETE RESTRICT,
  CHECK((ownership='client' AND client_organization_id IS NOT NULL AND internal_initiative_id IS NULL)
    OR (ownership='internal' AND client_organization_id IS NULL AND engagement_id IS NULL))
);
CREATE INDEX projects_organization_created_idx ON public.projects(organization_id,created_at DESC);
CREATE TABLE public.disciplines (key text PRIMARY KEY, name text NOT NULL);
INSERT INTO public.disciplines(key,name) VALUES
 ('branding','Branding'),('web','Web'),('software','Software'),('content','Content'),('growth','Growth'),('operations','Operations');
CREATE TABLE public.project_disciplines (
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  discipline_key text NOT NULL REFERENCES public.disciplines(key) ON DELETE RESTRICT,
  PRIMARY KEY(organization_id,project_id,discipline_key),
  FOREIGN KEY(organization_id,project_id) REFERENCES public.projects(organization_id,id) ON DELETE RESTRICT
);
-- Future publication grants describe permitted audiences; they never grant
-- SELECT on projects, production tasks, commercial agreements or private assets.
CREATE TABLE public.client_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_organization_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  project_id uuid,
  scope text NOT NULL CHECK(scope IN ('client_library','project_publications')),
  granted_by uuid NOT NULL REFERENCES public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,client_organization_id,contact_id) REFERENCES public.client_contacts(organization_id,client_organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,client_organization_id,project_id) REFERENCES public.projects(organization_id,client_organization_id,id) ON DELETE RESTRICT,
  CHECK((scope='client_library' AND project_id IS NULL) OR (scope='project_publications' AND project_id IS NOT NULL))
);

CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  work_context_id uuid NOT NULL,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  position integer NOT NULL DEFAULT 0 CHECK(position >= 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,work_context_id,id),
  FOREIGN KEY(organization_id,work_context_id) REFERENCES public.work_contexts(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  work_context_id uuid NOT NULL,
  board_id uuid NOT NULL,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  category text NOT NULL CHECK(category IN ('backlog','todo','in_progress','review','done')),
  position integer NOT NULL CHECK(position >= 0),
  UNIQUE(organization_id,work_context_id,board_id,id,category),
  UNIQUE(board_id,position) DEFERRABLE INITIALLY IMMEDIATE,
  FOREIGN KEY(organization_id,work_context_id,board_id) REFERENCES public.boards(organization_id,work_context_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  work_context_id uuid NOT NULL,
  board_id uuid,
  column_id uuid,
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 500),
  description text CHECK(length(description) <= 50000),
  item_kind text NOT NULL DEFAULT 'task' CHECK(item_kind IN ('task','issue','feature')),
  category text NOT NULL DEFAULT 'todo' CHECK(category IN ('backlog','todo','in_progress','review','done')),
  priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  position integer NOT NULL DEFAULT 0 CHECK(position >= 0),
  due_date date,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,work_context_id,id),
  FOREIGN KEY(organization_id,work_context_id) REFERENCES public.work_contexts(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,work_context_id,board_id,column_id,category) REFERENCES public.board_columns(organization_id,work_context_id,board_id,id,category) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK((board_id IS NULL) = (column_id IS NULL))
);
CREATE INDEX tasks_context_category_idx ON public.tasks(organization_id,work_context_id,category,position) WHERE archived_at IS NULL;
CREATE INDEX tasks_due_idx ON public.tasks(organization_id,due_date) WHERE archived_at IS NULL AND category<>'done';
CREATE TABLE public.task_assignees (
  organization_id uuid NOT NULL,
  work_context_id uuid NOT NULL,
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,task_id,user_id),
  FOREIGN KEY(organization_id,work_context_id,task_id) REFERENCES public.tasks(organization_id,work_context_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,user_id) REFERENCES public.organization_memberships(organization_id,user_id) ON DELETE RESTRICT
);
CREATE INDEX task_assignees_user_idx ON public.task_assignees(organization_id,user_id,task_id);
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  work_context_id uuid NOT NULL,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  due_date date,
  status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,work_context_id) REFERENCES public.work_contexts(organization_id,id) ON DELETE RESTRICT,
  CHECK((status='completed') = (completed_at IS NOT NULL))
);
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  work_context_id uuid NOT NULL,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 500),
  bucket_id text NOT NULL DEFAULT 'ordo-private-assets' CHECK(bucket_id='ordo-private-assets'),
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK(length(mime_type) BETWEEN 1 AND 200),
  size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 0 AND 104857600),
  state text NOT NULL DEFAULT 'staged' CHECK(state IN ('staged','available','deleting','deleted')),
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,work_context_id) REFERENCES public.work_contexts(organization_id,id) ON DELETE RESTRICT,
  CHECK(storage_path LIKE organization_id::text||'/assets/'||id::text||'/%' AND storage_path !~ '(^|/)\.\.(/|$)')
);

CREATE TABLE public.command_receipts (
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  command text NOT NULL,
  request_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL,
  result_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id,command,request_id)
);
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text NOT NULL,
  entity_id uuid NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.foundation_is_internal(_organization_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.organization_memberships m JOIN public.organizations o ON o.id=m.organization_id
   WHERE m.organization_id=_organization_id AND m.user_id=auth.uid() AND m.status='active' AND m.role<>'client' AND o.archived_at IS NULL);
$$;
CREATE FUNCTION public.foundation_has_capability(_organization_id uuid,_capability text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.foundation_is_internal(_organization_id) AND EXISTS(
  SELECT 1 FROM public.organization_memberships m WHERE m.organization_id=_organization_id AND m.user_id=auth.uid()
   AND (EXISTS(SELECT 1 FROM public.organization_role_capabilities r WHERE r.role=m.role AND r.capability_key=_capability)
    OR EXISTS(SELECT 1 FROM public.organization_capability_grants g WHERE g.organization_id=m.organization_id AND g.user_id=m.user_id AND g.capability_key=_capability)));
$$;
CREATE FUNCTION public.foundation_can_read_context(_organization_id uuid,_context_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.foundation_is_internal(_organization_id) AND EXISTS(
  SELECT 1 FROM public.work_contexts c WHERE c.organization_id=_organization_id AND c.id=_context_id
   AND (public.foundation_has_capability(_organization_id,'production.read_all')
    OR EXISTS(SELECT 1 FROM public.work_context_memberships m WHERE m.organization_id=c.organization_id AND m.work_context_id=c.id AND m.user_id=auth.uid() AND m.status='active')));
$$;
CREATE FUNCTION public.foundation_can_write_context(_organization_id uuid,_context_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.foundation_is_internal(_organization_id) AND EXISTS(
  SELECT 1 FROM public.work_contexts c WHERE c.organization_id=_organization_id AND c.id=_context_id
   AND (public.foundation_has_capability(_organization_id,'production.write_all')
    OR EXISTS(SELECT 1 FROM public.work_context_memberships m WHERE m.organization_id=c.organization_id AND m.work_context_id=c.id AND m.user_id=auth.uid() AND m.status='active' AND m.role IN ('owner','manager','contributor'))));
$$;
CREATE FUNCTION public.foundation_can_read_client(_organization_id uuid,_client_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.foundation_is_internal(_organization_id) AND (
  public.foundation_has_capability(_organization_id,'clients.manage') OR EXISTS(
   SELECT 1 FROM public.projects p WHERE p.organization_id=_organization_id AND p.client_organization_id=_client_id
    AND public.foundation_can_read_context(p.organization_id,p.work_context_id)));
$$;
CREATE FUNCTION public.foundation_can_read_initiative(_organization_id uuid,_initiative_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.foundation_is_internal(_organization_id) AND (
  public.foundation_has_capability(_organization_id,'initiatives.manage') OR EXISTS(
   SELECT 1 FROM public.projects p WHERE p.organization_id=_organization_id AND p.internal_initiative_id=_initiative_id
    AND public.foundation_can_read_context(p.organization_id,p.work_context_id)));
$$;
CREATE FUNCTION public.foundation_can_read_profile(_profile_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT _profile_id=auth.uid() OR EXISTS(
  SELECT 1 FROM public.organization_memberships m WHERE m.user_id=_profile_id AND m.status='active'
   AND public.foundation_is_internal(m.organization_id));
$$;

CREATE FUNCTION public.foundation_validate_production_member() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.organization_memberships m WHERE m.organization_id=NEW.organization_id
  AND m.user_id=NEW.user_id AND m.status='active' AND m.role<>'client') THEN
  RAISE EXCEPTION 'Production membership requires an active internal studio member' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_context_member BEFORE INSERT OR UPDATE ON public.work_context_memberships
 FOR EACH ROW EXECUTE FUNCTION public.foundation_validate_production_member();
CREATE TRIGGER validate_task_assignee BEFORE INSERT OR UPDATE ON public.task_assignees
 FOR EACH ROW EXECUTE FUNCTION public.foundation_validate_production_member();
CREATE FUNCTION public.foundation_validate_task_context() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.board_id IS NULL AND EXISTS(SELECT 1 FROM public.work_contexts c WHERE c.organization_id=NEW.organization_id AND c.id=NEW.work_context_id AND c.kind='project') THEN
  RAISE EXCEPTION 'A project task requires one home board and column' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_task_context BEFORE INSERT OR UPDATE ON public.tasks
 FOR EACH ROW EXECUTE FUNCTION public.foundation_validate_task_context();
CREATE FUNCTION public.foundation_keep_context_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.id IS DISTINCT FROM OLD.id THEN
  RAISE EXCEPTION 'Work context identity cannot be changed' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER keep_context_identity BEFORE UPDATE ON public.work_contexts
 FOR EACH ROW EXECUTE FUNCTION public.foundation_keep_context_identity();
CREATE FUNCTION public.foundation_validate_context_parent() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE context public.work_contexts%ROWTYPE; context_id uuid;
BEGIN
 IF TG_TABLE_NAME='work_contexts' THEN context_id:=NEW.id;
 ELSE context_id:=OLD.work_context_id; END IF;
 SELECT * INTO context FROM public.work_contexts WHERE id=context_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF (context.kind='project' AND NOT EXISTS(SELECT 1 FROM public.projects WHERE organization_id=context.organization_id AND work_context_id=context.id))
  OR (context.kind='operational' AND NOT EXISTS(SELECT 1 FROM public.operational_contexts WHERE organization_id=context.organization_id AND work_context_id=context.id)) THEN
  RAISE EXCEPTION 'A work context must have its matching business parent' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER validate_context_parent AFTER INSERT OR UPDATE ON public.work_contexts
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.foundation_validate_context_parent();
CREATE CONSTRAINT TRIGGER preserve_project_context_parent AFTER DELETE OR UPDATE ON public.projects
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.foundation_validate_context_parent();
CREATE CONSTRAINT TRIGGER preserve_operational_context_parent AFTER DELETE OR UPDATE ON public.operational_contexts
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.foundation_validate_context_parent();

CREATE FUNCTION public.foundation_require_actor() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor AND email_confirmed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'A verified signed-in account is required' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.profiles(id) VALUES(actor) ON CONFLICT(id) DO NOTHING;
 RETURN actor;
END $$;
CREATE FUNCTION public.foundation_command_result(_command text,_request_id uuid,_payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE receipt public.command_receipts%ROWTYPE;
BEGIN
 IF _request_id IS NULL THEN RAISE EXCEPTION 'A request ID is required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||_command||':'||_request_id::text,0));
 SELECT * INTO receipt FROM public.command_receipts WHERE actor_id=auth.uid() AND command=_command AND request_id=_request_id;
 IF FOUND THEN
  IF receipt.payload IS DISTINCT FROM _payload THEN RAISE EXCEPTION 'This request ID was already used for a different operation' USING ERRCODE='22023'; END IF;
  RETURN receipt.result_id;
 END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION public.list_my_organizations() RETURNS TABLE(id uuid,name text,slug text,role text,capabilities text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT o.id,o.name,o.slug,m.role,
  ARRAY(SELECT c.key FROM public.capabilities c WHERE public.foundation_has_capability(o.id,c.key) ORDER BY c.key)
 FROM public.organizations o JOIN public.organization_memberships m ON m.organization_id=o.id
 WHERE m.user_id=auth.uid() AND m.status='active' AND o.archived_at IS NULL ORDER BY o.created_at,o.id;
$$;
CREATE FUNCTION public.foundation_environment_info() RETURNS TABLE(environment text,target_ref text,schema_version text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT e.environment,e.target_ref,e.schema_version FROM public.foundation_environment e WHERE e.singleton;
$$;
CREATE FUNCTION public.create_organization(_name text,_slug text,_request_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid; result uuid; payload jsonb;
BEGIN
 actor:=public.foundation_require_actor();
 payload:=jsonb_build_object('name',trim(_name),'slug',lower(trim(_slug)));
 result:=public.foundation_command_result('create_organization',_request_id,payload);
 IF result IS NOT NULL THEN
  IF NOT public.foundation_has_capability(result,'organization.manage') THEN RAISE EXCEPTION 'Studio access denied' USING ERRCODE='42501'; END IF;
  RETURN result;
 END IF;
 INSERT INTO public.organizations(name,slug,created_by) VALUES(trim(_name),lower(trim(_slug)),actor) RETURNING id INTO result;
 INSERT INTO public.organization_memberships(organization_id,user_id,role) VALUES(result,actor,'owner');
 INSERT INTO public.command_receipts(actor_id,command,request_id,organization_id,payload,result_id) VALUES(actor,'create_organization',_request_id,result,payload,result);
 INSERT INTO public.audit_events(organization_id,actor_id,event_type,entity_id,request_id) VALUES(result,actor,'organization.created',result,_request_id);
 RETURN result;
END $$;
CREATE FUNCTION public.create_client_organization(_organization_id uuid,_name text,_request_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid; result uuid; payload jsonb;
BEGIN
 actor:=public.foundation_require_actor();
 IF NOT public.foundation_has_capability(_organization_id,'clients.manage') THEN RAISE EXCEPTION 'Client management access denied' USING ERRCODE='42501'; END IF;
 payload:=jsonb_build_object('organization_id',_organization_id,'name',trim(_name));
 result:=public.foundation_command_result('create_client_organization',_request_id,payload);
 IF result IS NOT NULL THEN RETURN result; END IF;
 INSERT INTO public.client_organizations(organization_id,name,created_by) VALUES(_organization_id,trim(_name),actor) RETURNING id INTO result;
 INSERT INTO public.command_receipts(actor_id,command,request_id,organization_id,payload,result_id) VALUES(actor,'create_client_organization',_request_id,_organization_id,payload,result);
 INSERT INTO public.audit_events(organization_id,actor_id,event_type,entity_id,request_id) VALUES(_organization_id,actor,'client.created',result,_request_id);
 RETURN result;
END $$;
CREATE FUNCTION public.create_internal_initiative(_organization_id uuid,_name text,_request_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid; result uuid; payload jsonb;
BEGIN
 actor:=public.foundation_require_actor();
 IF NOT public.foundation_has_capability(_organization_id,'initiatives.manage') THEN RAISE EXCEPTION 'Initiative management access denied' USING ERRCODE='42501'; END IF;
 payload:=jsonb_build_object('organization_id',_organization_id,'name',trim(_name));
 result:=public.foundation_command_result('create_internal_initiative',_request_id,payload);
 IF result IS NOT NULL THEN RETURN result; END IF;
 INSERT INTO public.internal_initiatives(organization_id,name,created_by) VALUES(_organization_id,trim(_name),actor) RETURNING id INTO result;
 INSERT INTO public.command_receipts(actor_id,command,request_id,organization_id,payload,result_id) VALUES(actor,'create_internal_initiative',_request_id,_organization_id,payload,result);
 INSERT INTO public.audit_events(organization_id,actor_id,event_type,entity_id,request_id) VALUES(_organization_id,actor,'initiative.created',result,_request_id);
 RETURN result;
END $$;
CREATE FUNCTION public.create_project(
 _organization_id uuid,_name text,_ownership text,_discipline_keys text[],_lifecycle text,
 _client_organization_id uuid DEFAULT NULL,_internal_initiative_id uuid DEFAULT NULL,_engagement_id uuid DEFAULT NULL,
 _description text DEFAULT NULL,_due_date date DEFAULT NULL,_request_id uuid DEFAULT gen_random_uuid()
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid; result uuid; context_id uuid; board_id uuid; payload jsonb; discipline_keys text[];
BEGIN
 actor:=public.foundation_require_actor();
 IF NOT public.foundation_has_capability(_organization_id,'projects.create') THEN RAISE EXCEPTION 'Project creation access denied' USING ERRCODE='42501'; END IF;
 IF _discipline_keys IS NULL OR cardinality(_discipline_keys)>6 OR EXISTS(
  SELECT 1 FROM unnest(_discipline_keys) requested(discipline_key) WHERE requested.discipline_key IS NULL
   OR NOT EXISTS(SELECT 1 FROM public.disciplines d WHERE d.key=requested.discipline_key)
 ) THEN RAISE EXCEPTION 'Choose valid project disciplines' USING ERRCODE='22023'; END IF;
 SELECT coalesce(array_agg(DISTINCT key ORDER BY key),ARRAY[]::text[]) INTO discipline_keys FROM unnest(_discipline_keys) key;
 IF _client_organization_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.client_organizations WHERE organization_id=_organization_id AND id=_client_organization_id AND archived_at IS NULL) THEN
  RAISE EXCEPTION 'Choose an active client business in this studio' USING ERRCODE='22023'; END IF;
 IF _internal_initiative_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.internal_initiatives WHERE organization_id=_organization_id AND id=_internal_initiative_id AND archived_at IS NULL) THEN
  RAISE EXCEPTION 'Choose an active initiative in this studio' USING ERRCODE='22023'; END IF;
 IF _engagement_id IS NOT NULL AND NOT public.foundation_has_capability(_organization_id,'commercials.manage') THEN
  RAISE EXCEPTION 'Commercial agreement access denied' USING ERRCODE='42501'; END IF;
 payload:=jsonb_build_object('organization_id',_organization_id,'name',trim(_name),'ownership',_ownership,'disciplines',discipline_keys,
  'lifecycle',_lifecycle,'client_organization_id',_client_organization_id,'internal_initiative_id',_internal_initiative_id,
  'engagement_id',_engagement_id,'description',nullif(trim(_description),''),'due_date',_due_date);
 result:=public.foundation_command_result('create_project',_request_id,payload);
 IF result IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=result AND public.foundation_can_read_context(p.organization_id,p.work_context_id)) THEN
   RAISE EXCEPTION 'Project access denied' USING ERRCODE='42501'; END IF;
  RETURN result;
 END IF;
 INSERT INTO public.work_contexts(organization_id,kind,created_by) VALUES(_organization_id,'project',actor) RETURNING id INTO context_id;
 INSERT INTO public.projects(organization_id,work_context_id,name,ownership,lifecycle,client_organization_id,internal_initiative_id,engagement_id,description,due_date,owner_id)
 VALUES(_organization_id,context_id,trim(_name),_ownership,_lifecycle,_client_organization_id,_internal_initiative_id,_engagement_id,nullif(trim(_description),''),_due_date,actor) RETURNING id INTO result;
 INSERT INTO public.work_context_memberships(organization_id,work_context_id,user_id,role) VALUES(_organization_id,context_id,actor,'owner');
 INSERT INTO public.project_disciplines(organization_id,project_id,discipline_key) SELECT _organization_id,result,key FROM unnest(discipline_keys) key;
 INSERT INTO public.boards(organization_id,work_context_id,name) VALUES(_organization_id,context_id,'Production') RETURNING id INTO board_id;
 INSERT INTO public.board_columns(organization_id,work_context_id,board_id,name,category,position)
 SELECT _organization_id,context_id,board_id,title,category,position FROM (VALUES
  ('Backlog','backlog',0),('To do','todo',1),('In progress','in_progress',2),('Review','review',3),('Done','done',4)
 ) columns(title,category,position);
 INSERT INTO public.command_receipts(actor_id,command,request_id,organization_id,payload,result_id) VALUES(actor,'create_project',_request_id,_organization_id,payload,result);
 INSERT INTO public.audit_events(organization_id,actor_id,event_type,entity_id,request_id) VALUES(_organization_id,actor,'project.created',result,_request_id);
 RETURN result;
END $$;

-- All application writes flow through reviewed commands. No profile metadata,
-- client contact, direct membership write or publication grant can elevate roles.
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY[
  'foundation_environment','profiles','organizations','organization_memberships','capabilities','organization_role_capabilities','organization_capability_grants',
  'client_organizations','client_contacts','client_access_grants','internal_initiatives','engagements','work_contexts','work_context_memberships','operational_contexts',
  'projects','disciplines','project_disciplines','boards','board_columns','tasks','task_assignees','milestones','assets','command_receipts','audit_events'
 ] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',table_name);
  IF table_name<>'foundation_environment' THEN EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',table_name); END IF;
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
GRANT SELECT ON public.profiles,public.organizations,public.organization_memberships,public.capabilities,public.organization_role_capabilities,public.organization_capability_grants,
 public.client_organizations,public.client_contacts,public.client_access_grants,public.internal_initiatives,public.engagements,
 public.work_contexts,public.work_context_memberships,public.operational_contexts,public.projects,public.disciplines,public.project_disciplines,
 public.boards,public.board_columns,public.tasks,public.task_assignees,public.milestones,public.assets,public.audit_events TO authenticated;
CREATE POLICY read_profile ON public.profiles FOR SELECT TO authenticated USING(public.foundation_can_read_profile(id));
CREATE POLICY read_organization ON public.organizations FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.organization_memberships m WHERE m.organization_id=id AND m.user_id=auth.uid() AND m.status='active'));
CREATE POLICY read_memberships ON public.organization_memberships FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.foundation_has_capability(organization_id,'memberships.manage'));
CREATE POLICY read_capabilities ON public.capabilities FOR SELECT TO authenticated USING(true);
CREATE POLICY read_role_capabilities ON public.organization_role_capabilities FOR SELECT TO authenticated USING(true);
CREATE POLICY read_grants ON public.organization_capability_grants FOR SELECT TO authenticated USING((user_id=auth.uid() AND public.foundation_is_internal(organization_id)) OR public.foundation_has_capability(organization_id,'organization.manage'));
CREATE POLICY read_clients ON public.client_organizations FOR SELECT TO authenticated USING(public.foundation_can_read_client(organization_id,id));
CREATE POLICY read_contacts ON public.client_contacts FOR SELECT TO authenticated USING(public.foundation_can_read_client(organization_id,client_organization_id));
CREATE POLICY read_client_grants ON public.client_access_grants FOR SELECT TO authenticated USING(public.foundation_has_capability(organization_id,'clients.manage'));
CREATE POLICY read_initiatives ON public.internal_initiatives FOR SELECT TO authenticated USING(public.foundation_can_read_initiative(organization_id,id));
CREATE POLICY read_engagements ON public.engagements FOR SELECT TO authenticated USING(public.foundation_has_capability(organization_id,'commercials.manage'));
CREATE POLICY read_contexts ON public.work_contexts FOR SELECT TO authenticated USING(public.foundation_can_read_context(organization_id,id));
CREATE POLICY read_context_memberships ON public.work_context_memberships FOR SELECT TO authenticated USING(public.foundation_can_read_context(organization_id,work_context_id));
CREATE POLICY read_operational_contexts ON public.operational_contexts FOR SELECT TO authenticated USING(public.foundation_can_read_context(organization_id,work_context_id));
CREATE POLICY read_projects ON public.projects FOR SELECT TO authenticated USING(public.foundation_can_read_context(organization_id,work_context_id));
CREATE POLICY read_disciplines ON public.disciplines FOR SELECT TO authenticated USING(true);
CREATE POLICY read_project_disciplines ON public.project_disciplines FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.projects p WHERE p.organization_id=project_disciplines.organization_id AND p.id=project_disciplines.project_id));
CREATE POLICY read_boards ON public.boards FOR SELECT TO authenticated USING(public.foundation_can_read_context(organization_id,work_context_id));
CREATE POLICY read_columns ON public.board_columns FOR SELECT TO authenticated USING(public.foundation_can_read_context(organization_id,work_context_id));
CREATE POLICY read_tasks ON public.tasks FOR SELECT TO authenticated USING(public.foundation_can_read_context(organization_id,work_context_id));
CREATE POLICY read_assignees ON public.task_assignees FOR SELECT TO authenticated USING(public.foundation_can_read_context(organization_id,work_context_id));
CREATE POLICY read_milestones ON public.milestones FOR SELECT TO authenticated USING(public.foundation_can_read_context(organization_id,work_context_id));
CREATE POLICY read_assets ON public.assets FOR SELECT TO authenticated USING(public.foundation_can_read_context(organization_id,work_context_id));
CREATE POLICY read_audit ON public.audit_events FOR SELECT TO authenticated USING(public.foundation_has_capability(organization_id,'organization.manage'));

-- Real Storage object policies require an authorized metadata row and exact key.
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('ordo-private-assets','ordo-private-assets',false,104857600);
CREATE POLICY foundation_private_asset_read ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='ordo-private-assets' AND EXISTS(SELECT 1 FROM public.assets a WHERE a.bucket_id=storage.objects.bucket_id AND a.storage_path=storage.objects.name
  AND (a.state='available' OR (a.state='staged' AND a.uploaded_by=auth.uid())) AND public.foundation_can_read_context(a.organization_id,a.work_context_id)));
-- Upload/finalize/delete commands ship with the staged-upload workflow. Foundation
-- does not expose incomplete client or internal asset write controls.

DO $$ DECLARE fn regprocedure; BEGIN
 FOR fn IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
  AND (p.proname LIKE 'foundation_%' OR p.proname IN ('list_my_organizations','create_organization','create_client_organization','create_internal_initiative','create_project')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.foundation_is_internal(uuid),public.foundation_has_capability(uuid,text),public.foundation_can_read_context(uuid,uuid),
 public.foundation_can_write_context(uuid,uuid),public.foundation_can_read_client(uuid,uuid),public.foundation_can_read_initiative(uuid,uuid),public.foundation_can_read_profile(uuid),
 public.list_my_organizations(),public.create_organization(text,text,uuid),public.create_client_organization(uuid,text,uuid),public.create_internal_initiative(uuid,text,uuid),
 public.create_project(uuid,text,text,text[],text,uuid,uuid,uuid,text,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.foundation_environment_info() TO anon,authenticated;

COMMIT;
