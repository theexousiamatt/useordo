import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { WorkTask } from "@/lib/myTasks";

type WorkSnapshot = {
  tasks: WorkTask[];
  projectNames: Record<string, string>;
  completedProjects: ReadonlySet<string>;
  assignees: Map<string, string[]>;
};
const PAGE = 500;

async function pageAll<T>(reader: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await reader(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    result.push(...rows);
    if (rows.length < PAGE) return result;
  }
}

export function useWorkTasks() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery<WorkSnapshot>({
    queryKey: ["work-tasks", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      if (!workspaceId) throw new Error("Select a workspace.");
      // Read the user's RLS-visible projects first, then constrain task and
      // assignee queries to these project ids. Do not expose client data.
      const projects = await pageAll<{id: string; name: string; status: string}>((from, to) =>
        supabase.from("projects").select("id,name,status")
          .eq("workspace_id", workspaceId).is("archived_at", null).neq("status", "archived")
          .order("id").range(from, to)
      );
      if (!projects.length) {
        return { tasks: [], projectNames: {}, completedProjects: new Set(), assignees: new Map() };
      }
      const ids = new Set(projects.map((project) => project.id));
      const tasks = (await pageAll<WorkTask>((from, to) =>
        supabase.from("tasks")
          .select("id,title,project_id,due_date,completed_at,archived_at,assignee_id,position")
          .eq("workspace_id", workspaceId).is("archived_at", null)
          .order("id").range(from, to)
      )).filter((task) => ids.has(task.project_id));
      const map = new Map<string, string[]>();
      if (tasks.length) {
        const taskIds = new Set(tasks.map(task => task.id));
        const rows = await pageAll<{task_id: string; user_id: string}>((from, to) =>
          supabase.from("task_assignees").select("task_id,user_id")
            .eq("workspace_id", workspaceId).order("task_id").order("user_id").range(from, to)
        );
        for (const row of rows) {
          if (taskIds.has(row.task_id)) map.set(row.task_id, [...(map.get(row.task_id) ?? []), row.user_id]);
        }
      }
      return {
        tasks,
        projectNames: Object.fromEntries(projects.map((project) => [project.id, project.name])),
        completedProjects: new Set(projects.filter(project => project.status === "completed").map(project => project.id)),
        assignees: map,
      };
    },
  });
}
