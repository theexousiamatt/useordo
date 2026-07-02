import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, CalendarDays, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingCards } from "@/components/states/LoadingState";
import { CreateProjectDrawer } from "@/components/projects/CreateProjectDrawer";
import { ProjectSettingsDrawer } from "@/components/projects/ProjectSettingsDrawer";
import { DuplicateProjectDialog } from "@/components/projects/DuplicateProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import {
  ProjectContextMenu,
  ProjectOverflowMenu,
  type ProjectMenuHandlers,
} from "@/components/projects/ProjectActionsMenu";
import { HealthBadge, StatusBadge } from "@/components/projects/ProjectBadges";
import { MemberAvatars } from "@/components/projects/MemberAvatars";
import {
  useProjects,
  useArchiveProject,
  useUpdateProject,
  type ProjectWithMembers,
  type ProjectRow,
} from "@/hooks/useProjects";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { projectUrl } from "@/lib/appUrl";

export default function Projects() {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const { data: projects, isLoading, isError, refetch } = useProjects({ includeArchived: showArchived });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsProject, setSettingsProject] = useState<ProjectRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectRow | null>(null);

  const archiveProject = useArchiveProject();
  const updateProject = useUpdateProject();

  const handlers: ProjectMenuHandlers = {
    onOpen: (p) => navigate(`/projects/${p.id}`),
    onSettings: (p) => setSettingsProject(p),
    onDuplicate: (p) => setDuplicateTarget(p),
    onSetStatus: async (p, status) => {
      try {
        await updateProject.mutateAsync({ id: p.id, status });
        toast.success("Status updated.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update status.");
      }
    },
    onArchive: async (p) => {
      try {
        await archiveProject.mutateAsync({ id: p.id, archived: true });
        toast.success("Project archived.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to archive.");
      }
    },
    onRestore: async (p) => {
      try {
        await archiveProject.mutateAsync({ id: p.id, archived: false });
        toast.success("Project restored.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to restore.");
      }
    },
    onCopyLink: (p) => {
      navigator.clipboard.writeText(projectUrl(p.id));
      toast.success("Link copied.");
    },
    onDelete: (p) => setDeleteTarget(p),
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Plan, track, and deliver the work that matters."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className={cn(
                "rounded-pill border px-3 py-2 text-xs font-medium transition-colors",
                showArchived
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              {showArchived ? "Showing archived" : "Show archived"}
            </button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New project
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingCards count={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={showArchived ? "No archived projects" : "No projects yet"}
          description={
            showArchived
              ? "Projects you archive will appear here and can be restored anytime."
              : "Create your first project to start organizing tasks, deliverables, and timelines."
          }
          actionLabel={showArchived ? undefined : "Create a project"}
          onAction={showArchived ? undefined : () => setDialogOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              handlers={handlers}
              onOpen={() => navigate(`/projects/${p.id}`)}
            />
          ))}
        </div>
      )}

      <CreateProjectDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => navigate(`/projects/${id}`)}
      />

      {settingsProject && (
        <SettingsDrawerWithPerms
          project={settingsProject}
          open={!!settingsProject}
          onOpenChange={(o) => !o && setSettingsProject(null)}
        />
      )}

      {deleteTarget && (
        <DeleteProjectDialog
          project={deleteTarget}
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        />
      )}

      {duplicateTarget && (
        <DuplicateProjectDialog
          project={duplicateTarget}
          open={!!duplicateTarget}
          onOpenChange={(o) => !o && setDuplicateTarget(null)}
          onDuplicated={(id) => navigate(`/projects/${id}`)}
        />
      )}
    </div>
  );
}

function SettingsDrawerWithPerms({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { canManage } = useProjectPermissions(project);
  return (
    <ProjectSettingsDrawer
      project={project}
      open={open}
      onOpenChange={onOpenChange}
      canManage={canManage}
    />
  );
}

function ProjectCard({
  project,
  handlers,
  onOpen,
}: {
  project: ProjectWithMembers;
  handlers: ProjectMenuHandlers;
  onOpen: () => void;
}) {
  const perms = useProjectPermissions(project);
  return (
    <ProjectContextMenu project={project} perms={perms} handlers={handlers}>
      <Card
        onClick={onOpen}
        className={cn(
          "group relative cursor-pointer p-5 transition-colors hover:border-primary/40",
          project.archived_at && "opacity-70",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium leading-tight group-hover:text-primary">{project.name}</h3>
          <div className="flex items-center gap-1.5">
            <HealthBadge health={project.health} />
            <ProjectOverflowMenu
              project={project}
              perms={perms}
              handlers={handlers}
              trigger={
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-small p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary group-hover:opacity-100"
                  aria-label="Project actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              }
            />
          </div>
        </div>

        {project.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        )}

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-1.5" />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status} />
            {project.due_date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {dateShort(project.due_date)}
              </span>
            )}
          </div>
          {project.members.length > 0 && <MemberAvatars members={project.members} size="sm" />}
        </div>
      </Card>
    </ProjectContextMenu>
  );
}
