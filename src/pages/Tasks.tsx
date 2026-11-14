import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingList } from "@/components/states/LoadingState";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

interface WorkspaceTask {
  id: string;
  title: string;
  stage_id: string | null;
  completed_at: string | null;
  due_date: string | null;
  project_id: string;
  assignee_id: string | null;
  position: number;
}

export default function Tasks() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [stageDetails, setStageDetails] = useState<Record<string, {name:string;position:number}>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  const load = useCallback(async () => {
    if (!currentWorkspace) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    const { data, error: taskError } = await supabase.from("tasks")
      .select("id,title,stage_id,completed_at,due_date,project_id,assignee_id,position")
      .eq("workspace_id",currentWorkspace.id)
      .is("archived_at",null)
      .order("position",{ascending:true});
    if(taskError){
      setError(true);setLoading(false);return;
    }
    const rows=(data??[]) as WorkspaceTask[];
    const projectIds=[...new Set(rows.map(task=>task.project_id))];
    if(projectIds.length){
      const [projects,stages]=await Promise.all([
        supabase.from("projects").select("id,name").in("id",projectIds),
        supabase.from("project_stages").select("id,name,position,project_id").in("project_id",projectIds),
      ]);
      if(projects.error||stages.error){setError(true);setLoading(false);return;}
      setProjectNames(Object.fromEntries((projects.data??[]).map(project=>[project.id,project.name])));
      setStageDetails(Object.fromEntries((stages.data??[]).map(stage=>[
        stage.id,{name:stage.name,position:stage.position},
      ])));
    }else{
      setProjectNames({});
      setStageDetails({});
    }
    setTasks(rows);
    setLoading(false);
  },[currentWorkspace]);

  useEffect(()=>{void load();},[load]);

  // Stages are organization only. Open tasks are identified exclusively by an
  // explicit completion timestamp, never by a stage name or legacy status.
  const visible=useMemo(()=>
    tasks.filter(task=>!task.completed_at&&(!mineOnly||task.assignee_id===user?.id)),
    [tasks,mineOnly,user?.id]);

  const grouped=useMemo(()=>{
    const groups=new Map<string,{
      id:string;projectName:string;stageName:string;position:number;tasks:WorkspaceTask[];
    }>();
    for(const task of visible){
      const id=`${task.project_id}:${task.stage_id??"missing"}`;
      const existing=groups.get(id);
      if(existing){existing.tasks.push(task);continue;}
      const stage=task.stage_id?stageDetails[task.stage_id]:undefined;
      groups.set(id,{
        id,projectName:projectNames[task.project_id]??"Project",
        stageName:stage?.name??"Stage",
        position:stage?.position??0,
        tasks:[task],
      });
    }
    return [...groups.values()].sort((a,b)=>
      a.projectName.localeCompare(b.projectName)||a.position-b.position);
  },[visible,projectNames,stageDetails]);

  return (
    <div>
      <PageHeader title="Tasks"
        description="Open tasks across your workspace, organized by project and stage."
        actions={
          <button type="button" onClick={()=>setMineOnly(value=>!value)}
            className={cn("rounded-pill border px-3 py-2 text-xs font-medium transition-colors",
              mineOnly?"border-primary bg-primary/10 text-primary":
              "border-border text-muted-foreground hover:bg-secondary")}>
            {mineOnly?"My tasks":"All tasks"}
          </button>
        } />
      {loading?<LoadingList rows={6} />:error?<ErrorState onRetry={()=>void load()} />:
      grouped.length===0?<EmptyState icon={CheckSquare}
        title={mineOnly?"Nothing assigned to you":"No open tasks"}
        description="Tasks live in your project stages. Open a project to create or manage work."
        actionLabel="Go to projects" onAction={()=>navigate("/projects")}/>:
        <div className="space-y-6">
          {grouped.map(group=>(
            <section key={group.id}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                {group.projectName} / {group.stageName} · {group.tasks.length}
              </h2>
              <Card className="divide-y divide-border">
                {group.tasks.map(task=>(
                  <button key={task.id} type="button"
                    onClick={()=>navigate(`/projects/${task.project_id}?task=${task.id}`)}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {group.projectName}{task.due_date?` · Due ${dateShort(task.due_date)}`:""}
                      </p>
                    </div>
                    <Badge variant="secondary">{group.stageName}</Badge>
                  </button>
                ))}
              </Card>
            </section>
          ))}
        </div>}
    </div>
  );
}
