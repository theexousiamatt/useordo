import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingCards } from "@/components/states/LoadingState";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { HealthBadge, StatusBadge } from "@/components/projects/ProjectBadges";
import { MemberAvatars } from "@/components/projects/MemberAvatars";
import { useProjects, type ProjectWithMembers } from "@/hooks/useProjects";
import { dateShort } from "@/lib/format";

export default function Projects() {
  const navigate = useNavigate();
  const { data: projects, isLoading, isError, refetch } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Plan, track, and deliver the work that matters."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New project
          </Button>
        }
      />

      {isLoading ? (
        <LoadingCards count={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start organizing tasks, deliverables, and timelines."
          actionLabel="Create a project"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => navigate(`/projects/${p.id}`)} />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => navigate(`/projects/${id}`)}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: ProjectWithMembers;
  onOpen: () => void;
}) {
  return (
    <Card
      onClick={onOpen}
      className="group cursor-pointer p-5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium leading-tight group-hover:text-primary">{project.name}</h3>
        <HealthBadge health={project.health} />
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
  );
}
