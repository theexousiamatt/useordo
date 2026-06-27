import { type ReactNode } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  Archive,
  Trash2,
  Pencil,
  PanelRightOpen,
  ExternalLink,
  RotateCcw,
  UserPlus,
  CalendarClock,
  Flag,
  Tag,
  MessageSquarePlus,
  Link2,
} from "lucide-react";
import { OrdoContextMenu, OrdoOverflowMenu, type OrdoMenuConfig } from "./OrdoMenu";
import { TASK_COLUMNS, PRIORITIES, type TaskStatus, type TaskPriority } from "@/lib/projectConstants";
import type { TaskRow } from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";

export interface TaskMenuHandlers {
  onOpen: (task: TaskRow) => void;
  onQuickEdit: (task: TaskRow) => void;
  onRename: (task: TaskRow) => void;
  onMoveStatus: (task: TaskRow, status: TaskStatus) => void;
  onDuplicate: (task: TaskRow) => void;
  onMarkComplete: (task: TaskRow) => void;
  onReopen: (task: TaskRow) => void;
  onAssign: (task: TaskRow, userId: string | null) => void;
  onSetPriority: (task: TaskRow, priority: TaskPriority) => void;
  onCopyLink: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
  /** AI + not-yet-wired power actions funnel here. */
  onAction: (task: TaskRow, action: string) => void;
}

/** Build the canonical task action menu. Reused by right-click and overflow. */
export function buildTaskMenuConfig(
  task: TaskRow,
  members: ProjectMemberProfile[],
  h: TaskMenuHandlers,
): OrdoMenuConfig {
  const isDone = task.status === "done";
  return [
    {
      id: "open",
      items: [
        { id: "open-task", label: "Open task", icon: PanelRightOpen, shortcut: "↵", onSelect: () => h.onOpen(task) },
        { id: "quick-edit", label: "Quick edit", icon: Pencil, shortcut: "E", onSelect: () => h.onQuickEdit(task) },
        { id: "rename", label: "Rename", icon: ExternalLink, onSelect: () => h.onRename(task) },
      ],
    },
    {
      id: "workflow",
      label: "Workflow",
      items: [
        {
          id: "move-to",
          label: "Move to…",
          icon: ArrowRightLeft,
          shortcut: "M",
          submenu: TASK_COLUMNS.filter((c) => c.id !== task.status).map((c) => ({
            id: `move-${c.id}`,
            label: c.title,
            onSelect: () => h.onMoveStatus(task, c.id),
          })),
        },
        { id: "duplicate", label: "Duplicate", icon: Copy, shortcut: "D", onSelect: () => h.onDuplicate(task) },
        isDone
          ? { id: "reopen", label: "Reopen", icon: RotateCcw, onSelect: () => h.onReopen(task) }
          : { id: "complete", label: "Mark complete", icon: CheckCircle2, onSelect: () => h.onMarkComplete(task) },
      ],
    },
    {
      id: "planning",
      label: "Planning",
      items: [
        {
          id: "assign",
          label: "Assign member",
          icon: UserPlus,
          shortcut: "A",
          submenu: [
            { id: "assign-none", label: "Unassigned", onSelect: () => h.onAssign(task, null) },
            ...members.map((m) => ({
              id: `assign-${m.user_id}`,
              label: m.full_name ?? "Member",
              onSelect: () => h.onAssign(task, m.user_id),
            })),
          ],
        },
        { id: "due-date", label: "Set due date", icon: CalendarClock, onSelect: () => h.onQuickEdit(task) },
        {
          id: "priority",
          label: "Change priority",
          icon: Flag,
          shortcut: "P",
          submenu: PRIORITIES.map((p) => ({
            id: `prio-${p.value}`,
            label: p.label,
            onSelect: () => h.onSetPriority(task, p.value),
          })),
        },
        { id: "label", label: "Add label", icon: Tag, shortcut: "L", onSelect: () => h.onAction(task, "Add label") },
      ],
    },
    {
      id: "comms",
      label: "Collaboration",
      items: [
        { id: "comment", label: "Add comment", icon: MessageSquarePlus, onSelect: () => h.onAction(task, "Add comment") },
        { id: "copy-link", label: "Copy task link", icon: Link2, onSelect: () => h.onCopyLink(task) },
      ],
    },

    {
      id: "danger",
      items: [
        { id: "archive", label: "Archive", icon: Archive, onSelect: () => h.onAction(task, "Archive") },
        { id: "delete", label: "Delete", icon: Trash2, shortcut: "⌦", destructive: true, onSelect: () => h.onDelete(task) },
      ],
    },
  ];
}

export function OrdoCardContextMenu({
  task,
  members,
  handlers,
  children,
}: {
  task: TaskRow;
  members: ProjectMemberProfile[];
  handlers: TaskMenuHandlers;
  children: ReactNode;
}) {
  return (
    <OrdoContextMenu config={buildTaskMenuConfig(task, members, handlers)}>{children}</OrdoContextMenu>
  );
}

export function OrdoCardOverflowMenu({
  task,
  members,
  handlers,
  trigger,
}: {
  task: TaskRow;
  members: ProjectMemberProfile[];
  handlers: TaskMenuHandlers;
  trigger: ReactNode;
}) {
  return <OrdoOverflowMenu config={buildTaskMenuConfig(task, members, handlers)} trigger={trigger} />;
}
