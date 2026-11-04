import { type ReactNode } from "react";
import { ChevronsDownUp, Plus } from "lucide-react";
import { OrdoContextMenu, OrdoOverflowMenu, type OrdoMenuConfig } from "./OrdoMenu";
import type { TaskStatus } from "@/lib/projectConstants";

export interface ColumnMenuHandlers {
  onAddTask: (status: TaskStatus) => void;
  onToggleCollapse: (status: TaskStatus) => void;
}

export function buildColumnMenuConfig(
  status: TaskStatus,
  collapsed: boolean,
  h: ColumnMenuHandlers,
): OrdoMenuConfig {
  return [
    {
      id: "column",
      label: "Column",
      items: [
        {
          id: "collapse",
          label: collapsed ? "Expand column" : "Collapse column",
          icon: ChevronsDownUp,
          onSelect: () => h.onToggleCollapse(status),
        },
      ],
    },
    {
      id: "tasks",
      label: "Tasks",
      items: [
        { id: "add", label: "Add task", icon: Plus, onSelect: () => h.onAddTask(status) },
      ],
    },
  ];
}

export function OrdoColumnContextMenu({
  status,
  collapsed,
  handlers,
  children,
  disabled = false,
}: {
  status: TaskStatus;
  collapsed: boolean;
  handlers: ColumnMenuHandlers;
  children: ReactNode;
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <OrdoContextMenu config={buildColumnMenuConfig(status, collapsed, handlers)}>
      {children}
    </OrdoContextMenu>
  );
}

export function OrdoColumnOverflowMenu({
  status,
  collapsed,
  handlers,
  trigger,
}: {
  status: TaskStatus;
  collapsed: boolean;
  handlers: ColumnMenuHandlers;
  trigger: ReactNode;
}) {
  return (
    <OrdoOverflowMenu config={buildColumnMenuConfig(status, collapsed, handlers)} trigger={trigger} align="start" />
  );
}
