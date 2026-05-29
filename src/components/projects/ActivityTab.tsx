import { Activity as ActivityIcon } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { useProjectActivity } from "@/hooks/useProjectData";
import { timeAgo } from "@/lib/format";

const ACTION_LABELS: Record<string, string> = {
  task_created: "created a task",
  task_status_changed: "moved a task",
  milestone_created: "added a milestone",
  milestone_status_changed: "updated a milestone",
  deliverable_created: "added a deliverable",
  deliverable_status_changed: "updated a deliverable",
  comment_added: "left a comment",
};

export function ActivityTab({ projectId }: { projectId: string }) {
  const { data: activity = [], isLoading } = useProjectActivity(projectId, 50);

  if (!isLoading && activity.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activity yet"
        description="Project activity will appear here as your team works."
      />
    );
  }

  return (
    <div className="space-y-1">
      {activity.map((a) => {
        const title = (a.metadata?.title as string) ?? "";
        return (
          <div key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/40">
            <div className="h-2 w-2 shrink-0 rounded-full bg-primary/60" />
            <p className="flex-1 text-sm">
              Someone {ACTION_LABELS[a.action] ?? a.action}
              {title && <span className="text-muted-foreground"> · {title}</span>}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
