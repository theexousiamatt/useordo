import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { toast } from "sonner";

export default function Projects() {
  return (
    <div>
      <PageHeader
        title="Projects"
        description="Plan, track, and deliver the work that matters."
        actions={
          <Button onClick={() => toast("Project creation is coming soon.")}>
            <Plus className="mr-1.5 h-4 w-4" /> New project
          </Button>
        }
      />
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Create your first project to start organizing tasks, deliverables, and timelines."
        actionLabel="Create a project"
        onAction={() => toast("Project creation is coming soon.")}
      />
    </div>
  );
}
