import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, CalendarDays, AlertCircle, Clock3, Inbox, ListTodo, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { dateShort } from "@/lib/format";
import { dueDays, filterWorkTasks, type WorkTask, type WorkView } from "@/lib/myTasks";

type WorkSnapshot = {
  tasks: WorkTask[];
  projectNames: Record<string, string>;
  assignees: Map<string, string[]>;
};
const tabs: { id: WorkView; name: string; icon: typeof ListTodo }[] = [
  { id: "today", name: "Today", icon: CalendarDays },
  { id: "upcoming", name: "Upcoming", icon: Clock3 },
  { id: "overdue", name: "Overdue", icon: AlertCircle },
  { id: "unscheduled", name: "No date", icon: Inbox },
  { id: "completed", name: "Completed", icon: CheckCircle2 },
];
const PAGE = 500;

async function pageAll<T>(reader: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await reader(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    result.push(...rows);
    if (rows.length < PAGE) return result;
  }
}

export default function Tasks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<WorkSnapshot | null>(null);
  const [view, setView] = useState<WorkView>(() => {
    const requested = searchParams.get("view");
    return tabs.some((tab) => tab.id === requested) ? requested as WorkView : "today";
  });
  const [mineOnly, setMineOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workspaceId = currentWorkspace?.id;

  const reload = useCallback(async () => {
    if (!workspaceId) { setLoading(false); setSnapshot(null); return; }
    setLoading(true);
    setError(null);
    try {
      // Read the user's RLS-visible projects first, then constrain task and
      // assignee queries to these project ids. Do not expose client data.
      const projects = await pageAll<{id: string; name: string}>((from, to) =>
        supabase.from("projects").select("id,name")
          .eq("workspace_id", workspaceId).is("archived_at", null)
          .order("id").range(from, to)
      );
      if (!projects.length) {
        setSnapshot({ tasks: [], projectNames: {}, assignees: new Map() });
        return;
      }
      const ids = new Set(projects.map((project) => project.id));
      const tasks = (await pageAll<WorkTask>((from, to) =>
        supabase.from("tasks")
          .select("id,title,project_id,due_date,completed_at,archived_at,assignee_id,position")
          .eq("workspace_id", workspaceId).is("archived_at", null)
          .order("id").range(from, to)
      )).filter((task) => ids.has(task.project_id));
      const map = new Map<string, string[]>();
      if (tasks.length) {
        // Supabase.in() is bounded; read assignees by scoped project instead
        // of passing an unbounded task id list.
        for (const project of projects) {
          const rows = await pageAll<{task_id: string; user_id: string}>((from, to) =>
            supabase.from("task_assignees")
              .select("task_id,user_id").eq("project_id", project.id)
              .order("task_id").range(from, to)
          );
          for (const row of rows) map.set(row.task_id, [...(map.get(row.task_id) ?? []), row.user_id]);
        }
      }
      setSnapshot({
        tasks,
        projectNames: Object.fromEntries(projects.map((project) => [project.id, project.name])),
        assignees: map,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your tasks.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void reload(); }, [reload]);

  const now = new Date();
  const visible = useMemo(() => snapshot
    ? filterWorkTasks(snapshot.tasks, snapshot.assignees, user?.id, view, mineOnly, now)
    : [], [snapshot, user?.id, view, mineOnly, now.toDateString()]);
  const counts = useMemo(() => {
    if (!snapshot) return {} as Record<WorkView, number>;
    return Object.fromEntries(tabs.map((tab) => [tab.id, filterWorkTasks(
      snapshot.tasks, snapshot.assignees, user?.id, tab.id, mineOnly, now
    ).length])) as Record<WorkView, number>;
  }, [snapshot, user?.id, mineOnly, now.toDateString()]);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{currentWorkspace?.name ?? "Workspace"}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">My Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Focus on what needs doing, not where it sits on a board.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setMineOnly((value) => !value)}>
            {mineOnly ? "Assigned to me" : "All visible tasks"}
          </Button>
          <Button size="icon" variant="outline" onClick={() => void reload()} aria-label="Refresh tasks">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div role="tablist" aria-label="Task views" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-card p-1.5">
        {tabs.map(({ id, name, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={view === id}
            onClick={() => { setView(id); setSearchParams({ view: id }, { replace: true }); }}
            className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
              view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {name}
            {!loading && <span className={cn("tabular-nums", view === id ? "text-primary-foreground/70" : "text-muted-foreground")}>{counts[id] ?? 0}</span>}
          </button>
        ))}
      </div>

      {loading ? <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-18 w-full rounded-xl" />)}</div>
        : error ? <ErrorState onRetry={() => void reload()} />
        : !visible.length ? (
          <Card className="flex flex-col items-center gap-2 rounded-panel px-5 py-12 text-center">
            <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
            <h2 className="font-medium">{view === "today" ? "Nothing due today" : "No tasks in this view"}</h2>
            <p className="max-w-sm text-sm text-muted-foreground">New assignments and changes will appear here. You can also open a project to plan work.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/projects")}>View projects</Button>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-panel">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">{tabs.find((tab) => tab.id === view)?.name}</h2>
              <span className="text-xs tabular-nums text-muted-foreground">{visible.length} tasks</span>
            </div>
            <div className="divide-y divide-border">
              {visible.map((task) => {
                const days = dueDays(task.due_date, now);
                return (
                  <button type="button" key={task.id}
                    onClick={() => navigate(`/projects/${task.project_id}?task=${task.id}`)}
                    className="flex w-full min-w-0 items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40 sm:px-5">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground", task.completed_at && "text-primary")}>
                      {task.completed_at ? <CheckCircle2 className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{task.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{snapshot?.projectNames[task.project_id] ?? "Project"}</span>
                    </span>
                    <span className={cn("shrink-0 text-xs", days !== null && days < 0 && !task.completed_at ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : task.due_date ? dateShort(task.due_date) : "No due date"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}
    </div>
  );
}
