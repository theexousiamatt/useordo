import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import {
  ProjectOverflowMenu,
  type ProjectMenuHandlers,
} from "@/components/projects/ProjectActionsMenu";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import {
  useProject,
  useProjectMembers,
  useProjectTasks,
  useArchiveProject,
  useUpdateProject,
  type ProjectRow,
} from "@/hooks/useProjects";
import { dateShort } from "@/lib/format";


export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading, isError, refetch } = useProject(id);
  const { data: members = [] } = useProjectMembers(id);
  const { data: tasks = [] } = useProjectTasks(id);

  if (isError) {
    return (
      <div>
        <BackButton onClick={() => navigate("/projects")} />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <BackButton onClick={() => navigate("/projects")} />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div>
      <BackButton onClick={() => navigate("/projects")} />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <StatusBadge status={project.status} />
            <HealthBadge health={project.health} />
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

        <div className="w-full max-w-xs space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-2" />
        </div>
      </div>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-6">
          <ProjectBoard
            projectId={project.id}
            workspaceId={project.workspace_id}
            tasks={tasks}
            members={members}
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
