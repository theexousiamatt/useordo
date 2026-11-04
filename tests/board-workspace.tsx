// Development-only project workspace. Supabase calls are stubbed in memory:
// no account, email, task or project is changed in the real backend.
import React, { useState } from 'react';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { Toaster } from '../src/components/ui/sonner';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '../src/integrations/supabase/client';
import { AuthProvider } from '../src/hooks/useAuth';
import { WorkspaceProvider } from '../src/hooks/useWorkspace';
import { SidebarCollapseProvider } from '../src/components/sidebar-collapse';
import ProjectDetail from '../src/pages/ProjectDetail';
import '../src/index.css';

const params = new URLSearchParams(location.search);
const width = Number(params.get('width'));
let failNextSave = false;
let failNextMove = false;
let delay = 0;
const storageKey = 'ordo-board-fixture-v2';
const owner = { id:'owner', email:'owner@example.invalid' };
const now = '2026-10-25T00:00:00.000Z';
const project = { id:'ivy', workspace_id:'agency', name:'Ivy Website', description:'Create a clear, welcoming website for Ivy.', status:'active', health:'on_track', progress:0, owner_id:'owner', archived_at:params.has('readonly')?now:null, due_date:'2026-11-12' };
const members = [
  {project_id:'ivy',workspace_id:'agency',status:'active',user_id:'owner',role:'owner'}, {project_id:'ivy',workspace_id:'agency',status:'active',user_id:'alex',role:'member'}, {project_id:'ivy',workspace_id:'agency',status:'active',user_id:'mia',role:'member'}
];
const profiles = [
  {id:'owner',full_name:'Matthew Oluwajuwonlo',avatar_url:null,email:'owner@example.invalid'},
  {id:'alex',full_name:'Alex Turner',avatar_url:null,email:'alex@example.invalid'},
  {id:'mia',full_name:'Mia Johnson',avatar_url:null,email:'mia@example.invalid'},
];
const labels = [
  {id:'branding',project_id:'ivy',name:'Branding',color:'blue',position:0},
  {id:'urgent',project_id:'ivy',name:'Urgent',color:'red',position:1},
];
let taskLabels = [{project_id:'ivy',workspace_id:'agency',task_id:'t1',label_id:'branding'},{project_id:'ivy',workspace_id:'agency',task_id:'t4',label_id:'urgent'}];
let assignees = [{project_id:'ivy',workspace_id:'agency',task_id:'t1',user_id:'alex'},{project_id:'ivy',workspace_id:'agency',task_id:'t2',user_id:'mia'},{project_id:'ivy',workspace_id:'agency',task_id:'t3',user_id:'owner'}];
let tasks:any[] = [
  {id:'t1',workspace_id:'agency',project_id:'ivy',title:'Gather website content and page structure',description:'Map the pages Ivy needs before the first design review.',status:'todo',position:0,assignee_id:'alex',due_date:'2026-10-28',archived_at:null,created_at:now,updated_at:now},
  {id:'t2',workspace_id:'agency',project_id:'ivy',title:'Create responsive homepage layouts',description:null,status:'in_progress',position:0,assignee_id:'mia',due_date:'2026-11-02',archived_at:null,created_at:now,updated_at:now},
  {id:'t3',workspace_id:'agency',project_id:'ivy',title:'Review accessibility and content hierarchy',description:'Check keyboard flow, contrast and headings.',status:'review',position:0,assignee_id:'owner',due_date:'2026-11-05',archived_at:null,created_at:now,updated_at:now},
  {id:'t4',workspace_id:'agency',project_id:'ivy',title:'Confirm the visual direction with Ivy',description:null,status:'backlog',position:0,assignee_id:null,due_date:null,archived_at:null,created_at:now,updated_at:now},
  {id:'t5',workspace_id:'agency',project_id:'ivy',title:'Document key design decisions',description:null,status:'done',position:0,assignee_id:null,due_date:'2026-10-20',archived_at:null,created_at:now,updated_at:now},
];
const initialTasks = structuredClone(tasks);
let comments:any[] = [];
try { const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); if(saved) { tasks=saved.tasks; taskLabels=saved.taskLabels; assignees=saved.assignees; comments=saved.comments||[]; } } catch { /* fixture can run without storage */ }
if(params.get('state')==='empty')tasks=[];
if(params.get('state')==='long')tasks=Array.from({length:70},(_,i)=>({...initialTasks[i%5],id:'long-'+i,position:Math.floor(i/5),title:i%7===0?'A very long client request that includes accessibility, responsive content, stakeholder feedback, and the final production handoff checklist for every page of the website':initialTasks[i%5].title}));
if(params.get('state')==='loading')delay=10000;
const persist=()=>{try {sessionStorage.setItem(storageKey,JSON.stringify({tasks,taskLabels,assignees,comments}));} catch {}}
const wait=()=>new Promise(resolve=>setTimeout(resolve,delay));
Object.assign(supabase.auth, {
  getSession:async()=>({data:{session:{user:owner,access_token:'fixture-not-a-real-token'}},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
});
Object.defineProperty(supabase,'functions',{value:{invoke:async(name:string)=>({data:name==='list-workspaces'?{workspaces:[{id:'agency',name:'Inspirare Studio',slug:'inspirare',type:'agency',owner_id:'owner',role:'owner'}]}:{},error:null})}});
const tableRows = (name:string) => name==='projects'?[project]:name==='project_members'?members:name==='workspace_members'?members:name==='profiles'?profiles:name==='tasks'?tasks:name==='project_labels'?labels:name==='task_labels'?taskLabels:name==='task_assignees'?assignees:name==='task_comments'?comments:[];
Object.assign(supabase,{
  rpc:async(name:string,args:any)=>{
    await wait();
    if(name==='reorder_project_tasks') {
      if(failNextMove){failNextMove=false;return {data:null,error:{message:'Preview: simulated move failure',code:'fixture'}};}
      for(const update of args._updates){const row=tasks.find(task=>task.id===update.id);if(row)Object.assign(row,{status:update.status,position:update.position,updated_at:new Date().toISOString()});}
    }
    persist();
    return {data:null,error:null};
  },
  from:(name:string)=>{
    let rows = tableRows(name).slice();
    let patch:any = null;
    let pendingInsert:any = null;
    let wantsSingle=false;
    const chain:any={
      select:()=>chain,
      eq:(field:string,value:any)=>{rows=rows.filter(row=>row[field]===value);return chain},
      is:(field:string,value:any)=>{rows=rows.filter(row=>row[field]===value);return chain},
      in:(field:string,values:any[])=>{rows=rows.filter(row=>values.includes(row[field]));return chain},
      order:(field:string,options?:any)=>{rows.sort((a,b)=>options?.ascending===false?String(b[field]).localeCompare(String(a[field])):String(a[field]).localeCompare(String(b[field])));return chain},
      limit:(count:number)=>{rows=rows.slice(0,count);return chain},
      maybeSingle:()=>{wantsSingle=true;return chain},
      single:()=>{wantsSingle=true;return chain},
      insert:(input:any)=>{pendingInsert=input;return chain},
      update:(input:any)=>{patch=input;return chain},
      delete:()=>{patch={__deleted:true};return chain},
      then:async(resolve:any)=>{
        await wait();
        if(name==='tasks' && !pendingInsert && !patch && params.get('state')==='error')return resolve({data:null,error:{message:'Preview: simulated loading failure'}});
        if((pendingInsert||patch)&&failNextSave){failNextSave=false;return resolve({data:null,error:{message:'Preview: simulated save failure'}});}
        if(pendingInsert&&name==='tasks'){const input=Array.isArray(pendingInsert)?pendingInsert:[pendingInsert];for(const item of input)tasks.push({id:'t'+(tasks.length+1),description:null,assignee_id:null,due_date:null,archived_at:null,created_at:now,updated_at:new Date().toISOString(),...item});rows=tasks.slice(-input.length);}
        if(pendingInsert&&name!=='tasks'){const input=(Array.isArray(pendingInsert)?pendingInsert:[pendingInsert]).map(item=>({id:crypto.randomUUID(),created_at:new Date().toISOString(),...item}));tableRows(name).push(...input);rows=input;}
        if(patch&&name==='tasks'){for(const row of rows){if(patch.__deleted)tasks=tasks.filter(task=>task.id!==row.id);else Object.assign(row,patch,{updated_at:new Date().toISOString()});}}
        if(patch&&name!=='tasks'){for(const row of rows){if(!patch.__deleted)Object.assign(row,patch);else {const all=tableRows(name);all.splice(all.indexOf(row),1);}}}
        persist();
        return resolve({data:wantsSingle?rows[0]??null:structuredClone(rows),error:null});
      }
    };
    return chain;
  },
  channel:()=>{const channel:any={on:()=>channel,subscribe:()=>channel};return channel},
  removeChannel:async()=>{},
});
const previewClient = new QueryClient({defaultOptions:{queries:{retry:false}}});
function PreviewHistory(){const navigate=useNavigate();return <div className="mb-3 flex gap-3 text-xs text-muted-foreground"><button onClick={()=>navigate(-1)}>Back in preview</button><button onClick={()=>navigate(1)}>Forward in preview</button></div>}
function Preview(){
  const [notice,setNotice]=useState('');
  return <div className="client-os min-h-screen bg-background p-4 sm:p-8">
    <details className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><summary>Local preview · sample tasks saved in this tab only</summary>
      <div className="mt-3 flex flex-wrap gap-3">
        <button onClick={()=>{failNextSave=true;setNotice('Next save will fail once.');}}>Fail next save</button>
        <button onClick={()=>{failNextMove=true;setNotice('Next move will fail once.');}}>Fail next move</button>
        <button onClick={()=>{delay=delay?0:1600;setNotice(delay?'Slow requests enabled.':'Normal requests.');}}>Toggle slow requests</button>
        <a href={params.has('readonly')?'?':'?readonly=1'}>{params.has('readonly')?'Editable view':'Read-only view'}</a>
        <a href="?width=390">Mobile view</a><a href="?state=empty">Empty board</a><a href="?state=long">70-task board</a><a href="?state=error">Load error</a>
        <button onClick={()=>{tasks=structuredClone(initialTasks);persist();location.reload();}}>Reset sample tasks</button>
      </div><p role="status" className="mt-2">{notice}</p>
    </details>
    <TooltipProvider><QueryClientProvider client={previewClient}><MemoryRouter initialEntries={['/projects/ivy']}><AuthProvider><WorkspaceProvider><SidebarCollapseProvider>
      <PreviewHistory/><Routes><Route path="/projects/:id" element={<ProjectDetail/>}/></Routes>
    <Toaster/></SidebarCollapseProvider></WorkspaceProvider></AuthProvider></MemoryRouter></QueryClientProvider></TooltipProvider>
  </div>;
}
if(width>0&&window.top===window.self){
  const source=new URL(location.href);source.searchParams.delete('width');
  createRoot(document.getElementById('root')!).render(<iframe title="Mobile board preview" src={source.toString()} style={{display:'block',border:0,width:Math.min(width,innerWidth),height:'100vh',margin:'auto'}}/>);
}else createRoot(document.getElementById('root')!).render(<Preview/>);
