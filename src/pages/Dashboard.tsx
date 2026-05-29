import { useNavigate } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import { ProjectOverviewCard } from "@/components/client/ProjectOverviewCard";
import { ActionCenter } from "@/components/client/ActionCenter";
import { ActivityFeed } from "@/components/client/ActivityFeed";
import { MilestoneTimeline } from "@/components/client/MilestoneTimeline";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientProjects } from "@/hooks/useClientDashboard";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { data: projects, isLoading, isError, refetch } = useClientProjects();

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {currentWorkspace ? `Welcome to ${currentWorkspace.name}` : "Your workspace"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's a calm overview of what's happening across your workspace.
        </p>
      </header>

      {/* Active projects */}
      <section aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="mb-4 text-lg font-semibold">
          Active Projects
        </h2>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-card" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !projects || projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Once you start a project, it will show up here."
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <ProjectOverviewCard
                key={p.id}
                project={p}
                onOpen={(id) => navigate(`/projects/${id}`)}
              />
            ))}
          </div>
        )}
      </section>

      <ActionCenter />

      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityFeed />
        <MilestoneTimeline />
      </div>
    </div>
  );
}
