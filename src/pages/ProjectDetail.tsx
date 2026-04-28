import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, ProjectStatus, TaskStatusBadge } from "@/components/StatusBadge";
import { dateShort, timeAgo, formatBytes } from "@/lib/format";
import { activityLabel } from "@/lib/activity";
import { ArrowLeft, CalendarDays, CheckCircle2, Circle, FileText } from "lucide-react";
import { ApprovalActions } from "@/components/ApprovalActions";

export default function ProjectDetail() {
  const { id = "" } = useParams();

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("*").eq("project_id", id).order("due_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("project_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: files = [] } = useQuery({
    queryKey: ["files", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("files").select("*").eq("project_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["activity", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (!project) {
    return <div className="text-sm text-muted-foreground">Project not found or you don't have access.</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <StatusBadge status={project.status as ProjectStatus} />
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Due {dateShort(project.due_date)}</span>
        </div>
      </div>

      <Card className="p-5 surface-gradient border-border/50">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Overall progress</span>
          <span className="text-sm tabular-nums">{project.progress}%</span>
        </div>
        <Progress value={project.progress} className="h-2" />
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <Card className="p-5 border-border/50">
            <h3 className="font-semibold mb-4">Milestones</h3>
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No milestones yet.</p>
            ) : (
              <ul className="space-y-3">
                {milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    {m.completed
                      ? <CheckCircle2 className="h-4 w-4 text-success" />
                      : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className={m.completed ? "line-through text-muted-foreground" : ""}>{m.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{dateShort(m.due_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-5">
          <Card className="border-border/50 divide-y divide-border">
            {tasks.length === 0 && <div className="p-6 text-sm text-muted-foreground">No tasks yet.</div>}
            {tasks.map((t) => (
              <div key={t.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{t.title}</span>
                    <TaskStatusBadge status={t.status} />
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>}
                </div>
                <div className="text-xs text-muted-foreground">Due {dateShort(t.due_date)}</div>
                {t.status === "awaiting_approval" && <ApprovalActions task={t} />}
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-5">
          <Card className="border-border/50 divide-y divide-border">
            {files.length === 0 && <div className="p-6 text-sm text-muted-foreground">No files yet.</div>}
            {files.map((f) => (
              <div key={f.id} className="p-4 flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(f.size_bytes)} · {timeAgo(f.created_at)}</div>
                </div>
                <DownloadButton path={f.storage_path} name={f.name} />
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          <Card className="p-5 border-border/50">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div>{activityLabel(a)}</div>
                    <div className="text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DownloadButton({ path, name }: { path: string; name: string }) {
  const onClick = async () => {
    const { data, error } = await supabase.storage.from("project-files").createSignedUrl(path, 60);
    if (error || !data) return;
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.click();
  };
  return (
    <button onClick={onClick} className="text-xs text-primary hover:underline">Download</button>
  );
}
