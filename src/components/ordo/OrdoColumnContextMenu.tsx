import { type ReactNode } from "react";
import {
  Pencil,
  Palette,
  ArrowLeftRight,
  ChevronsDownUp,
  Plus,
  ListPlus,
  Sparkles,
  Wand2,
  Activity,
  FileText,
  Bot,
  GitMerge,
  Workflow,
  Copy,
  Archive,
  Trash2,
} from "lucide-react";
import { OrdoContextMenu, OrdoOverflowMenu, type OrdoMenuConfig } from "./OrdoMenu";
import type { TaskStatus } from "@/lib/projectConstants";

export interface ColumnMenuHandlers {
  onAddTask: (status: TaskStatus) => void;
  onToggleCollapse: (status: TaskStatus) => void;
  onAction: (status: TaskStatus, action: string) => void;
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
        { id: "rename", label: "Rename column", icon: Pencil, onSelect: () => h.onAction(status, "Rename column") },
        { id: "color", label: "Change color", icon: Palette, onSelect: () => h.onAction(status, "Change color") },
        { id: "reorder", label: "Reorder column", icon: ArrowLeftRight, onSelect: () => h.onAction(status, "Reorder column") },
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
        { id: "bulk-add", label: "Bulk add tasks", icon: ListPlus, onSelect: () => h.onAction(status, "Bulk add tasks") },
      ],
    },
    {
      id: "ai",
      label: "AI actions",
      items: [
        { id: "ai-generate", label: "Generate tasks for column", icon: Sparkles, ai: true, onSelect: () => h.onAction(status, "Generate tasks for column") },
        { id: "ai-suggest", label: "Suggest missing tasks", icon: Wand2, ai: true, onSelect: () => h.onAction(status, "Suggest missing tasks") },
        { id: "ai-bottleneck", label: "Analyze bottlenecks", icon: Activity, ai: true, onSelect: () => h.onAction(status, "Analyze bottlenecks") },
        { id: "ai-summary", label: "Summarize column progress", icon: FileText, ai: true, onSelect: () => h.onAction(status, "Summarize column progress") },
      ],
    },
    {
      id: "automation",
      label: "Automation",
      items: [
        { id: "auto-assign", label: "Create auto-assign rule", icon: Bot, onSelect: () => h.onAction(status, "Create auto-assign rule") },
        { id: "auto-move", label: "Create auto-move rule", icon: GitMerge, onSelect: () => h.onAction(status, "Create auto-move rule") },
        { id: "workflow", label: "Create workflow rule", icon: Workflow, onSelect: () => h.onAction(status, "Create workflow rule") },
      ],
    },
    {
      id: "management",
      label: "Management",
      items: [
        { id: "duplicate", label: "Duplicate column", icon: Copy, onSelect: () => h.onAction(status, "Duplicate column") },
        { id: "archive", label: "Archive column", icon: Archive, onSelect: () => h.onAction(status, "Archive column") },
        { id: "delete", label: "Delete column", icon: Trash2, destructive: true, onSelect: () => h.onAction(status, "Delete column") },
      ],
    },
  ];
}

export function OrdoColumnContextMenu({
  status,
  collapsed,
  handlers,
  children,
}: {
  status: TaskStatus;
  collapsed: boolean;
  handlers: ColumnMenuHandlers;
  children: ReactNode;
}) {
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
