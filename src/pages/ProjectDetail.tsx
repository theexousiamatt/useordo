import { InviteMemberDrawer } from "@/components/team/InviteMemberDrawer";
import { useTeam } from "@/hooks/useTeam";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HealthBadge, StatusBadge } from "@/components/projects/ProjectBadges";
import { MemberAvatars } from "@/components/projects/MemberAvatars";
import { ProjectBoard } from "@/components/projects/ProjectBoard";
import { MilestonesTab } from "@/components/projects/MilestonesTab";
import { DeliverablesTab } from "@/components/projects/DeliverablesTab";
import { ActivityTab } from "@/components/projects/ActivityTab";
import { FilesTab } from "@/components/projects/FilesTab";
import { ProjectSettingsDrawer } from "@/components/projects/ProjectSettingsDrawer";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { DuplicateProjectDialog } from "@/components/projects/DuplicateProjectDialog";
import {
  ProjectOverflowMenu,
  type ProjectMenuHandlers,
} from "@/components/projects/ProjectActionsMenu";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import {
  useProject,
  useProjectMembers,
  useAssignableMembers,
  useProjectTasks,
} from "@/hooks/useProjectData";
import {
  useArchiveProject,
  useUpdateProject,
  type ProjectRow,
} from "@/hooks/useProjects";

import { dateShort } from "@/lib/format";
import { projectUrl } from "@/lib/appUrl";


export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkedTaskId = searchParams.get("task");
  const { data: project, isLoading, isError, error: projectError, refetch } = useProject(id);
  const { data: members = [] } = useProjectMembers(id);
  const { data: assignableMembers = [] } = useAssignableMembers(id);
  const { data: tasks = [], isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = useProjectTasks(id);
  const perms = useProjectPermissions(project);
  const archiveProject = useArchiveProject();
  const updateProject = useUpdateProject();
  const { currentWorkspace, role } = useWorkspace();
  const { inviteMembers, busy: inviteBusy } = useTeam();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const handlers: ProjectMenuHandlers = {
    onOpen: () => {},
    onSettings: () => setSettingsOpen(true),
    onDuplicate: () => setDuplicateOpen(true),
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
    onCopyLink: async (p) => {
      try { await navigator.clipboard.writeText(projectUrl(p.id)); toast.success("Link copied."); }
      catch { toast.error("Couldn’t copy the link. You can copy this page’s address from your browser."); }
    },
    onDelete: () => setDeleteOpen(true),
  };


  if (isError) {
    return (
      <div>
        <BackButton onClick={() => navigate("/projects")} />
        <ErrorState title={projectError?.message === "Project not found" ? "Project unavailable" : "Couldn’t load project"}
          description={projectError?.message === "Project not found" ? "This project may have been removed or your access may have changed. Return to Projects to see what is available." : undefined}
          onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <BackButton onClick={() => navigate("/projects")} />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <BackButton onClick={() => navigate("/projects")} />

      <div className="mb-3 flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="max-w-3xl break-words text-[clamp(1.6rem,2vw,2rem)] font-semibold tracking-[-.025em]">{project.name}</h1>
            <StatusBadge status={project.status} />
            <HealthBadge health={project.health} />
            {project.archived_at && <Badge variant="secondary">Archived</Badge>}
          </div>

          {project.description && (
            <p className="max-w-2xl line-clamp-2 break-words text-sm text-muted-foreground">{project.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {project.due_date && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Due {dateShort(project.due_date)}
              </span>
            )}
            {members.length > 0 && <MemberAvatars members={members} size="sm" />}
            {!tasksLoading && !tasksError && <span className="text-sm text-muted-foreground">{tasks.filter((task) => task.status === "done").length} of {tasks.length} tasks done</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(role === "owner" || role === "manager") && <Button variant="outline" onClick={() => setInviteOpen(true)}>Invite client</Button>}
          <ProjectOverflowMenu
            project={project as ProjectRow}
            perms={perms}
            handlers={handlers}
            trigger={
              <Button variant="outline" size="icon" aria-label="Project actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>


      <Tabs defaultValue="board" className="min-w-0">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-3 min-w-0">
          {tasksLoading ? <div className="flex gap-4 overflow-hidden" role="status" aria-label="Loading tasks"><Skeleton className="h-80 w-72 shrink-0" /><Skeleton className="h-80 w-72 shrink-0" /><Skeleton className="h-80 w-72 shrink-0" /></div> : tasksError ? <ErrorState title="Couldn’t load tasks" description="Your project is available, but its tasks could not be loaded. Check your connection and try again." onRetry={() => refetchTasks()} /> : <ProjectBoard
            projectId={project.id}
            workspaceId={project.workspace_id}
            tasks={tasks}
            members={assignableMembers}
            initialTaskId={deepLinkedTaskId}
            canEdit={(role === "owner" || role === "manager" || role === "member") && !project.archived_at}
          />}
        </TabsContent>
        <TabsContent value="milestones" className="mt-6">
          <MilestonesTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="deliverables" className="mt-6">
          <DeliverablesTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="files" className="mt-6">
          <FilesTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="activity" className="mt-6">
          <ActivityTab projectId={project.id} />
        </TabsContent>
      </Tabs>

      <InviteMemberDrawer open={inviteOpen} onOpenChange={setInviteOpen} initialRole="client" initialProjectId={id}
        projects={[{ id: project.id, name: project.name }]} workspaceName={currentWorkspace?.name ?? "your agency"}
        onInvite={inviteMembers} busy={inviteBusy} />
      <ProjectSettingsDrawer
        project={project as ProjectRow}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        canManage={perms.canManage}
      />
      <DeleteProjectDialog
        project={project as ProjectRow}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => navigate("/projects")}
      />
      <DuplicateProjectDialog
        project={project as ProjectRow}
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        onDuplicated={(id) => navigate(`/projects/${id}`)}
      />
    </div>
  );
}


function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="mb-1 -ml-2 text-muted-foreground">
      <ArrowLeft className="mr-1.5 h-4 w-4" /> Projects
    </Button>
  );
}
