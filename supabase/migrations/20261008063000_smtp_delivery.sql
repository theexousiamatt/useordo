-- SMTP delivery is deduplicated and rate-limited under server-only access.
CREATE TABLE public.smtp_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text NOT NULL UNIQUE,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 recipient_email text NOT NULL,
 template_name text NOT NULL,
 status text NOT NULL DEFAULT 'sending' CHECK(status IN ('sending','sent','failed','uncertain')),
 attempts integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.smtp_deliveries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.smtp_deliveries TO service_role;
CREATE INDEX smtp_deliveries_workspace_created ON public.smtp_deliveries(workspace_id,created_at);
CREATE OR REPLACE FUNCTION public.claim_smtp_delivery(
 _event_key text,_workspace_id uuid,_actor_id uuid,_recipient text,_template text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE existing public.smtp_deliveries%ROWTYPE; delivery_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(_workspace_id::text,0));
 SELECT * INTO existing FROM public.smtp_deliveries WHERE event_key=_event_key FOR UPDATE;
 IF FOUND THEN
   IF existing.status='sent' THEN RETURN jsonb_build_object('state','sent'); END IF;
   IF existing.status<>'failed' OR existing.updated_at>now()-interval '1 minute' OR existing.attempts>=3 THEN
     RETURN jsonb_build_object('state','busy');
   END IF;
 ELSE
   IF (SELECT count(*) FROM public.smtp_deliveries WHERE workspace_id=_workspace_id AND created_at>now()-interval '1 hour')>=50 THEN
     RETURN jsonb_build_object('state','limited');
   END IF;
 END IF;
 INSERT INTO public.smtp_deliveries(event_key,workspace_id,actor_id,recipient_email,template_name)
 VALUES(_event_key,_workspace_id,_actor_id,_recipient,_template)
 ON CONFLICT(event_key) DO UPDATE SET status='sending',attempts=smtp_deliveries.attempts+1,updated_at=now()
 RETURNING id INTO delivery_id;
 RETURN jsonb_build_object('state','claimed','id',delivery_id);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_smtp_delivery(text,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_smtp_delivery(text,uuid,uuid,text,text) TO service_role;
