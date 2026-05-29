import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientMilestones } from "@/hooks/useClientDashboard";
import { dateShort } from "@/lib/format";

export function MilestoneTimeline({ limit = 6 }: { limit?: number }) {
  const { data, isLoading, isError, refetch } = useClientMilestones(limit);

  return (
    <section className="rounded-panel bg-card p-6 shadow-panel" aria-labelledby="milestones-heading">
      <h2 id="milestones-heading" className="mb-4 text-lg font-semibold">
        Upcoming Milestones
      </h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-small" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No milestones yet"
          description="Key dates for your projects will appear here."
        />
      ) : (
        <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-0.5 before:bg-border">
          {data.map((m) => (
            <li key={m.id} className="relative flex gap-4">
              <span
                className={cn(
                  "z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-foreground",
                  m.completed ? "bg-foreground" : "bg-card",
                )}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{m.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.completed
                    ? `Completed ${dateShort(m.completed_at ?? m.due_date)}`
                    : `${dateShort(m.due_date)}${m.project_name ? ` • ${m.project_name}` : ""}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
