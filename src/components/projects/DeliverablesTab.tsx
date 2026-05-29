import { Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/states/EmptyState";
import { DeliverableBadge } from "@/components/projects/ProjectBadges";
import { useProjectDeliverables } from "@/hooks/useProjectData";
import { dateShort } from "@/lib/format";
import type { DeliverableStatus } from "@/lib/projectConstants";

export function DeliverablesTab({ projectId }: { projectId: string }) {
  const { data: deliverables = [], isLoading } = useProjectDeliverables(projectId);

  if (!isLoading && deliverables.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No deliverables"
        description="Deliverables are the formal outputs you share with clients for review and approval."
      />
    );
  }

  return (
    <div className="space-y-3">
      {deliverables.map((d) => (
        <Card key={d.id} className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-medium">{d.title}</p>
            {d.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{d.description}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Created {dateShort(d.created_at)}</p>
          </div>
          <DeliverableBadge status={d.status as DeliverableStatus} />
        </Card>
      ))}
    </div>
  );
}
