import { useNavigate } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import { ClientHeader } from "@/components/client/ClientHeader";
import { ProjectOverviewCard } from "@/components/client/ProjectOverviewCard";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientProjects } from "@/hooks/useClientDashboard";

export default function ClientProjects() {
  const navigate = useNavigate();
  const { data: projects, isLoading, isError, refetch } = useClientProjects();

  return (
    <>
      <ClientHeader title="Projects" subtitle="Everything you're collaborating on." />
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-card" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Your active projects will appear here."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectOverviewCard key={p.id} project={p} onOpen={(id) => navigate(`/client/projects/${id}`)} />
          ))}
        </div>
      )}
    </>
  );
}
