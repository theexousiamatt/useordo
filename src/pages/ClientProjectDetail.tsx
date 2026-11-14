import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CheckCircle2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { ClientHeader } from "@/components/client/ClientHeader";
import { ActionCenter } from "@/components/client/ActionCenter";
import { ClientReviewHistory } from "@/components/client/ClientReviewHistory";
import { FilesTab } from "@/components/projects/FilesTab";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { dateShort } from "@/lib/format";

export default function ClientProjectDetail() {
  const { id } = useParams();
  const { currentWorkspace } = useWorkspace();
  const { state } = useLocation();
  const query = useQuery({
    queryKey: ["client-project", currentWorkspace?.id, id], enabled: !!id && !!currentWorkspace,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,name,description,progress,due_date")
        .eq("id", id!).eq("workspace_id", currentWorkspace!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const milestones = useQuery({
    queryKey: ["client-project-milestones", currentWorkspace?.id, id], enabled: !!query.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("id,title,due_date,completed")
        .eq("project_id", id!).eq("workspace_id", currentWorkspace!.id).order("due_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  if (query.isPending) return <><ClientHeader title="Your project" /><Skeleton className="h-48 rounded-card" /></>;
  if (query.error) return <ErrorState onRetry={() => query.refetch()} />;
  if (!query.data) return <><ClientHeader title="Project unavailable" subtitle="This project is no longer shared with you, or belongs to another agency space." /><Link to="/client/projects" className="font-semibold underline underline-offset-4">View your shared projects</Link></>;
  const project = query.data;
  return <>
    <Link to="/client/projects" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Shared projects</Link>
    <ClientHeader title={project.name} subtitle={currentWorkspace?.name} />
    {state?.invitationWelcome && <p role="status" className="rounded-small bg-secondary p-4 text-sm">You're in. Start with any deliverables ready for review below, or browse your shared files.</p>}
    <section className="space-y-4 rounded-panel bg-card p-5 sm:p-6">
      {project.description && <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{project.description}</p>}
      <div className="flex flex-wrap justify-between gap-3 text-sm"><span>Project progress · {project.progress}%</span>{project.due_date && <span className="inline-flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" />Due {dateShort(project.due_date)}</span>}</div>
      <Progress value={project.progress} aria-label="Project progress" />
    </section>
    <Tabs defaultValue="review" className="min-w-0">
      <TabsList className="mb-5 w-full sm:w-auto"><TabsTrigger value="review" className="flex-1">Review</TabsTrigger><TabsTrigger value="files" className="flex-1">Files</TabsTrigger><TabsTrigger value="milestones" className="flex-1">Milestones</TabsTrigger></TabsList>
      <TabsContent value="review"><div className="space-y-4"><ActionCenter projectId={project.id} /><ClientReviewHistory projectId={project.id} /></div></TabsContent>
      <TabsContent value="files"><FilesTab projectId={project.id} readOnly /></TabsContent>
      <TabsContent value="milestones"><section className="rounded-panel bg-card p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold">Project milestones</h2>
        {milestones.isPending ? <p role="status">Loading milestones…</p> : milestones.error ? <ErrorState onRetry={() => milestones.refetch()} /> : !milestones.data?.length ? <p className="text-sm text-muted-foreground">Your agency will share milestones here as the project takes shape.</p> : <ul className="divide-y divide-border">{milestones.data.map(milestone => <li key={milestone.id} className="flex items-start justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words text-sm font-medium">{milestone.title}</p>{milestone.due_date && <p className="mt-1 text-xs text-muted-foreground">{dateShort(milestone.due_date)}</p>}</div><span className="shrink-0 text-xs text-muted-foreground">{milestone.completed ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Complete</span> : "Upcoming"}</span></li>)}</ul>}
      </section></TabsContent>
    </Tabs>
  </>;
}
