import { InviteMemberDrawer } from "@/components/team/InviteMemberDrawer";
import { useTeam } from "@/hooks/useTeam";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Archive, CalendarDays, Copy, Download, Layers, Link2, MoreHorizontal, Settings2, Users } from "lucide-react";
import { toast } from "sonner";
import { NotificationButton } from "@/components/client/NotificationButton";
import { JerinProjectOverview, JerinProjectSummary } from "@/components/projects/JerinProjectOverview";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { computeProjectCompletion } from "@/lib/taskCompletion";
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
import { ProjectTeamDrawer } from "@/components/projects/ProjectTeamDrawer";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = ["overview", "board", "files", "activity", "deliverables", "milestones"];
  const requestedTab = searchParams.get("tab");
  const tab = requestedTab && tabs.includes(requestedTab)
    ? requestedTab
    : searchParams.has("task") || !window.matchMedia("(max-width: 767px)").matches ? "board" : "overview";
  const changeTab = (value: string) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    next.set("tab", value);
    if (value !== "board") next.delete("task");
    return next;
  });
  const deepLinkedTaskId = searchParams.get("task");
  const { data: project, isLoading, isError, refetch } = useProject(id);
  const { data: members = [] } = useProjectMembers(id);
  const { data: assignableMembers = [] } = useAssignableMembers(id);
  const { data: tasks = [], isSuccess: tasksLoaded } = useProjectTasks(id);
  const completion = computeProjectCompletion(tasks);
  const completionLoaded = tasksLoaded;
  const perms = useProjectPermissions(project);
  const archiveProject = useArchiveProject();
  const updateProject = useUpdateProject();
  const { currentWorkspace, role } = useWorkspace();
  const { inviteMembers, busy: inviteBusy } = useTeam();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [projectTeamOpen, setProjectTeamOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [stageToolsRequested, setStageToolsRequested] = useState(false);

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
      try {
        await navigator.clipboard.writeText(projectUrl(p.id));
        toast.success("Link copied.");
      } catch {
        toast.error("Could not copy the project link.");
      }
    },
    onDelete: () => setDeleteOpen(true),
  };


  if (isError) {
    return (
      <div className="px-5 pt-5 md:p-0">
        <BackButton onClick={() => navigate("/projects")} />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className="space-y-6 px-5 pt-5 md:p-0">
        <BackButton onClick={() => navigate("/projects")} />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="jerin-project-detail" data-tab={tab}>
      <header className="jerin-project-mobile-header md:hidden">
        <button type="button" aria-label="Back to projects" onClick={() => navigate("/projects")}>
          <img src="/jenri/project-detail/back.svg" alt="" />
        </button>
        {tab === "overview" ? <img src="/jenri/jerin-logo-light-surface.svg" width={110} height={38} alt="Jerin" /> : (
          <div className="jerin-project-mobile-name"><h1>{project.name}</h1><p>{currentWorkspace?.name}</p></div>
        )}
        <NotificationButton icon="/jenri/project-detail/notification.svg" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Project actions"><img src="/jenri/project-detail/more.svg" alt="" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="client-os jerin-project-menu" align="end">
            {perms.canManage && <>
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}><Settings2 />Project settings</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setProjectTeamOpen(true)}><Users />Manage members</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { changeTab("board"); setStageToolsRequested(true); }}><Layers />Stages &amp; workflow</DropdownMenuItem>
            </>}
            <DropdownMenuItem onSelect={() => exportProject(project, tasks)}><Download />Export project</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handlers.onCopyLink(project)}><Link2 />Copy project link</DropdownMenuItem>
            {perms.canDuplicate && <DropdownMenuItem onSelect={() => setDuplicateOpen(true)}><Copy />Duplicate project</DropdownMenuItem>}
            {perms.canManage && <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={project.archived_at ? undefined : "text-destructive"} onSelect={() => {
                if (project.archived_at) void handlers.onRestore(project);
                else void handlers.onArchive(project);
              }}><Archive />{project.archived_at ? "Restore project" : "Archive project"}</DropdownMenuItem>
            </>}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      {tab === "overview" && <>
        <div className="jerin-project-mobile-intro md:hidden">
          <h1>{project.name}</h1>
          {project.description && <p>{project.description}</p>}
        </div>
        <div className="jerin-mobile-project-summary md:hidden"><JerinProjectSummary project={project} members={members.length} /></div>
      </>}
      <div className="hidden md:block"><BackButton onClick={() => navigate("/projects")} /></div>

      <div className="mb-6 hidden md:flex flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <StatusBadge status={project.status} />
            <HealthBadge health={project.health} />
            {project.archived_at && <Badge variant="secondary">Archived</Badge>}
          </div>

          {project.description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{project.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            {project.due_date && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Due {dateShort(project.due_date)}
              </span>
            )}
            {members.length > 0 && <MemberAvatars members={members} />}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-full max-w-xs space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Tasks completed</span>
              <span className="font-medium tabular-nums">
                {completionLoaded && completion.total > 0
                  ? `${completion.completed}/${completion.total} · ${completion.percent}%`
                  : completionLoaded ? "No tasks" : "—"}
              </span>
            </div>
            {completionLoaded && completion.total > 0 && <Progress value={completion.percent} className="h-2" />}
          </div>
          {perms.canManage && <Button variant="outline" onClick={() => setProjectTeamOpen(true)}>Add teammates</Button>}
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


      <Tabs value={tab} onValueChange={changeTab} className="min-w-0">
        <div className="jerin-project-tabs-scroll">
          <TabsList className="jerin-project-tabs" aria-label="Project views">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-4">
          <JerinProjectOverview project={project} tasks={tasks} completion={completion} loading={!completionLoaded} />
        </TabsContent>
        <TabsContent value="board" className="mt-6">
          <ProjectBoard
            projectId={project.id}
            workspaceId={project.workspace_id}
            tasks={tasks}
            members={assignableMembers}
            initialTaskId={deepLinkedTaskId}
            showStageTools={stageToolsRequested}
            onStageToolsShown={() => setStageToolsRequested(false)}
            canConfigureStages={perms.canManage}
          />
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
      {perms.canManage && <ProjectTeamDrawer
        project={project as ProjectRow}
        open={projectTeamOpen}
        onOpenChange={setProjectTeamOpen}
      />}
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
    <Button variant="ghost" size="sm" onClick={onClick} className="mb-4 -ml-2 text-muted-foreground">
      <ArrowLeft className="mr-1.5 h-4 w-4" /> Projects
    </Button>
  );
}

function exportProject(project: ProjectRow, tasks: ReturnType<typeof useProjectTasks>["data"]) {
  const content = JSON.stringify({
    name: project.name,
    description: project.description,
    status: project.status,
    dueDate: project.due_date,
    tasks: (tasks ?? []).filter(task => !task.archived_at).map(task => ({
      title: task.title, description: task.description, dueDate: task.due_date, completedAt: task.completed_at,
    })),
  }, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "project"}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
