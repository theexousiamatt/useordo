import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { ApprovalCard } from "./ApprovalCard";
import { useActionItems } from "@/hooks/useClientDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export function ActionCenter({ projectId }: { projectId?: string }) {
  const { data, isLoading, isError, refetch } = useActionItems(projectId);

  return (
    <section className="rounded-panel bg-card p-6 shadow-panel" aria-labelledby="action-center-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="action-center-heading" className="text-lg font-semibold">
          Ready for your review
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-small" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing needs your attention"
          description="Approvals and review requests will appear here when they're ready."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((item) => (
            <ApprovalCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
