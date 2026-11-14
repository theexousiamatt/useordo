import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity, ArrowRight, CalendarClock, CheckCircle2, CheckSquare2,
  Clock3, FolderKanban, RefreshCw, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { useStudioDashboard } from "@/hooks/useStudioDashboard";
import { useWorkspace } from "@/hooks/useWorkspace";
import { activityDescription, buildStudioOverview } from "@/lib/studioDashboard";
import type { StudioDeadline } from "@/lib/studioDashboard";
import { dateShort, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

function SectionTitle({
  title, subtitle, href, linkLabel,
}: {
  title: string; subtitle?: string; href?: string; linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {href && linkLabel && (
        <Link to={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {linkLabel}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, hint, href, urgent = false,
}: {
  label: string; value: number; icon: typeof FolderKanban; hint: string;
  href: string; urgent?: boolean;
}) {
  return (
    <Link to={href} className="block rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card className="group h-full rounded-panel p-5 transition-colors hover:border-primary/35">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className={cn("h-4 w-4", urgent && value > 0 ? "text-destructive" : "text-muted-foreground")} aria-hidden="true" />
        </div>
        <p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </Card>
    </Link>
  );
}

function DashboardRow({
  title, detail, right, to, indicator,
}: {
  title: string; detail: string; right?: string; to: string; indicator?: "urgent" | "normal";
}) {
  return (
    <Link
      to={to}
      className="group flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
      <span className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        indicator === "urgent" ? "bg-destructive" : "bg-primary/60",
      )} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium group-hover:text-primary">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      {right && <span className="shrink-0 text-xs text-muted-foreground">{right}</span>}
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
    </Link>
  );
}

function DeadlineList({ items }: { items: StudioDeadline[] }) {
  if (!items.length) return (
    <div className="px-5 py-10 text-center">
      <CheckCircle2 className="mx-auto mb-3 h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">No deadlines in the next 14 days</p>
      <p className="mt-1 text-xs text-muted-foreground">Upcoming project, task and milestone dates will appear here.</p>
    </div>
  );
  return (
    <div className="divide-y divide-border">
      {items.slice(0, 7).map((item) => (
        <DashboardRow
          key={item.kind + item.id}
          title={item.title}
          detail={item.project_name + " · " + (item.kind === "task" ? "Task" : item.kind === "project" ? "Project" : "Milestone")}
          right={item.days_until === 0 ? "Today" : item.days_until === 1 ? "Tomorrow" : dateShort(item.due_date)}
          to={item.kind === "task"
            ? "/projects/" + item.project_id + "?task=" + item.id
            : "/projects/" + item.project_id + (item.kind === "milestone" ? "?tab=milestones" : "")}
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { data, isLoading, isError, refetch, isFetching } = useStudioDashboard();
  const overview = useMemo(() => data ? buildStudioOverview(data) : null, [data]);

  return (
    <div className="flex flex-col gap-7 pb-8 sm:gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{currentWorkspace?.name ?? "Workspace"}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Overview</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            The work, deadlines and decisions that need your team's attention.
          </p>
        </div>
        <Button variant="outline" size="sm" className="self-start" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isFetching && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </header>

      {isLoading ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-36 rounded-panel" />)}
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Skeleton className="h-80 rounded-panel" />
            <Skeleton className="h-80 rounded-panel" />
          </div>
        </>
      ) : isError || !overview ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace totals">
            <StatCard
              label="Active projects" value={overview.activeProjects.length}
              icon={FolderKanban} hint="Currently in progress" href="/projects"
            />
            <StatCard
              label="Open tasks" value={overview.openTasks.length}
              icon={CheckSquare2} hint="Not yet marked complete" href="/tasks"
            />
            <StatCard
              label="Overdue tasks" value={overview.overdueTasks.length}
              icon={AlertCircle} hint="Past their due dates" href="/tasks" urgent
            />
            <StatCard
              label="Pending approvals" value={overview.pendingApprovals.length}
              icon={Clock3} hint="Submitted for client review" href="/projects"
            />
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <section id="attention" aria-labelledby="attention-heading" className="min-w-0">
              <SectionTitle title="Needs attention" subtitle="Outstanding tasks and client decisions" />
              <Card className="overflow-hidden rounded-panel">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 id="attention-heading" className="text-sm font-semibold">Overdue tasks</h3>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    overview.overdueTasks.length ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                  )}>{overview.overdueTasks.length}</span>
                </div>
                {overview.overdueTasks.length ? (
                  <div className="divide-y divide-border">
                    {overview.overdueTasks.slice(0, 5).map((task) => (
                      <DashboardRow
                        key={task.id}
                        title={task.title} detail={task.project_name}
                        right={dateShort(task.due_date)}
                        to={"/projects/" + task.project_id + "?task=" + task.id}
                        indicator="urgent"
                      />
                    ))}
                    {overview.overdueTasks.length > 5 && (
                      <button
                        type="button" onClick={() => navigate("/tasks")}
                        className="w-full px-4 py-3 text-left text-xs font-medium text-primary hover:bg-muted/30"
                      >
                        View all open tasks
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="px-4 py-6 text-sm text-muted-foreground">No overdue tasks. You're all caught up.</p>
                )}

                <div className="flex items-center justify-between border-y border-border bg-muted/20 px-4 py-3">
                  <h3 className="text-sm font-semibold">Awaiting client approval</h3>
                  <span className="text-xs text-muted-foreground">{overview.pendingApprovals.length}</span>
                </div>
                {overview.pendingApprovals.length ? (
                  <div className="divide-y divide-border">
                    {overview.pendingApprovals.slice(0, 4).map((item) => (
                      <DashboardRow
                        key={item.id} title={item.title}
                        detail={overview.projectName(item.project_id)}
                        right="In review"
                        to={"/projects/" + item.project_id + "?tab=deliverables"}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-6 text-sm text-muted-foreground">Nothing is currently awaiting approval.</p>
                )}
              </Card>
            </section>

            <section id="deadlines" aria-labelledby="deadlines-heading" className="min-w-0">
              <SectionTitle title="Upcoming deadlines" subtitle="Today through the next 14 days" />
              <Card className="overflow-hidden rounded-panel">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h3 id="deadlines-heading" className="text-sm font-semibold">Schedule</h3>
                </div>
                <DeadlineList items={overview.upcoming} />
              </Card>
            </section>
          </div>

          <section aria-labelledby="active-projects-heading">
            <SectionTitle title="Active projects" subtitle="Project progress is based on completed tasks, not board stages" href="/projects" linkLabel="All projects" />
            {overview.featuredProjects.length ? (
              <div id="active-projects-heading" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {overview.featuredProjects.slice(0, 6).map((project) => {
                  const progress = overview.projectProgress(project.id);
                  return (
                    <Link key={project.id} to={"/projects/" + project.id}
                      className="group block rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <Card className="h-full rounded-panel p-5 transition-colors hover:border-primary/35">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <h3 className="truncate text-sm font-semibold group-hover:text-primary">{project.name}</h3>
                          <span className={cn(
                            "shrink-0 rounded-full px-2 py-1 text-[11px] font-medium",
                            project.health === "blocked" ? "bg-destructive/10 text-destructive"
                              : project.health === "at_risk" ? "bg-amber-500/10 text-amber-600"
                              : "bg-muted text-muted-foreground",
                          )}>
                            {project.health === "blocked" ? "Blocked" : project.health === "at_risk" ? "At risk" : "On track"}
                          </span>
                        </div>
                        <div className="mt-6 flex items-baseline justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">{progress.total ? progress.completed + "/" + progress.total + " tasks" : "No tasks yet"}</span>
                          <span className="font-medium tabular-nums">{progress.percent}%</span>
                        </div>
                        <Progress value={progress.percent} className="mt-2 h-1.5" />
                        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{project.due_date ? "Due " + dateShort(project.due_date) : "No due date"}</span>
                          <ArrowRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Card id="active-projects-heading" className="rounded-panel px-5 py-8 text-center">
                <FolderKanban className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium">No active projects</p>
                <p className="mt-1 text-xs text-muted-foreground">Projects marked active will appear here.</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate("/projects")}>View projects</Button>
              </Card>
            )}
          </section>

          <section aria-labelledby="activity-heading">
            <SectionTitle title="Recent activity" subtitle="The latest updates across visible projects" href="/activity" linkLabel="Full activity" />
            <Card className="overflow-hidden rounded-panel">
              {overview.recentActivity.length ? (
                <div id="activity-heading" className="divide-y divide-border">
                  {overview.recentActivity.map((item) => (
                    <DashboardRow
                      key={item.id} title={activityDescription(item)}
                      detail={overview.projectName(item.project_id)}
                      right={timeAgo(item.created_at)}
                      to={"/projects/" + item.project_id + "?tab=activity"}
                    />
                  ))}
                </div>
              ) : (
                <div id="activity-heading" className="px-5 py-10 text-center">
                  <Activity className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium">No project activity yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Updates will appear as your team works on projects.</p>
                </div>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
