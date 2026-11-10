SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE org uuid:='20000000-0000-4000-8000-000000000001'; p uuid; b uuid; c uuid; t uuid; vals jsonb; req uuid:=gen_random_uuid(); BEGIN
 SELECT id INTO p FROM public.projects WHERE organization_id=org ORDER BY id LIMIT 1;
 PERFORM foundation_test.assert((SELECT count(*) FROM public.list_production_assignees(org,p))>0,'eligible team lookup executes and includes contributors');
 b:=public.save_production_item(org,p,'board',NULL,NULL,'{"name":"MVP board"}',gen_random_uuid());
 SELECT id INTO c FROM public.board_columns WHERE board_id=b;
 vals:=jsonb_build_object('title','Canonical assignment','description','Draft copy','priority','high','due_date','2026-12-01','column_id',c,'assignees',jsonb_build_array(auth.uid()));
 t:=public.save_production_item(org,p,'task',NULL,NULL,vals,req);
 PERFORM foundation_test.assert(t=public.save_production_item(org,p,'task',NULL,NULL,vals,req),'retry returns same task');
 PERFORM foundation_test.assert((SELECT count(*) FROM public.tasks WHERE board_id=b)=1,'retry does not duplicate');
 PERFORM foundation_test.assert((SELECT count(*) FROM public.task_assignees WHERE task_id=t)=1,'assignment saved');
 PERFORM public.save_production_item(org,p,'task',t,0,vals||'{"title":"Edited"}',gen_random_uuid());
 PERFORM foundation_test.expect_error(format('SELECT public.save_production_item(%L,%L,''task'',%L,0,%L,gen_random_uuid())',org,p,t,vals),'40001','stale task cannot overwrite');
 PERFORM foundation_test.expect_error(format('SELECT public.save_production_item(%L,%L,''task'',NULL,NULL,%L,gen_random_uuid())',org,p,vals||'{"assignees":["10000000-0000-4000-8000-000000000002"]}'),'42501','cross-studio assignee denied');
 PERFORM foundation_test.assert((SELECT count(*) FROM public.tasks WHERE board_id=b)=1,'failed assignment rolls back task');
 PERFORM public.save_production_item(org,p,'column',c,0,jsonb_build_object('name','Production','category','todo','board_id',b),gen_random_uuid());
 PERFORM foundation_test.expect_error(format('SELECT public.save_production_item(%L,%L,''column'',%L,1,%L,gen_random_uuid())',org,p,c,jsonb_build_object('name','Done','category','done','board_id',b)),'22023','populated category change cannot invalidate task FK');
 PERFORM foundation_test.assert((SELECT title FROM public.tasks WHERE id=t)='Edited','failed stale write retains changes');
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT foundation_test.expect_error($q$SELECT public.save_production_item('20000000-0000-4000-8000-000000000001',(SELECT id FROM public.projects WHERE organization_id='20000000-0000-4000-8000-000000000002' LIMIT 1),'board',NULL,NULL,'{"name":"Forbidden"}',gen_random_uuid())$q$,'42501','wrong organization/project denied');

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE p uuid; t uuid; vals jsonb; BEGIN
 SELECT id INTO p FROM public.projects WHERE work_context_id='40000000-0000-4000-8000-000000000002';
 vals:='{"title":"Two assignees","description":"Preserved description","priority":"urgent","due_date":"2026-12-01","column_id":"61000000-0000-4000-8000-000000000002","assignees":["10000000-0000-4000-8000-000000000001","10000000-0000-4000-8000-000000000005"]}';
 t:=public.save_production_item('20000000-0000-4000-8000-000000000001',p,'task',NULL,NULL,vals,gen_random_uuid());
 PERFORM foundation_test.assert((SELECT count(*) FROM public.task_assignees WHERE task_id=t)=2,'multiple eligible assignments persist');
 PERFORM foundation_test.assert((SELECT description='Preserved description' AND priority='urgent' AND due_date='2026-12-01' FROM public.tasks WHERE id=t),'task production details persist');
 PERFORM foundation_test.expect_error(format('SELECT public.save_production_item(%L,%L,''task'',NULL,NULL,%L,gen_random_uuid())','20000000-0000-4000-8000-000000000001',p,vals||'{"assignees":["10000000-0000-4000-8000-000000000007"]}'),'42501','client cannot be assigned internal work');
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
DO $$ DECLARE p uuid; BEGIN
 SELECT id INTO p FROM public.projects WHERE work_context_id='40000000-0000-4000-8000-000000000002';
 PERFORM foundation_test.expect_error(format('SELECT public.save_production_item(%L,%L,''board'',NULL,NULL,''{"name":"Denied configuration"}'',gen_random_uuid())','20000000-0000-4000-8000-000000000001',p),'42501','contributor cannot configure boards');
 PERFORM public.save_production_item('20000000-0000-4000-8000-000000000001',p,'task',NULL,NULL,'{"title":"Contributor work","priority":"normal","column_id":"61000000-0000-4000-8000-000000000002","assignees":[]}',gen_random_uuid());
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',true);
SELECT foundation_test.expect_error($q$SELECT public.save_production_item('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','task',NULL,NULL,'{"title":"Denied"}',gen_random_uuid())$q$,'42501','client write denied');
RESET ROLE;

SELECT 'production create/edit/retry/revisions/assignees/rollback checks passed' AS verification;
