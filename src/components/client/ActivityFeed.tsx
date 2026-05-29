import {
  Activity as ActivityIcon,
  MessageSquare,
  CheckCircle2,
  FileUp,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientActivity, type ActivityEntry } from "@/hooks/useClientDashboard";
import { timeAgo } from "@/lib/format";

const iconFor = (type: string) => {
  switch (type) {
    case "comment_added":
      return MessageSquare;
    case "milestone_completed":
    case "task_approved":
      return CheckCircle2;
    case "file_uploaded":
      return FileUp;
    case "project_created":
      return FolderPlus;
    default:
      return RefreshCw;
  }
};

const describe = (a: ActivityEntry): { title: string; detail?: string } => {
  const p = a.payload as Record<string, string>;
  switch (a.type) {
    case "comment_added":
      return { title: `New comment on ${p?.title ?? "a task"}`, detail: p?.body };
    case "milestone_completed":
      return { title: `Milestone "${p?.title ?? ""}" completed` };
    case "task_approved":
      return { title: `${p?.title ?? "A task"} was approved` };
    case "task_changes_requested":
      return { title: `Changes requested on ${p?.title ?? "a task"}` };
    case "file_uploaded":
      return { title: `New file uploaded: ${p?.name ?? "file"}` };
    case "task_created":
      return { title: `New task: ${p?.title ?? ""}` };
    case "project_created":
      return { title: `Project "${p?.name ?? ""}" created` };
    default:
      return { title: a.type.replace(/[._]/g, " ") };
  }
};

export function ActivityFeed({ limit = 8 }: { limit?: number }) {
  const { data, isLoading, isError, refetch } = useClientActivity(limit);

  return (
    <section className="rounded-panel bg-card p-6 shadow-panel" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="mb-4 text-lg font-semibold">
        Recent Activity
      </h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-small" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet"
          description="Updates across your projects will show up here."
        />
      ) : (
        <ul className="flex flex-col">
          {data.map((a) => {
            const Icon = iconFor(a.type);
            const { title, detail } = describe(a);
            return (
              <li
                key={a.id}
                className="flex gap-4 border-b border-border py-4 last:border-none last:pb-0"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{title}</p>
                  {detail && <p className="truncate text-sm text-muted-foreground">{detail}</p>}
                  <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
