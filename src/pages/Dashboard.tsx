import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, FolderKanban,
  Inbox, AlertCircle, Clock3, RefreshCw,
} from "lucide-react";
import { useStudioDashboard } from "@/hooks/useStudioDashboard";
import { useWorkspace } from "@/hooks/useWorkspace";
import { buildStudioOverview, activityDescription, type StudioDeadline } from "@/lib/studioDashboard";
import { dateShort, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { Progress } from "@/components/ui/progress";

function Heading({ title, eyebrow, to, linkText }: {
  title: string; eyebrow?: string; to?: string; linkText?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        {eyebrow&&<p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">{eyebrow}</p>}
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
      </div>
      {to&&<Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
        {linkText??"See all"} <ArrowRight className="h-3.5 w-3.5"/>
      </Link>}
    </div>
  );
}

function AttentionLink({ title, detail, date, to, urgent }: {
  title: string; detail: string; date?: string; to: string; urgent?: boolean;
}) {
  return (
    <Link to={to} className="group flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
      <span className={cn("h-2 w-2 shrink-0 rounded-full",urgent?"bg-destructive":"bg-primary/50")} aria-hidden="true"/>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold group-hover:text-primary">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      {date&&<span className={cn("shrink-0 text-xs",urgent?"text-destructive":"text-muted-foreground")}>{date}</span>}
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true"/>
    </Link>
  );
}

function UpcomingRow({ item }: { item: StudioDeadline }) {
  const to = item.kind==="task"
    ? `/projects/${item.project_id}?task=${item.id}`
    : `/projects/${item.project_id}${item.kind==="milestone"?"?tab=milestones":""}`;
  return (
    <AttentionLink
      to={to} title={item.title}
      detail={`${item.project_name} · ${item.kind==="project"?"Project":item.kind==="task"?"Task":"Milestone"}`}
      date={item.days_until===0?"Today":item.days_until===1?"Tomorrow":dateShort(item.due_date)}
    />
  );
}

function Stat({ label, value, href, alert }: {
  label:string; value:number; href:string; alert?:boolean;
}) {
  return (
    <Link to={href} className="group min-w-0 flex-1 rounded-small px-3 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-5">
      <p className={cn("text-2xl font-semibold tabular-nums tracking-tight",alert&&value>0&&"text-destructive")}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground">{label}</p>
    </Link>
  );
}

export default function Dashboard() {
  const { currentWorkspace } = useWorkspace();
  const { data, isLoading, isError, refetch, isFetching } = useStudioDashboard();
  const overview = useMemo(()=>data?buildStudioOverview(data):null,[data]);
  const nextAttention = overview
    ? [...overview.overdueTasks.slice(0,3).map(item=>({
        id:item.id, to:`/projects/${item.project_id}?task=${item.id}`,
        title:item.title,detail:item.project_name,date:dateShort(item.due_date),urgent:true,
      })),
      ...overview.pendingApprovals.slice(0,3).map(item=>({
        id:item.id,to:`/projects/${item.project_id}?tab=deliverables`,
        title:item.title,detail:`${overview.projectName(item.project_id)} · Awaiting client review`,date:"In review",urgent:false,
      }))]
    : [];

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">{currentWorkspace?.name??"Your workspace"}</p>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight sm:text-[30px]">Your studio, at a glance.</h1>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
            A clear view of what is moving and what needs a decision.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={()=>void refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-1.5 h-4 w-4",isFetching&&"animate-spin")} aria-hidden="true"/> Refresh
        </Button>
      </header>

      {isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-28 w-full rounded-panel"/>
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-panel"/><Skeleton className="h-72 rounded-panel"/>
          </div>
          <Skeleton className="h-56 rounded-panel"/>
        </div>
      ) : isError || !overview ? <ErrorState onRetry={()=>void refetch()}/> : (
        <>
          <div className="rounded-panel border border-border bg-card p-2 shadow-subtle">
            <div className="grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <Stat label="Projects in progress" value={overview.activeProjects.length} href="/projects"/>
              <Stat label="Open tasks" value={overview.openTasks.length} href="/tasks?view=all"/>
              <Stat label="Overdue" value={overview.overdueTasks.length} href="/tasks?view=overdue" alert/>
              <Stat label="Awaiting approval" value={overview.pendingApprovals.length} href="/projects"/>
            </div>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section className="min-w-0" aria-label="Priority action queue">
              <Heading eyebrow="01 · Your focus" title="Needs attention" to="/tasks" linkText="Open tasks"/>
              <Card className="overflow-hidden rounded-panel border border-border shadow-subtle">
                {nextAttention.length ? (
                  <div className="divide-y divide-border">
                    {nextAttention.map(item=><AttentionLink key={item.id} {...item}/>)}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                    <CheckCircle2 className="h-5 w-5 text-primary"/>
                    <p className="text-sm font-semibold">Nothing urgent needs attention.</p>
                    <p className="text-xs text-muted-foreground">Overdue tasks and client approvals appear here.</p>
                  </div>
                )}
                <Link to="/inbox" className="flex items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-3 text-xs font-semibold text-primary hover:bg-muted/40">
                  <span className="inline-flex items-center gap-2"><Inbox className="h-4 w-4"/> Open team Inbox</span>
                  <ArrowRight className="h-4 w-4"/>
                </Link>
              </Card>
            </section>

            <section className="min-w-0" aria-label="Upcoming deadlines">
              <Heading eyebrow="02 · Timeline" title="Coming up" to="/tasks?view=upcoming" linkText="View schedule"/>
              <Card className="overflow-hidden rounded-panel border border-border shadow-subtle">
                {overview.upcoming.length ? (
                  <div className="divide-y divide-border">
                    {overview.upcoming.slice(0,6).map(item=><UpcomingRow key={item.kind+item.id} item={item}/>)}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                    <CalendarDays className="h-5 w-5 text-muted-foreground"/>
                    <p className="text-sm font-medium">No deadlines in the next 14 days</p>
                    <p className="text-xs text-muted-foreground">Project, task and milestone due dates appear here.</p>
                  </div>
                )}
              </Card>
            </section>
          </div>

          <section aria-label="Active project progress">
            <Heading eyebrow="03 · Work in motion" title="Active projects" to="/projects" linkText="All projects"/>
            {overview.featuredProjects.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {overview.featuredProjects.slice(0,6).map(project=>{
                  const progress=overview.projectProgress(project.id);
                  return <Link key={project.id} to={`/projects/${project.id}`}
                    className="group rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <Card className="h-full rounded-panel border border-border p-5 shadow-subtle transition-colors hover:border-primary/30">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <h3 className="min-w-0 truncate text-sm font-semibold group-hover:text-primary">{project.name}</h3>
                        <span className={cn("shrink-0 rounded-pill px-2 py-1 text-[11px] font-medium",
                          project.health==="blocked"?"bg-destructive/10 text-destructive":
                          project.health==="at_risk"?"bg-amber-500/10 text-amber-700":"bg-secondary text-muted-foreground")}>
                          {project.health==="blocked"?"Blocked":project.health==="at_risk"?"At risk":"On track"}
                        </span>
                      </div>
                      <div className="mt-6 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{progress.total?`${progress.completed} / ${progress.total} tasks`:"No tasks yet"}</span>
                        <span className="font-semibold tabular-nums">{progress.percent}%</span>
                      </div>
                      <Progress className="mt-2 h-1.5" value={progress.percent}/>
                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5"/>{project.due_date?dateShort(project.due_date):"No due date"}</span>
                        <ArrowUpRight className="h-4 w-4"/>
                      </div>
                    </Card>
                  </Link>;
                })}
              </div>
            ) : <Card className="rounded-panel p-8 text-center">
              <FolderKanban className="mx-auto h-5 w-5 text-muted-foreground"/>
              <p className="mt-2 text-sm font-semibold">No active projects yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Set a project's status to active to track it here.</p>
              <Button variant="outline" size="sm" className="mt-4" asChild><Link to="/projects">View projects</Link></Button>
            </Card>}
          </section>

          {overview.recentActivity.length>0 && (
            <section aria-label="Project activity">
              <Heading eyebrow="04 · Recent updates" title="What changed" />
              <Card className="divide-y divide-border overflow-hidden rounded-panel border border-border shadow-subtle">
                {overview.recentActivity.slice(0,5).map(item=>(
                  <Link key={item.id} to={`/projects/${item.project_id}?tab=activity`}
                    className="flex min-w-0 items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-muted/30">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"/>
                    <span className="min-w-0 flex-1 truncate">{activityDescription(item)}</span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{overview.projectName(item.project_id)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.created_at)}</span>
                  </Link>
                ))}
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
