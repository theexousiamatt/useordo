import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ActionItem } from "@/hooks/useClientDashboard";

export function ApprovalCard({ item }: { item: ActionItem }) {
  return (
    <Link to={`/client/deliverables/${item.id}`}
      className="flex items-center justify-between gap-4 rounded-small border bg-card px-5 py-4 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary">Awaiting your approval</p>
        <p className="break-words text-base font-semibold">{item.title}</p>
        <p className="text-sm text-muted-foreground">{item.project_name}{item.source?.version_label ? ` · ${item.source.version_label}` : ""}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold">Review <ArrowRight aria-hidden="true" className="size-4" /></span>
    </Link>
  );
}
