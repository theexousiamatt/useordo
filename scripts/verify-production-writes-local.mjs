/** Real two-connection command races. Explicit loopback runtime + marker, never remote. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
const runtimeRoot=resolve(process.argv[2] ?? '.');
const {withLocalDatabase,assertDatabaseMarker}=await import(pathToFileURL(resolve(runtimeRoot,'scripts/foundation-runtime.mjs')));
const actor=JSON.parse(readFileSync(resolve(runtimeRoot,'.foundation-runtime/accounts.json'),'utf8')).owner.id;
function check(value,message){if(!value)throw Error(message);}
let org,project,board;
async function signed(fn){return withLocalDatabase(async db=>{await assertDatabaseMarker(db);await db.query('BEGIN');try{await db.query('SET LOCAL ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor]);const result=await fn(db);await db.query('COMMIT');return result;}catch(error){await db.query('ROLLBACK');throw error;}});}
async function save(db,kind,id,revision,values,request=randomUUID()) {const result=await db.query('SELECT public.save_production_item($1,$2,$3,$4,$5,$6,$7) AS id',[org,project,kind,id,revision,values,request]);return result.rows[0].id;}
try {
 await signed(async db=>{org=(await db.query("SELECT organization_id FROM public.organization_memberships WHERE user_id=$1 AND role='owner' AND status='active' ORDER BY organization_id LIMIT 1",[actor])).rows[0].organization_id;project=(await db.query('SELECT id FROM public.projects WHERE organization_id=$1 ORDER BY id LIMIT 1',[org])).rows[0].id;board=await save(db,'board',null,null,{name:'Isolated concurrency verification '+randomUUID()});});
 const column=await signed(async db=>(await db.query('SELECT id FROM public.board_columns WHERE board_id=$1',[board])).rows[0].id);
 const values={title:'Concurrent retry',description:'Synthetic local verification',priority:'normal',due_date:'2026-12-01',column_id:column,assignees:[actor]};
 const request=randomUUID();const ids=await Promise.all([signed(db=>save(db,'task',null,null,values,request)),signed(db=>save(db,'task',null,null,values,request))]);check(ids[0]===ids[1],'Concurrent retry duplicated task');
 const updates=await Promise.allSettled([signed(db=>save(db,'task',ids[0],0,{...values,title:'Writer A'})),signed(db=>save(db,'task',ids[0],0,{...values,title:'Writer B'}))]);
 check(updates.filter(r=>r.status==='fulfilled').length===1,'Both stale writers succeeded');check(updates.some(r=>r.status==='rejected' && r.reason.code==='40001'),'Stale writer did not receive conflict');
 await Promise.all([signed(db=>save(db,'column',null,null,{name:'Column A',category:'review',board_id:board})),signed(db=>save(db,'column',null,null,{name:'Column B',category:'done',board_id:board}))]);
 await signed(async db=>{const result=await db.query('SELECT count(*)::int AS n,count(DISTINCT position)::int AS positions FROM public.board_columns WHERE board_id=$1',[board]);check(result.rows[0].n===3 && result.rows[0].positions===3,'Concurrent column append order collided');check((await db.query('SELECT count(*)::int AS n FROM public.tasks WHERE board_id=$1',[board])).rows[0].n===1,'Task record duplicated');});
 const destination=await signed(async db=>(await db.query('SELECT id FROM public.board_columns WHERE board_id=$1 AND id<>$2 ORDER BY position LIMIT 1',[board,column])).rows[0].id);
 async function move(db,revision,target,request){const result=await db.query("SELECT public.change_production_item($1,$2,'move_task',$3,$4,$5,NULL,$6) AS id",[org,project,ids[0],revision,target,request]);return result.rows[0].id;}
 const moveRequest=randomUUID();const moved=await Promise.all([signed(db=>move(db,1,destination,moveRequest)),signed(db=>move(db,1,destination,moveRequest))]);check(moved[0]===moved[1],'Concurrent move retry duplicated identity');
 const competing=await Promise.allSettled([signed(db=>move(db,2,column,randomUUID())),signed(db=>move(db,2,destination,randomUUID()))]);check(competing.filter(r=>r.status==='fulfilled').length===1 && competing.some(r=>r.status==='rejected' && r.reason.code==='40001'),'Competing movement overwrote a newer revision');
 await signed(async db=>{check((await db.query('SELECT count(*)::int AS n FROM public.tasks WHERE board_id=$1',[board])).rows[0].n===1,'Movement duplicated task');check((await db.query('SELECT count(*)::int AS n FROM public.task_assignees WHERE task_id=$1',[ids[0]])).rows[0].n===1,'Movement lost assignments');});
 console.log('PASS real concurrent create/edit/move retries, stale-edit/move conflicts, ordered column append, retained assignments and single task identity.');
} finally {
 if(board)await withLocalDatabase(async db=>{await assertDatabaseMarker(db);await db.query('BEGIN');try{await db.query('DELETE FROM public.task_assignees WHERE task_id IN(SELECT id FROM public.tasks WHERE board_id=$1)',[board]);await db.query('DELETE FROM public.tasks WHERE board_id=$1',[board]);await db.query('DELETE FROM public.board_columns WHERE board_id=$1',[board]);await db.query('DELETE FROM public.boards WHERE id=$1',[board]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}});
}
