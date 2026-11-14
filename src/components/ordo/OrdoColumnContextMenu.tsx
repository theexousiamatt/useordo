import { type ReactNode } from "react";
import { Pencil, ArrowLeftRight, ChevronsDownUp, Plus, Copy, Trash2, Palette, CheckCircle2 } from "lucide-react";
import { OrdoContextMenu, OrdoOverflowMenu, type OrdoMenuConfig } from "./OrdoMenu";

export interface ColumnMenuHandlers {
  onAddTask: (status: string) => void;
  onToggleCollapse: (status: string) => void;
  onAction: (status: string, action: string) => void;
}

/** Only offer actions that really work; manage-stage controls require project permissions. */
export function buildColumnMenuConfig(
  status: string,
  collapsed: boolean,
  h: ColumnMenuHandlers,
  canManageStages = true,
  canRemoveStage = true,
  isCompletion = false,
): OrdoMenuConfig {
  return [
    {
      id: "tasks",
      label: "Tasks",
      items: [
        { id: "add", label: "Add task", icon: Plus, onSelect: () => h.onAddTask(status) },
      ],
    },
    {
      id: "display",
      label: "Display",
      items: [
        { id: "collapse", label: collapsed ? "Expand stage" : "Collapse stage", icon: ChevronsDownUp,
          onSelect: () => h.onToggleCollapse(status) },
      ],
    },
    ...(canManageStages ? [{
      id: "management",
      label: "Manage stage",
      items: [
        { id: "rename", label: "Rename stage", icon: Pencil, onSelect: () => h.onAction(status, "Rename stage") },
        { id: "theme", label: "Change theme", icon: Palette, onSelect: () => h.onAction(status, "Change theme") },
        { id: "completion", label: isCompletion ? "Use as active stage" : "Mark as completion stage", icon: CheckCircle2,
          onSelect: () => h.onAction(status, isCompletion ? "Use as active stage" : "Mark as completion stage") },
        { id: "duplicate", label: "Duplicate stage", icon: Copy, onSelect: () => h.onAction(status, "Duplicate stage") },
        { id: "reorder", label: "Reorder stage", icon: ArrowLeftRight, onSelect: () => h.onAction(status, "Reorder stage") },
        { id: "delete", label: "Delete stage", icon: Trash2, destructive: true, disabled: !canRemoveStage,
          onSelect: () => h.onAction(status, "Delete stage") },
      ],
    }] : []),
  ];
}

export function OrdoColumnContextMenu({
  status, collapsed, handlers, children, canManageStages = true, canRemoveStage = true, isCompletion = false,
}: {
  status: string;
  collapsed: boolean;
  handlers: ColumnMenuHandlers;
  children: ReactNode;
  canManageStages?: boolean;
  canRemoveStage?: boolean;
  isCompletion?: boolean;
}) {
  return (
    <OrdoContextMenu config={buildColumnMenuConfig(status, collapsed, handlers, canManageStages, canRemoveStage, isCompletion)}>
      {children}
    </OrdoContextMenu>
  );
}

export function OrdoColumnOverflowMenu({
  status, collapsed, handlers, trigger, canManageStages = true, canRemoveStage = true, isCompletion = false,
}: {
  status: string;
  collapsed: boolean;
  handlers: ColumnMenuHandlers;
  trigger: ReactNode;
  canManageStages?: boolean;
  canRemoveStage?: boolean;
}) {
  return (
    <OrdoOverflowMenu
      config={buildColumnMenuConfig(status, collapsed, handlers, canManageStages, canRemoveStage)}
      trigger={trigger}
      align="start"
    />
  );
}
