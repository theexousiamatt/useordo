import { CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { toast } from "sonner";

export default function Tasks() {
  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Your focused list of what needs doing next."
        actions={
          <Button onClick={() => toast("Task creation is coming soon.")}>
            <Plus className="mr-1.5 h-4 w-4" /> New task
          </Button>
        }
      />
      <EmptyState
        icon={CheckSquare}
        title="No tasks yet"
        description="Tasks you create or get assigned will appear here, prioritized and easy to scan."
        actionLabel="Add a task"
        onAction={() => toast("Task creation is coming soon.")}
      />
    </div>
  );
}
