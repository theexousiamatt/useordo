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
  Circle,
  CheckCircle2,
} from "lucide-react";
import { OrdoContextMenu, OrdoOverflowMenu, type OrdoMenuConfig } from "./OrdoMenu";
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
  onToggleCompleted: (task: TaskRow) => void;
  onMoveStage?: (task: TaskRow, stageId: string) => void;
  /** Move to another project (only shown when targets are provided). */
  onMoveProject?: (task: TaskRow, projectId: string) => void;
  onDuplicate: (task: TaskRow) => void;
  onCopyLink: (task: TaskRow) => void;
  onArchive: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
}

/**
 * Canonical task action menu. Production-ready actions only — quick editing
 * is available on the board and in the drawer through shared editing actions.
 */
export function buildTaskMenuConfig(
  task: TaskRow,
  h: TaskMenuHandlers,
  moveTargets: TaskMoveTarget[] = [],
  stages: {id:string;name:string}[] = [],
): OrdoMenuConfig {
  const stageTargets = stages.filter(stage=>stage.id!==task.stage_id)
    .map(stage=>({ id:`move-stage-${stage.id}`, label:stage.name,
      onSelect:()=>h.onMoveStage?.(task,stage.id) }));

  const moveItem = {
    id: "move-to",
    label: "Move to…",
    icon: ArrowRightLeft,
    shortcut: "M",
    submenu:
      h.onMoveProject && moveTargets.length > 0
        ? [
            ...stageTargets,
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
        : stageTargets,
  };

  return [
    {
      id: "primary",
      items: [
        { id: "open", label: "Open task", icon: PanelRightOpen, shortcut: "↵", onSelect: () => h.onOpen(task) },
        { id: "complete", label: task.completed_at ? "Reopen task" : "Mark complete",
          icon: task.completed_at ? Circle : CheckCircle2,
          onSelect:()=>h.onToggleCompleted(task) },
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
  stages,
  children,
}: {
  task: TaskRow;
  handlers: TaskMenuHandlers;
  moveTargets?: TaskMoveTarget[];
  stages?: {id:string;name:string}[];
  children: ReactNode;
}) {
  return (
    <OrdoContextMenu config={buildTaskMenuConfig(task, handlers, moveTargets, stages)}>{children}</OrdoContextMenu>
  );
}

export function OrdoCardOverflowMenu({
  task,
  handlers,
  moveTargets,
  stages,
  trigger,
}: {
  task: TaskRow;
  handlers: TaskMenuHandlers;
  moveTargets?: TaskMoveTarget[];
  stages?: {id:string;name:string}[];
  trigger: ReactNode;
}) {
  return <OrdoOverflowMenu config={buildTaskMenuConfig(task, handlers, moveTargets, stages)} trigger={trigger} />;
}
