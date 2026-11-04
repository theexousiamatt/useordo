import { type ReactNode } from "react";
import {
  Copy,
  Archive,
  Trash2,
  Pencil,
  PanelRightOpen,
  ArrowRightLeft,
  Users,
  CalendarClock,
  Tag,
  Link2,
  FolderInput,
} from "lucide-react";
import { OrdoContextMenu, OrdoOverflowMenu, type OrdoMenuConfig } from "./OrdoMenu";
import { TASK_COLUMNS, type TaskStatus } from "@/lib/projectConstants";
import type { TaskRow } from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";

export interface TaskMoveTarget {
  id: string;
  name: string;
}

export interface TaskMenuHandlers {
  onOpen: (task: TaskRow) => void;
  /** Begin inline rename on the card. */
  onRename: (task: TaskRow) => void;
  /** Open the anchored labels popover. */
  onEditLabels: (task: TaskRow) => void;
  /** Open the anchored members popover. */
  onEditMembers: (task: TaskRow) => void;
  /** Open the anchored due-date popover. */
  onEditDueDate: (task: TaskRow) => void;
  onMoveStatus: (task: TaskRow, status: TaskStatus) => void;
  onMovePosition?: (task: TaskRow, edge: "top" | "bottom") => void;
  /** Move to another project (only shown when targets are provided). */
  onMoveProject?: (task: TaskRow, projectId: string) => void;
  onDuplicate: (task: TaskRow) => void;
  onCopyLink: (task: TaskRow) => void;
  onArchive: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
}

/**
 * Canonical task action menu. Production-ready actions only — quick editing
 * lives on the board via inline popovers; the drawer is reserved for deep work.
 */
export function buildTaskMenuConfig(
  task: TaskRow,
  h: TaskMenuHandlers,
  moveTargets: TaskMoveTarget[] = [],
): OrdoMenuConfig {
  const statusSub = TASK_COLUMNS.filter((c) => c.id !== task.status).map((c) => ({
    id: `move-${c.id}`,
    label: c.title,
    onSelect: () => h.onMoveStatus(task, c.id),
  }));

  const positionItems = h.onMovePosition ? [
    { id: "move-top", label: "Top of this column", onSelect: () => h.onMovePosition?.(task, "top") },
    { id: "move-bottom", label: "Bottom of this column", onSelect: () => h.onMovePosition?.(task, "bottom") },
  ] : [];

  const moveItem = {
    id: "move-to",
    label: "Move to…",
    icon: ArrowRightLeft,
    submenu:
      h.onMoveProject && moveTargets.length > 0
        ? [
            ...statusSub,
            ...positionItems,
            {
              id: "move-project",
              label: "Another project",
              icon: FolderInput,
              submenu: moveTargets.map((p) => ({
                id: `move-project-${p.id}`,
                label: p.name,
                onSelect: () => h.onMoveProject?.(task, p.id),
              })),
            },
          ]
        : [...statusSub, ...positionItems],
  };

  return [
    {
      id: "primary",
      items: [
        { id: "open", label: "Open task", icon: PanelRightOpen, shortcut: "↵", onSelect: () => h.onOpen(task) },
        { id: "rename", label: "Rename", icon: Pencil, shortcut: "E", onSelect: () => h.onRename(task) },
        { id: "labels", label: "Labels", icon: Tag, shortcut: "L", onSelect: () => h.onEditLabels(task) },
        { id: "members", label: "Members", icon: Users, shortcut: "A", onSelect: () => h.onEditMembers(task) },
        { id: "due", label: "Due date", icon: CalendarClock, shortcut: "D", onSelect: () => h.onEditDueDate(task) },
        moveItem,
        { id: "duplicate", label: "Duplicate", icon: Copy, onSelect: () => h.onDuplicate(task) },
        { id: "copy-link", label: "Copy link", icon: Link2, onSelect: () => h.onCopyLink(task) },
      ],
    },
    {
      id: "danger",
      items: [
        { id: "archive", label: "Archive", icon: Archive, onSelect: () => h.onArchive(task) },
        { id: "delete", label: "Delete", icon: Trash2, shortcut: "⌦", destructive: true, onSelect: () => h.onDelete(task) },
      ],
    },
  ];
}

export function OrdoCardContextMenu({
  task,
  handlers,
  moveTargets,
  children,
  disabled = false,
}: {
  task: TaskRow;
  handlers: TaskMenuHandlers;
  moveTargets?: TaskMoveTarget[];
  children: ReactNode;
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <OrdoContextMenu config={buildTaskMenuConfig(task, handlers, moveTargets)}>{children}</OrdoContextMenu>
  );
}

export function OrdoCardOverflowMenu({
  task,
  handlers,
  moveTargets,
  trigger,
}: {
  task: TaskRow;
  handlers: TaskMenuHandlers;
  moveTargets?: TaskMoveTarget[];
  trigger: ReactNode;
}) {
  return <OrdoOverflowMenu config={buildTaskMenuConfig(task, handlers, moveTargets)} trigger={trigger} />;
}
