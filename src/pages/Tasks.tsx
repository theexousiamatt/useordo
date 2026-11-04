import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckSquare, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingList } from "@/components/states/LoadingState";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useLocalDateKey } from "@/hooks/useLocalDateKey";
import { supabase } from "@/integrations/supabase/client";
import { dateShort } from "@/lib/format";
import { matchesTaskDueDate, taskWeekRange, type TaskDueFilter } from "@/lib/taskDueDates";
import { TASK_COLUMNS, type TaskStatus } from "@/lib/projectConstants";
import { cn } from "@/lib/utils";

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  project_id: string;
  assignee_id: string | null;
  task_assignees: { user_id: string }[];
}

const STATUS_LABEL = Object.fromEntries(TASK_COLUMNS.map((column) => [column.id, column.title])) as Record<TaskStatus, string>;
const QUICK_FILTERS = [
  { value: "all", label: "All open" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "this-week", label: "Due this week" },
] as const;

export default function Tasks() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const today = useLocalDateKey();
  const [mineOnly, setMineOnly] = useState(false);
  const [due, setDue] = useState<TaskDueFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const query = useQuery({
    queryKey: ["workspace-tasks", user?.id, currentWorkspace?.id],
    enabled: !!user && !!currentWorkspace,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, project_id, assignee_id, task_assignees(user_id)")
        .eq("workspace_id", currentWorkspace!.id)
        .is("archived_at", null)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("position", { ascending: true });
      if (error) throw error;
      const tasks = (data ?? []) as TaskRow[];
      const projectIds = [...new Set(tasks.map((task) => task.project_id))];
      const projectNames: Record<string, string> = {};
      if (projectIds.length) {
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("id, name")
          .eq("workspace_id", currentWorkspace!.id)
          .in("id", projectIds);
        if (projectsError) throw projectsError;
        for (const project of projects ?? []) projectNames[project.id] = project.name;
      }
      return { tasks, projectNames };
    },
  });

  const scopedTasks = useMemo(() => {
    const tasks = query.data?.tasks ?? [];
    if (!mineOnly) return tasks;
    return tasks.filter((task) => task.task_assignees?.length
      ? task.task_assignees.some((assignee) => assignee.user_id === user?.id)
      : task.assignee_id === user?.id);
  }, [query.data, mineOnly, user?.id]);

  const visible = useMemo(
    () => scopedTasks.filter((task) => matchesTaskDueDate(task, due, { from, to }, today)),
    [scopedTasks, due, from, to, today],
  );
  const grouped = TASK_COLUMNS.map((column) => ({
    ...column,
    tasks: visible.filter((task) => task.status === column.id),
  })).filter((group) => group.tasks.length);
  const invalidRange = due === "custom" && !!from && !!to && from > to;
  const week = taskWeekRange(today);
  const clearDates = () => { setDue("all"); setFrom(""); setTo(""); };

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Open work across your projects, with deadlines in view."
        actions={
          <Button type="button" variant={mineOnly ? "default" : "outline"} aria-pressed={mineOnly}
            onClick={() => setMineOnly((value) => !value)}>
            My tasks
          </Button>
        }
      />

      <section aria-label="Task due date filters" className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((filter) => (
            <Button key={filter.value} type="button" variant={due === filter.value ? "default" : "outline"}
              aria-pressed={due === filter.value} onClick={() => setDue(filter.value)} className="gap-2">
              {filter.label}
              {!query.isPending && !query.isError && <span className="tabular-nums">
                {scopedTasks.filter((task) => matchesTaskDueDate(task, filter.value, {}, today)).length}
              </span>}
            </Button>
          ))}
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="tasks-due-filter" className="sr-only">Filter by due date</label>
            <select id="tasks-due-filter" value={due}
              onChange={(event) => setDue(event.target.value as TaskDueFilter)}
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none">
              <option value="all">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="this-week">Due this week</option>
              <option value="upcoming">Today onward</option>
              <option value="none">No due date</option>
              <option value="custom">Custom date range</option>
            </select>
          </div>
        </div>

        {due === "custom" && <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-48">
            <label htmlFor="tasks-due-from" className="text-xs font-medium">From</label>
            <Input id="tasks-due-from" type="date" value={from} max={to || undefined}
              aria-invalid={invalidRange} aria-describedby={invalidRange ? "tasks-date-error" : undefined}
              onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-48">
            <label htmlFor="tasks-due-to" className="text-xs font-medium">To</label>
            <Input id="tasks-due-to" type="date" value={to} min={from || undefined}
              aria-invalid={invalidRange} aria-describedby={invalidRange ? "tasks-date-error" : undefined}
              onChange={(event) => setTo(event.target.value)} />
          </div>
          <p className="w-full text-xs text-muted-foreground sm:w-auto sm:pb-3">Both dates included. Leave either date blank for an open range.</p>
          {invalidRange && <p id="tasks-date-error" role="alert" className="w-full text-sm text-destructive">Choose an end date on or after the start date.</p>}
        </div>}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {!query.isPending && !query.isError && <span role="status">{visible.length} {visible.length === 1 ? "task" : "tasks"} shown</span>}
          {due === "this-week" && <span>This week: {dateShort(week.from)} – {dateShort(week.to)} · Monday–Sunday</span>}
          {due !== "all" && <Button type="button" variant="ghost" size="sm" onClick={clearDates} className="h-8 gap-1.5 px-2 text-xs">
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear date filter
          </Button>}
        </div>
      </section>

      {query.isPending ? <LoadingList rows={6} /> : query.isError ? <ErrorState onRetry={() => query.refetch()} />
        : !visible.length ? <EmptyState icon={CheckSquare}
          title={due !== "all" ? "No tasks match these dates" : mineOnly ? "Nothing assigned to you" : "No open tasks"}
          description={due !== "all" ? "Choose another due date or clear the date filter to see your open work."
            : mineOnly ? "Try all tasks to see the open work across your workspace."
              : "Tasks are created on a project board. Open a project to add and manage tasks."}
          actionLabel={due !== "all" ? "Clear date filter" : mineOnly ? "Show all tasks" : "Go to projects"}
          onAction={due !== "all" ? clearDates : mineOnly ? () => setMineOnly(false) : () => navigate("/projects")} />
          : <div className="space-y-6">{grouped.map((group) => (
            <section key={group.id}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{group.title} · {group.tasks.length}</h2>
              <Card className="divide-y divide-border">{group.tasks.map((task) => (
                <button key={task.id} type="button"
                  onClick={() => navigate("/projects/" + task.project_id + "?task=" + encodeURIComponent(task.id))}
                  className="flex w-full items-center gap-3 rounded-md p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{query.data?.projectNames[task.project_id] ?? "Project"}</p>
                    <p className={cn("mt-1 text-xs", task.due_date && task.due_date < today ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {task.due_date ? (task.due_date < today ? "Overdue" : task.due_date === today ? "Due today" : "Due") + " · " + dateShort(task.due_date) : "No due date"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{STATUS_LABEL[task.status]}</Badge>
                </button>
              ))}</Card>
            </section>
          ))}</div>}
    </div>
  );
}
