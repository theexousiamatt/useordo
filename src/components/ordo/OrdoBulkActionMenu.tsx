import {
  UserPlus,
  ArrowRightLeft,
  CircleDot,
  Tag,
  Archive,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrdoOverflowMenu, type OrdoMenuConfig } from "./OrdoMenu";
import { TASK_COLUMNS, type TaskStatus } from "@/lib/projectConstants";
import type { ProjectMemberProfile } from "@/hooks/useProjects";

export interface BulkActionHandlers {
  onAssign: (userId: string | null) => void;
  onMove: (status: TaskStatus) => void;
  onSetStatus: (status: TaskStatus) => void;
  onDelete: () => void;
  onAction: (action: string) => void;
}

/**
 * Floating bulk-action bar shown when multiple cards are selected.
 * Reusable across any multi-select surface (tasks, files, clients…).
 */
export function OrdoBulkActionMenu({
  count,
  members,
  handlers,
  onClear,
}: {
  count: number;
  members: ProjectMemberProfile[];
  handlers: BulkActionHandlers;
  onClear: () => void;
}) {
  if (count === 0) return null;

  const assignMenu: OrdoMenuConfig = [
    {
      id: "assign",
      items: [
        { id: "none", label: "Unassigned", onSelect: () => handlers.onAssign(null) },
        ...members.map((m) => ({
          id: m.user_id,
          label: m.full_name ?? "Member",
          onSelect: () => handlers.onAssign(m.user_id),
        })),
      ],
    },
  ];

  const moveMenu: OrdoMenuConfig = [
    {
      id: "move",
      items: TASK_COLUMNS.map((c) => ({
        id: c.id,
        label: c.title,
        onSelect: () => handlers.onMove(c.id),
      })),
    },
  ];

  const priorityMenu: OrdoMenuConfig = [
    {
      id: "priority",
      items: PRIORITIES.map((p) => ({
        id: p.value,
        label: p.label,
        onSelect: () => handlers.onSetPriority(p.value),
      })),
    },
  ];

  const trigger = (cls: string, icon: React.ReactNode, label: string) => (
    <Button variant="ghost" size="sm" className={cls}>
      {icon}
      <span className="ml-1.5">{label}</span>
    </Button>
  );

  const btnCls = "h-8 text-card-foreground hover:bg-muted";

  return (
    <div
      role="toolbar"
      aria-label={`${count} tasks selected`}
      className="client-os fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-pill border border-border bg-card px-2 py-1.5 shadow-hover animate-in slide-in-from-bottom-4"
    >
      <span className="ml-2 mr-1 rounded-pill bg-[hsl(178,100%,8%)] px-2.5 py-1 text-xs font-semibold text-white">
        {count} selected
      </span>

      <OrdoOverflowMenu config={assignMenu} trigger={trigger(btnCls, <UserPlus className="h-4 w-4" />, "Assign")} />
      <OrdoOverflowMenu config={moveMenu} trigger={trigger(btnCls, <ArrowRightLeft className="h-4 w-4" />, "Move")} />
      <OrdoOverflowMenu config={moveMenu} trigger={trigger(btnCls, <CircleDot className="h-4 w-4" />, "Status")} />
      <OrdoOverflowMenu config={priorityMenu} trigger={trigger(btnCls, <Flag className="h-4 w-4" />, "Priority")} />

      <Button variant="ghost" size="sm" className={btnCls} onClick={() => handlers.onAction("Add label")}>
        <Tag className="h-4 w-4" />
        <span className="ml-1.5">Label</span>
      </Button>
      <Button variant="ghost" size="sm" className={btnCls} onClick={() => handlers.onAction("Archive")}>
        <Archive className="h-4 w-4" />
        <span className="ml-1.5">Archive</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={handlers.onDelete}
      >
        <Trash2 className="h-4 w-4" />
        <span className="ml-1.5">Delete</span>
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear} aria-label="Clear selection">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
