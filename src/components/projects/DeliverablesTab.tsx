import { TaskDeliverables } from "@/components/projects/TaskDeliverables";

export function DeliverablesTab({ projectId }: { projectId: string }) {
  return <TaskDeliverables projectId={projectId} />;
}
