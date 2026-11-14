import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight, CalendarDays, Check, CheckCircle2, Clock3, ListTodo,
  Search, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingList } from "@/components/states/LoadingState";
import { buildTaskFeed, taskDueDays, type FeedTask, type FeedProject, type TaskMembership, type TaskView, type TaskAudience } from "@/lib/myTasks";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TaskFeedData {
  tasks: FeedTask[];
  projects: FeedProject[];
  memberships: TaskMembership[];
  stages: Record<string,string>;
}
const views: { id: TaskView; label: string }[] = [
  { id: "today", label: "Today" }, { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" }, { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
];

function useTaskFeed() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery({
    queryKey: ["task-feed", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async (): Promise<TaskFeedData> => {
      if (!workspaceId) throw new Error("Select a workspace first");
      const { data: projects, error: projectError } = await supabase.from("projects")
        .select("id,name,status,archived_at").eq("workspace_id",workspaceId)
        .is("archived_at",null);
      if (projectError) throw projectError;
      const visibleProjects = (projects ?? []) as FeedProject[];
      if (!visibleProjects.length) return { tasks: [], projects: [], memberships: [], stages: {} };
      const projectIds = visibleProjects.map(p => p.id);
      const tasks: FeedTask[] = [];
      const memberships: TaskMembership[] = [];
      const stages: Record<string,string> = {};
      // Bound each request to RLS-visible projects and chunk the .in filters.
      for (let offset = 0; offset < projectIds.length; offset += 50) {
        const ids = projectIds.slice(offset,offset + 50);
        const [assigned, stageRows] = await Promise.all([
          supabase.from("task_assignees").select("task_id,user_id").eq("workspace_id",workspaceId).in("project_id",ids),
          supabase.from("project_stages").select("id,name").eq("workspace_id",workspaceId).in("project_id",ids),
        ]);
        if (assigned.error) throw assigned.error;
        if (stageRows.error) throw stageRows.error;
        memberships.push(...(assigned.data ?? []));
        for (const stage of stageRows.data ?? []) stages[stage.id] = stage.name;
        for (let page = 0; ;page++) {
          const { data, error } = await supabase.from("tasks")
            .select("id,project_id,title,due_date,completed_at,archived_at,assignee_id,stage_id,updated_at")
            .eq("workspace_id",workspaceId)
            .in("project_id",ids).is("archived_at",null)
            .order("id",{ascending:true}).range(page*500,page*500+499);
          if(error) throw error;
          tasks.push(...((data ?? []) as FeedTask[]));
          if((data ?? []).length < 500) break;
        }
      }
      return { projects:visibleProjects,tasks,memberships,stages };
    },
  });
}

export default function Tasks() {
  const navigate=useNavigate();
  const [searchParams,setSearchParams]=useSearchParams();
  const qc=useQueryClient();
  const { user }=useAuth();
  const { data,isPending,isError,refetch }=useTaskFeed();
  const [audience,setAudience]=useState<TaskAudience>("mine");
  const requestedView = searchParams.get("view");
  const view: TaskView = views.some(item=>item.id===requestedView) ? requestedView as TaskView : "today";
  const selectView=(next:TaskView)=>{
    const params=new URLSearchParams(searchParams);
    params.set("view",next);
    setSearchParams(params);
  };
  const [search,setSearch]=useState("");
  const [saving,setSaving]=useState<string|null>(null);
  const [confirmTask,setConfirmTask]=useState<FeedTask|null>(null);
  const now = new Date();
  const filtered=useMemo(()=>
    data && user ? buildTaskFeed(data.tasks,data.projects,data.memberships,user.id,audience,view,search,now) : [],
    // Date is intentionally evaluated whenever task filters/data change.
    [data,user,audience,view,search,now.toDateString()]);
  const projects=useMemo(()=>new Map((data?.projects ?? []).map(p=>[p.id,p.name])),[data]);

  const complete = async (task:FeedTask, bypassChecklist=false) => {
    if(saving) return;
    setSaving(task.id);
    try{
      if(!bypassChecklist){
        const {data:subtasks,error:checkError}=await supabase.from("task_subtasks")
          .select("completed").eq("project_id",task.project_id).eq("task_id",task.id);
        if(checkError) throw checkError;
        if((subtasks??[]).some(item=>!item.completed)){
          setConfirmTask(task);
          return;
        }
      }
      const {data:updated,error}=await supabase.from("tasks")
        .update({completed_at:new Date().toISOString()}).eq("id",task.id)
        .eq("project_id",task.project_id).is("completed_at",null).select("id");
      if(error) throw error;
      if(!updated?.length) throw new Error("Task could not be completed. Refresh and check your permissions.");
      toast.success("Task marked complete");
      await Promise.all([
        qc.invalidateQueries({queryKey:["task-feed"]}),
        qc.invalidateQueries({queryKey:["project-tasks",task.project_id]}),
        qc.invalidateQueries({queryKey:["studio-dashboard"]}),
      ]);
    }catch(e){
      toast.error(e instanceof Error ? e.message : "Couldn't complete task");
    }finally{
      setSaving(null);
    }
  };

  const visibleProjects = data?.projects.length ?? 0;
  return (
    <div className="space-y-6 pb-6">
      <PageHeader title="My tasks" description="Know what needs your attention, then get it done." />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-pill border border-border bg-card p-1" role="group" aria-label="Task ownership">
          {([{id:"mine",label:"Assigned to me"},{id:"team",label:"Team tasks"}] as const).map(item=>(
            <button key={item.id} type="button" aria-pressed={audience===item.id}
              onClick={()=>setAudience(item.id)}
              className={cn("rounded-pill px-3.5 py-2 text-xs font-medium transition-colors",
                audience===item.id?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground")}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input aria-label="Search tasks" value={search} onChange={event=>setSearch(event.target.value)}
            placeholder="Search tasks or projects" className="h-10 rounded-small bg-card pl-9"/>
        </div>
      </div>

      <div role="tablist" aria-label="Task schedule" className="flex min-w-0 gap-1 overflow-x-auto border-b border-border pb-px">
        {views.map(item=>(
          <button key={item.id} type="button" role="tab" aria-selected={view===item.id}
            onClick={()=>selectView(item.id)}
            className={cn("shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors",
              view===item.id?"border-primary font-semibold text-foreground":"border-transparent text-muted-foreground hover:text-foreground")}>
            {item.label}
            {item.id==="overdue" && data && user && (
              <span className="ml-1.5 text-xs text-destructive">
                {buildTaskFeed(data.tasks,data.projects,data.memberships,user.id,audience,"overdue").length || ""}
              </span>
            )}
          </button>
        ))}
      </div>

      {isPending ? <LoadingList rows={5}/> : isError || !data ? (
        <ErrorState onRetry={()=>void refetch()}/>
      ) : filtered.length===0 ? (
        <div className="rounded-panel border border-border bg-card px-5 py-14 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-muted-foreground"/>
          <h2 className="mt-4 text-base font-semibold">
            {visibleProjects===0?"No projects to show":view==="completed"?"No completed tasks":view==="overdue"?"Nothing overdue":"Nothing here yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {view==="today"
              ? "You're clear for today. Tasks without dates are still available in All."
              : view==="upcoming" ? "No tasks are due in the next 14 days."
              : "Try a different view, search term, or task ownership filter."}
          </p>
          <Button variant="outline" className="mt-5" onClick={()=>navigate("/projects")}>Browse projects</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">{filtered.length} {filtered.length===1?"task":"tasks"}</p>
            <p className="text-xs text-muted-foreground">
              {view==="today"?"Due today and outstanding":view==="upcoming"?"Next 14 days":view==="completed"?"Finished work":"Sorted by due date"}
            </p>
          </div>
          <Card className="divide-y divide-border overflow-hidden rounded-panel">
            {filtered.map(task=>{
              const days=taskDueDays(task.due_date,now);
              const late=days!==null&&days<0&&!task.completed_at;
              return (
                <div key={task.id} className="group flex min-w-0 items-center gap-3 p-4 transition-colors hover:bg-muted/30 sm:gap-4">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-small",
                    task.completed_at?"bg-primary/10 text-primary":late?"bg-destructive/10 text-destructive":"bg-muted text-muted-foreground")}>
                    {task.completed_at?<Check className="h-4 w-4"/>:late?<AlertCircle className="h-4 w-4"/>:<ListTodo className="h-4 w-4"/>}
                  </span>
                  <button type="button" onClick={()=>navigate("/projects/"+task.project_id+"?task="+task.id)}
                    className="min-w-0 flex-1 rounded-small text-left outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <p className={cn("truncate text-sm font-semibold",task.completed_at&&"text-muted-foreground")}>{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="max-w-[220px] truncate">{projects.get(task.project_id)??"Project"}</span>
                      {task.stage_id&&data.stages[task.stage_id]&&<span>· {data.stages[task.stage_id]}</span>}
                      <span className={cn("inline-flex items-center gap-1",late&&"font-medium text-destructive")}>
                        <CalendarDays className="h-3 w-3"/>
                        {task.due_date ? (days===0?"Today":days===1?"Tomorrow":dateShort(task.due_date)) : "No due date"}
                      </span>
                    </div>
                  </button>
                  {task.completed_at ? (
                    <CheckCircle2 aria-label="Completed" className="h-[18px] w-[18px] shrink-0 text-primary"/>
                  ) : (
                    <button type="button" disabled={Boolean(saving)}
                      onClick={()=>void complete(task)}
                      aria-label={`Mark ${task.title} complete`}
                      title="Mark complete"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-50">
                      {saving===task.id?<Loader2 className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>}
                    </button>
                  )}
                  <button type="button" onClick={()=>navigate("/projects/"+task.project_id+"?task="+task.id)}
                    aria-label={`Open ${task.title}`} className="hidden rounded-small p-2 text-muted-foreground hover:text-foreground sm:flex">
                    <ArrowUpRight className="h-4 w-4"/>
                  </button>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      <AlertDialog open={Boolean(confirmTask)} onOpenChange={open=>!open&&setConfirmTask(null)}>
        <AlertDialogContent className="client-os">
          <AlertDialogHeader>
            <AlertDialogTitle>Complete with unfinished checklist items?</AlertDialogTitle>
            <AlertDialogDescription>The task has checklist items still open. You can keep working on them, or explicitly complete the task anyway.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={()=>setConfirmTask(null)}>Keep working</AlertDialogCancel>
            <AlertDialogAction onClick={()=>{const task=confirmTask;setConfirmTask(null);if(task)void complete(task,true);}}>Complete anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
