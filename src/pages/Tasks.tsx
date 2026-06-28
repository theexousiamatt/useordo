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
import {
  TASK_COLUMNS,
  type TaskStatus,
} from "@/lib/projectConstants";
import { cn } from "@/lib/utils";

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  project_id: string;
  assignee_id: string | null;
}

const STATUS_LABEL: Record<TaskStatus, string> = Object.fromEntries(
  TASK_COLUMNS.map((c) => [c.id, c.title]),
) as Record<TaskStatus, string>;

export default function Tasks() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setError(false);
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, status, due_date, project_id, assignee_id")
      .eq("workspace_id", currentWorkspace.id)
      .order("position", { ascending: true });
    if (error) {
      setError(true);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as TaskRow[];
    setTasks(rows);
    const pIds = Array.from(new Set(rows.map((t) => t.project_id)));
    if (pIds.length) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", pIds);
      setProjectNames(
        Object.fromEntries((projects ?? []).map((p: any) => [p.id, p.name])),
      );
    }
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (mineOnly ? tasks.filter((t) => t.assignee_id === user?.id) : tasks),
    [tasks, mineOnly, user?.id],
  );

  const grouped = useMemo(() => {
    return TASK_COLUMNS.map((col) => ({
      ...col,
      tasks: visible.filter((t) => t.status === col.id && t.status !== "done"),
    })).filter((g) => g.tasks.length > 0);
  }, [visible]);

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Every open task across your workspace, prioritized and easy to scan."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMineOnly((v) => !v)}
              className={cn(
                "rounded-pill border px-3 py-2 text-xs font-medium transition-colors",
                mineOnly
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              {mineOnly ? "My tasks" : "All tasks"}
            </button>
          </div>
        }
      />

      {loading ? (
        <LoadingList rows={6} />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={mineOnly ? "Nothing assigned to you" : "No open tasks"}
          description="Tasks are created on a project board. Open a project to add and manage tasks."
          actionLabel="Go to projects"
          onAction={() => navigate("/projects")}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.id}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                {group.title} · {group.tasks.length}
              </h2>
              <Card className="divide-y divide-border">
                {group.tasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigate(`/projects/${t.project_id}`)}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {projectNames[t.project_id] ?? "Project"}
                        {t.due_date ? ` · Due ${dateShort(t.due_date)}` : ""}
                      </p>
                    </div>
                    <Badge className={cn("capitalize", PRIORITY_STYLES[t.priority])}>
                      {t.priority}
                    </Badge>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {STATUS_LABEL[t.status]}
                    </span>
                  </button>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
