import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DELIVERABLE_STATUS_STYLES,
  HEALTH_LABELS,
  HEALTH_STYLES,
  PROJECT_STATUS_STYLES,
  PROJECT_STATUSES,
  type DeliverableStatus,
  type ProjectHealth,
  type ProjectStatus,
} from "@/lib/projectConstants";

const statusLabel = (s: ProjectStatus) =>
  PROJECT_STATUSES.find((x) => x.value === s)?.label ?? s;

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", PROJECT_STATUS_STYLES[status])}>
      {statusLabel(status)}
    </Badge>
  );
}

export function HealthBadge({ health }: { health: ProjectHealth }) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", HEALTH_STYLES[health])}>
      {HEALTH_LABELS[health]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant="outline" className={cn("border-transparent text-xs capitalize", PRIORITY_STYLES[priority])}>
      {priority}
    </Badge>
  );
}

export function DeliverableBadge({ status }: { status: DeliverableStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent capitalize", DELIVERABLE_STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}
