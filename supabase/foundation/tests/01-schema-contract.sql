SELECT foundation_test.assert(NOT EXISTS(
 SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity
),'every canonical application/catalog table enables RLS');
SELECT foundation_test.assert(NOT EXISTS(
 SELECT 1 FROM pg_tables WHERE schemaname='public' AND (
  has_table_privilege('authenticated',schemaname||'.'||tablename,'INSERT') OR
  has_table_privilege('authenticated',schemaname||'.'||tablename,'UPDATE') OR
  has_table_privilege('authenticated',schemaname||'.'||tablename,'DELETE'))
),'authenticated roles have no direct application write grants');
SELECT foundation_test.assert(NOT has_function_privilege('anon','public.create_organization(text,text,uuid)','EXECUTE'),'anonymous organization command denied');
SELECT foundation_test.assert(NOT has_function_privilege('anon','public.list_my_organizations()','EXECUTE'),'anonymous membership enumeration denied');
SELECT foundation_test.assert(NOT has_function_privilege('authenticated','public.foundation_command_result(text,uuid,jsonb)','EXECUTE'),'idempotency helper cannot be called directly');
SELECT foundation_test.assert(NOT has_function_privilege('authenticated','public.foundation_require_actor()','EXECUTE'),'actor helper cannot be called directly');
SELECT foundation_test.assert((SELECT count(*) FROM public.disciplines)=6,'six canonical discipline families');
SELECT foundation_test.assert((SELECT profile_id IS NULL FROM public.client_contacts WHERE id='32000000-0000-4000-8000-000000000001'),'a client contact exists without a login');
SELECT foundation_test.assert((SELECT public=false AND file_size_limit=104857600 FROM storage.buckets WHERE id='ordo-private-assets'),'private bounded asset bucket');
SELECT foundation_test.assert(NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='milestones' AND column_name='completed'),'milestone has one authoritative status');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT foundation_test.assert((SELECT environment='development' AND target_ref='local' AND schema_version='ordo-foundation-v1' FROM public.foundation_environment_info()),'public metadata reports only the configured environment identity');
SELECT foundation_test.expect_error('SELECT * FROM public.foundation_environment','42501','marker direct read denied');
SELECT foundation_test.expect_error('SELECT * FROM public.projects','42501','anonymous project read denied');
SELECT foundation_test.expect_error($q$SELECT public.create_organization('Bad','bad','a0000000-0000-4000-8000-000000000001')$q$,'42501','anonymous command denied by ACL');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT foundation_test.assert((SELECT count(*) FROM public.list_my_organizations())=0,'null caller lists no memberships');
SELECT foundation_test.assert(NOT public.foundation_can_read_context('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001'),'null caller cannot read production');
SELECT foundation_test.expect_error($q$SELECT public.create_organization('Bad','bad','a0000000-0000-4000-8000-000000000002')$q$,'42501','null caller rejected in command');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000010',true);
SELECT foundation_test.expect_error($q$SELECT public.create_organization('Unverified','unverified','a0000000-0000-4000-8000-000000000003')$q$,'42501','unverified account cannot create studio');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT foundation_test.expect_error($q$UPDATE public.organization_memberships SET role='owner'$q$,'42501','even owner direct membership writes denied');
SELECT foundation_test.expect_error($q$INSERT INTO public.organization_capability_grants(organization_id,user_id,capability_key,granted_by) VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','production.read_all','10000000-0000-4000-8000-000000000001')$q$,'42501','direct capability escalation denied');
RESET ROLE;
SELECT 'schema, role ACL, null caller and public identity checks passed' AS verification;
