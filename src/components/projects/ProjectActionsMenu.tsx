import { type ReactNode } from "react";
import {
  PanelRightOpen,
  Pencil,
  Copy,
  CircleDot,
  Archive,
  ArchiveRestore,
  Trash2,
  Link2,
} from "lucide-react";
import { OrdoContextMenu, OrdoOverflowMenu, type OrdoMenuConfig } from "@/components/ordo/OrdoMenu";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/projectConstants";
import type { ProjectRow } from "@/hooks/useProjects";

export interface ProjectMenuHandlers {
  onOpen: (project: ProjectRow) => void;
  onSettings: (project: ProjectRow) => void;
  onDuplicate: (project: ProjectRow) => void;
  onSetStatus: (project: ProjectRow, status: ProjectStatus) => void;
  onArchive: (project: ProjectRow) => void;
  onRestore: (project: ProjectRow) => void;
  onCopyLink: (project: ProjectRow) => void;
  onDelete: (project: ProjectRow) => void;
}

export interface ProjectPermissions {
  /** Owner or manager — may edit settings, status, archive. */
  canManage: boolean;
  /** Owner-only — may permanently delete. */
  canDelete: boolean;
  /** Owner or manager — may duplicate the project. */
  canDuplicate: boolean;
}

/** Canonical project action menu, shared by right-click and overflow. */
export function buildProjectMenuConfig(
  project: ProjectRow,
  perms: ProjectPermissions,
  h: ProjectMenuHandlers,
): OrdoMenuConfig {
  const isArchived = !!project.archived_at;
  return [
    {
      id: "primary",
      items: [
        { id: "open", label: "Open project", icon: PanelRightOpen, shortcut: "↵", onSelect: () => h.onOpen(project) },
        { id: "edit", label: "Edit project", icon: Pencil, disabled: !perms.canManage, onSelect: () => h.onSettings(project) },
        { id: "duplicate", label: "Duplicate project", icon: Copy, disabled: !perms.canDuplicate, onSelect: () => h.onDuplicate(project) },
        { id: "copy-link", label: "Copy project link", icon: Link2, onSelect: () => h.onCopyLink(project) },
      ],
    },
    {
      id: "status",
      label: "Status",
      items: [
        {
          id: "set-status",
          label: "Change status",
          icon: CircleDot,
          disabled: !perms.canManage,
          submenu: PROJECT_STATUSES.filter((s) => s.value !== project.status).map((s) => ({
            id: `status-${s.value}`,
            label: s.label,
            onSelect: () => h.onSetStatus(project, s.value),
          })),
        },
      ],
    },
    {
      id: "danger",
      items: [
        isArchived
          ? {
              id: "restore",
              label: "Restore project",
              icon: ArchiveRestore,
              disabled: !perms.canManage,
              onSelect: () => h.onRestore(project),
            }
          : {
              id: "archive",
              label: "Archive project",
              icon: Archive,
              disabled: !perms.canManage,
              onSelect: () => h.onArchive(project),
            },
        {
          id: "delete",
          label: "Delete project",
          icon: Trash2,
          destructive: true,
          disabled: !perms.canDelete,
          onSelect: () => h.onDelete(project),
        },
      ],
    },
  ];
}

export function ProjectContextMenu({
  project,
  perms,
  handlers,
  children,
}: {
  project: ProjectRow;
  perms: ProjectPermissions;
  handlers: ProjectMenuHandlers;
  children: ReactNode;
}) {
  return (
    <OrdoContextMenu config={buildProjectMenuConfig(project, perms, handlers)}>{children}</OrdoContextMenu>
  );
}

export function ProjectOverflowMenu({
  project,
  perms,
  handlers,
  trigger,
}: {
  project: ProjectRow;
  perms: ProjectPermissions;
  handlers: ProjectMenuHandlers;
  trigger: ReactNode;
}) {
  return <OrdoOverflowMenu config={buildProjectMenuConfig(project, perms, handlers)} trigger={trigger} />;
}
