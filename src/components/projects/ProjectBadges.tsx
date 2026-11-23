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


export function DeliverableBadge({ status, requiresApproval = true }: { status: string; requiresApproval?: boolean }) {
  const label = {
    draft: requiresApproval ? "Draft for client review" : "Awaiting studio sign-off",
    submitted: requiresApproval ? "Awaiting client approval" : "Awaiting studio sign-off",
    approved: requiresApproval ? "Approved" : "Signed off by studio",
    rejected: "Changes requested",
  }[status as DeliverableStatus] ?? "Shared";
  return (
    <Badge variant="outline" className={cn("border-transparent text-sm font-semibold", DELIVERABLE_STATUS_STYLES[status as DeliverableStatus])}>
      {label}
    </Badge>
  );
}
