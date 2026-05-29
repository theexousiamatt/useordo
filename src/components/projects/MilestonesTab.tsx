import { CheckCircle2, Circle, Flag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/states/EmptyState";
import { useProjectMilestones } from "@/hooks/useProjectData";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MilestonesTab({ projectId }: { projectId: string }) {
  const { data: milestones = [], isLoading } = useProjectMilestones(projectId);

  if (!isLoading && milestones.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        title="No milestones"
        description="Milestones mark key checkpoints in your project timeline."
      />
    );
  }

  return (
    <div className="space-y-3">
      {milestones.map((m) => {
        const done = m.status === "completed";
        return (
          <Card key={m.id} className="flex items-start gap-3 p-4">
            {done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium", done && "text-muted-foreground line-through")}>
                {m.title}
              </p>
              {m.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{m.description}</p>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{dateShort(m.due_date)}</span>
          </Card>
        );
      })}
    </div>
  );
}
