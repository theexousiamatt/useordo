import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { foundationApi, type ProjectTeamPerson } from "./api";
import { Button } from "@/components/ui/button";

type TeamRole = "manager" | "contributor" | "viewer";
const TEAM_ROLES: {value:TeamRole;label:string}[] = [
  {value:"manager",label:"Manager"},
  {value:"contributor",label:"Contributor"},
  {value:"viewer",label:"Viewer"},
];

function readableError(error:unknown) {
  return error instanceof Error ? error.message :
    error && typeof error==="object" && "message" in error ? String(error.message) :
    "Could not update project membership. Please try again.";
}

/** Existing studio members can join many independent projects; no account duplication. */
export function ProjectTeamPanel({accountId,organizationId,projectId}: {
  accountId:string;organizationId:string;projectId:string;
}) {
  const client=useQueryClient();
  const queryKey=["foundation",accountId,organizationId,"project-team",projectId];
  const team=useQuery({queryKey,queryFn:()=>foundationApi.listProjectTeam(organizationId,projectId),retry:1});
  const [open,setOpen]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const [newRole,setNewRole]=useState<TeamRole>("contributor");
  const [roles,setRoles]=useState<Record<string,TeamRole>>({});
  const [pending,setPending]=useState(false);
  const [removing,setRemoving]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const receipts=useRef(new Map<string,string>());

  const runChange=async(personId:string,role:TeamRole|null)=>{
    // A retry after an interrupted response must reuse the original request ID.
    const key=`${personId}:${role ?? "remove"}`;
    let id=receipts.current.get(key);
    if(!id){id=crypto.randomUUID();receipts.current.set(key,id);}
    await foundationApi.setProjectTeamMember(organizationId,projectId,personId,role,id);
    receipts.current.delete(key);
  };

  const reload=async()=>{
    await client.invalidateQueries({queryKey});
    await client.invalidateQueries({queryKey:["foundation",accountId,organizationId,"production",projectId]});
    await client.invalidateQueries({queryKey:["foundation",accountId,organizationId,"my-tasks"]});
    await client.invalidateQueries({queryKey:["foundation",accountId,organizationId,"eligible",projectId]});
  };

  const execute=async(work:()=>Promise<void>)=>{
    if(pending)return;
    setPending(true);setError("");setNotice("");
    try {await work();setNotice("Project team updated.");}
    catch(err){setError(readableError(err));}
    finally{await reload().catch(()=>{});setPending(false);}
  };

  const people=team.data ?? [];
  const active=people.filter(person=>person.project_role);
  const available=people.filter(person=>!person.project_role);
  const selectedAvailable=selected.filter(id=>available.some(person=>person.user_id===id));

  const add=()=>void execute(async()=>{
    if(selectedAvailable.length===0)return;
    let added=0;
    try {
      for(const id of selectedAvailable){
        await runChange(id,newRole);
        added++;
      }
    } finally {
      // If any later addition fails, successful earlier additions are not repeated.
      setSelected(selectedAvailable.slice(added));
    }
  });

  const saveRole=(person:ProjectTeamPerson)=>{
    const role=roles[person.user_id] ?? person.project_role;
    if(!role || role==="owner" || role===person.project_role)return;
    void execute(async()=>{await runChange(person.user_id,role);setRoles(current=>{
      const next={...current};delete next[person.user_id];return next;
    });});
  };

  const removeMember=(person:ProjectTeamPerson)=>{
    void execute(async()=>{await runChange(person.user_id,null);setRemoving(null);});
  };

  return <section aria-label="Project team" className="rounded-card border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold">Project team</h3>
        <p className="text-xs text-muted-foreground">{active.length} member{active.length===1?"":"s"} · People can belong to multiple projects.</p>
      </div>
      <Button type="button" size="sm" variant="outline" aria-expanded={open} onClick={()=>setOpen(current=>!current)}>{open?"Close team":"Manage team"}</Button>
    </div>
    {open && <div className="mt-4 space-y-5">
      {team.isPending ? <p role="status" className="text-sm">Loading project team…</p> :
       team.isError ? <div role="alert" className="text-sm">Couldn't load team members. <Button size="sm" variant="outline" onClick={()=>void team.refetch()}>Retry</Button></div> : <>
        <div className="space-y-3">
          <h4 className="text-sm font-medium">People on this project</h4>
          {active.map(person=><div key={person.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-small border border-border p-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{person.member_name}</p>
              <p className="text-xs capitalize text-muted-foreground">{person.project_role==="owner"?"Project owner":person.studio_role+" · "+person.project_role}</p>
            </div>
            {person.project_role==="owner" ? <span className="text-xs text-muted-foreground">Owner</span> :
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`role-${person.user_id}`}>Role for {person.member_name}</label>
              <select id={`role-${person.user_id}`} className="rounded-small border border-border bg-card px-2 py-2 text-sm"
                disabled={pending} value={roles[person.user_id]??person.project_role??"viewer"}
                onChange={event=>setRoles(current=>({...current,[person.user_id]:event.target.value as TeamRole}))}>
                {TEAM_ROLES.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <Button size="sm" disabled={pending || !roles[person.user_id] || roles[person.user_id]===person.project_role}
                onClick={()=>saveRole(person)}>Save role</Button>
              {removing===person.user_id ?
                <><Button size="sm" variant="outline" disabled={pending} onClick={()=>setRemoving(null)}>Cancel</Button>
                  <Button size="sm" disabled={pending} onClick={()=>removeMember(person)}>Confirm remove</Button></> :
                <Button size="sm" variant="ghost" disabled={pending} onClick={()=>setRemoving(person.user_id)}>Remove</Button>}
            </div>}
          </div>)}
        </div>
        <div className="space-y-3 border-t border-border pt-4">
          <h4 className="text-sm font-medium">Add people</h4>
          {available.length ? <>
            <p className="text-xs text-muted-foreground">Choose one or more existing studio members. New studio invitations are managed separately.</p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {available.map(person=><label key={person.user_id} className="flex items-center gap-3 rounded-small px-2 py-2 text-sm hover:bg-secondary">
                <input type="checkbox" disabled={pending} checked={selectedAvailable.includes(person.user_id)}
                  onChange={event=>setSelected(current=>event.target.checked?[...current,person.user_id]:current.filter(id=>id!==person.user_id))}/>
                <span>{person.member_name}</span><span className="ml-auto text-xs capitalize text-muted-foreground">{person.studio_role}</span>
              </label>)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="new-project-member-role" className="text-sm">Project role</label>
              <select id="new-project-member-role" value={newRole} disabled={pending}
                onChange={event=>setNewRole(event.target.value as TeamRole)}
                className="rounded-small border border-border bg-card px-2 py-2 text-sm">
                {TEAM_ROLES.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <Button size="sm" disabled={pending || selectedAvailable.length===0} onClick={add}>
                {pending?"Saving…":`Add ${selectedAvailable.length || ""} selected`}
              </Button>
            </div>
          </> : <p className="text-sm text-muted-foreground">All existing studio members are already on this project.</p>}
        </div>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </div>}
  </section>;
}
