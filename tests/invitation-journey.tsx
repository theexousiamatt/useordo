// Development-only scenarios. All auth/invitation requests are stubbed; no email
// is sent and no membership is changed. The production entrypoint excludes this.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '../src/integrations/supabase/client';
import { AuthProvider } from '../src/hooks/useAuth';
import { WorkspaceProvider } from '../src/hooks/useWorkspace';
import ClientProjectDetail from '../src/pages/ClientProjectDetail';
import { SidebarCollapseProvider } from '../src/components/sidebar-collapse';
import WorkspaceInvite from '../src/pages/auth/WorkspaceInvite';
import { InviteMemberDrawer } from '../src/components/team/InviteMemberDrawer';
import '../src/index.css';
const params=new URLSearchParams(location.search);
const scenario=params.get('state')??'project';
const width=Number(params.get('width'));
const user=scenario==='wrong' ? {id:'fixture',email:'another@example.com'} : (scenario==='accepted'||scenario==='detail') ? {id:'fixture',email:'client@example.com'} : null;
const fakeSession=user ? {user,access_token:'fixture-not-a-real-token'} : null;
const fixture={valid:scenario!=='expired',status:scenario==='expired'?'expired':scenario==='accepted'?'accepted':'pending',email:'client@example.com',role:'client',workspaceId:'agency',workspaceName:'Inspirare Studio',inviterName:'Matthew',projectId:scenario==='workspace'?null:'ivy',projectName:scenario==='workspace'?null:'Ivy Website'};
Object.assign(supabase.auth,{
 getSession:async()=>({data:{session:fakeSession},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
 signInWithOtp:async()=>({data:{},error:null}),
 signOut:async()=>({error:null}),
});
Object.defineProperty(supabase,'functions',{value:{invoke:async(name:string,options:any)=>({data:name==='list-workspaces'?{workspaces:[{id:'agency',name:'Inspirare Studio',slug:'inspirare',type:'agency',owner_id:'owner',role:'client'}]} : options?.body?.action ? {requested:true} : options?.body?.accept ? {workspaceId:'agency',destination:'/client/projects/ivy'}:{invite:fixture},error:null})}});
Object.assign(supabase, {rpc:async()=>({data:'fixture',error:null}),from:(table:string)=>{
 let single=false;
 const rows=table==='projects'?[{id:'ivy',name:'Ivy Website',description:'A new digital home for Ivy. Review the shared work, browse project files, and keep track of progress.',progress:65,due_date:'2026-11-12'}]:table==='milestones'?[{id:'m1',project_id:'ivy',title:'Visual direction approved',completed:true,due_date:'2026-10-22'},{id:'m2',project_id:'ivy',title:'Website design review',completed:false,due_date:'2026-11-02'}]:table==='deliverables'?[{id:'d1',project_id:'ivy',title:'Homepage design',status:'submitted',requires_approval:true}]:table==='files'?[{id:'f1',name:'Ivy — visual direction.pdf',storage_path:'fixture',size_bytes:1450000,created_at:'2026-10-24'}]:[];
 const chain:any={select:()=>chain,eq:()=>chain,is:()=>chain,in:()=>chain,order:()=>chain,limit:()=>chain,maybeSingle:()=>{single=true;return chain},then:(resolve:any)=>Promise.resolve({data:single?rows[0]:rows,error:null}).then(resolve)};return chain;
}, channel:()=>{const channel:any={on:()=>channel,subscribe:()=>channel};return channel},removeChannel:async()=>{}});
function Preview(){return <div style={{width:width>0?Math.min(width,innerWidth):'100%',margin:'auto'}}>
 <p className="bg-secondary px-4 py-2 text-center text-xs text-muted-foreground">Development preview · {scenario} · no emails sent</p>
 <QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[scenario==='detail'?'/client/projects/ivy':'/auth/invite?token=fixture']}><AuthProvider><WorkspaceProvider><Routes>
  <Route path="/auth/invite" element={scenario==='drawer'?<InviteMemberDrawer open initialRole="client" workspaceName="Inspirare Studio" projects={[{id:'ivy',name:'Ivy Website'},{id:'brand',name:'Brand identity'}]} onOpenChange={()=>{}} onInvite={async()=>false}/>:<WorkspaceInvite/>}/>
  <Route path="/client/projects/:id" element={<SidebarCollapseProvider><div className="client-os min-h-screen space-y-6 bg-background p-4 sm:p-8"><ClientProjectDetail/></div></SidebarCollapseProvider>}/>
 </Routes></WorkspaceProvider></AuthProvider></MemoryRouter></QueryClientProvider>
 </div>}
if(width>0 && window.top===window.self){
 const source=new URL(location.href);source.searchParams.delete('width');
 createRoot(document.getElementById('root')!).render(<iframe title="Mobile invitation preview" src={source.toString()} style={{display:'block',border:0,width:Math.min(width,innerWidth),height:'100vh',margin:'auto'}}/>);
}else createRoot(document.getElementById('root')!).render(<Preview/>);
