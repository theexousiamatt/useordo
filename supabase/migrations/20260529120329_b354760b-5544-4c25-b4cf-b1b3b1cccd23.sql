ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'deliverable_created';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'deliverable_status_changed';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'client_access_granted';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'client_access_revoked';