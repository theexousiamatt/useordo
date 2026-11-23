import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, CalendarDays, AlertCircle, Clock3, Inbox, ListTodo, RefreshCw } from "lucide-react";
import { addDays, format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkTasks } from "@/hooks/useWorkTasks";
import { cn } from "@/lib/utils";
import { dateShort } from "@/lib/format";
import { dueDays, filterWorkTasks, workRangeStart, type WorkView } from "@/lib/myTasks";

const tabs: { id: WorkView; name: string; icon: typeof ListTodo }[] = [
  { id: "today", name: "Today", icon: CalendarDays },
  { id: "open", name: "All open", icon: ListTodo },
  { id: "week", name: "Next 7 days", icon: CalendarDays },
  { id: "upcoming", name: "Upcoming", icon: Clock3 },
  { id: "overdue", name: "Overdue", icon: AlertCircle },
  { id: "unscheduled", name: "No date", icon: Inbox },
  { id: "completed", name: "Completed", icon: CheckCircle2 },
];
export default function Tasks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const requested = searchParams.get("view");
  const view = tabs.find(tab => tab.id === requested)?.id ?? "today";
  const mineOnly = searchParams.get("assignee") !== "all";
  const { data: snapshot, isLoading: loading, error, refetch: reload } = useWorkTasks();

  const updateFilter = (name: string, value: string) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    next.set(name, value);
    if (name === "view" && value !== "week" && value !== "overdue") next.delete("from");
    return next;
  }, { replace: true });

  const now = new Date();
  const rangeStart = workRangeStart(searchParams.get("from"), now);
  const dateRange = `${format(rangeStart, "MMM d")} – ${format(addDays(rangeStart, 6), "MMM d")}`;
  const tasksFor = (target: WorkView) => snapshot ? filterWorkTasks(
    snapshot.tasks, snapshot.assignees, user?.id, target, mineOnly, target === "week" || target === "overdue" ? rangeStart : now, snapshot.completedProjects,
  ) : [];
  const visible = tasksFor(view);
  const counts = Object.fromEntries(tabs.map(tab => [tab.id, tasksFor(tab.id).length]));

  return (
    <div className="flex flex-col gap-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{currentWorkspace?.name ?? "Workspace"}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{mineOnly ? "My Tasks" : "Tasks"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Focus on what needs doing, not where it sits on a board.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => updateFilter("assignee", mineOnly ? "all" : "me")}>
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
            onClick={() => updateFilter("view", id)}
            className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
              <h2 className="text-sm font-semibold">{view === "week" ? dateRange : tabs.find((tab) => tab.id === view)?.name}</h2>
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
                    <span className={cn("shrink-0 text-sm font-medium", days !== null && days < 0 && !task.completed_at ? "font-bold text-destructive" : "text-foreground")}>
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
