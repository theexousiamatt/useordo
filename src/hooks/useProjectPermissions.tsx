import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { ProjectRow } from "@/hooks/useProjects";
import type { ProjectPermissions } from "@/components/projects/ProjectActionsMenu";

/**
 * MVP project access model:
 *   Owner   → full access (manage + delete)
 *   Manager → full project management (manage, not delete)
 *   Member  → view + tasks (no settings)
 *   Client  → assigned projects only (no internal management)
 *
 * Visibility is governed by workspace membership at the database layer; this
 * hook only resolves which *actions* the current user may take.
 */
export function useProjectPermissions(project?: Pick<ProjectRow, "owner_id"> | null): ProjectPermissions {
  const { user } = useAuth();
  const { role, currentWorkspace } = useWorkspace();

  const isProjectOwner = !!project && project.owner_id === user?.id;
  const isWorkspaceOwner = role === "owner" || currentWorkspace?.owner_id === user?.id;
  const isWorkspaceManager = role === "manager";

  const canManage = isWorkspaceOwner || isWorkspaceManager || isProjectOwner;
  const canDelete = isWorkspaceOwner || isProjectOwner;

  return { canManage, canDelete };
}
