import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import type {
  StudioActivity,
  StudioDashboardData,
  StudioDeliverable,
  StudioMilestone,
  StudioProject,
  StudioTask,
} from "@/lib/studioDashboard";

const PAGE_SIZE = 500;

/** Paginate so workspace totals are not silently capped by Supabase's default row limit. */
async function readAll<T>(
  load: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Staff-only read model. Always scope by workspace AND the current user's
 * RLS-visible project ids, including tasks, approvals and activity.
 * No elevated key or writes are used by this dashboard.
 */
export function useStudioDashboard() {
  const { currentWorkspace, role } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const allowed = role === "owner" || role === "manager" || role === "member";

  return useQuery({
    queryKey: ["studio-dashboard", workspaceId],
    enabled: Boolean(workspaceId && allowed),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<StudioDashboardData> => {
      if (!workspaceId || !allowed) throw new Error("Workspace access is required.");

      const projects = await readAll<StudioProject>((from, to) =>
        supabase.from("projects")
          .select("id,name,status,health,due_date,updated_at,archived_at")
          .eq("workspace_id", workspaceId)
          .is("archived_at", null)
          .order("id", { ascending: true })
          .range(from, to)
      );
      if (projects.length === 0) {
        return { projects: [], tasks: [], milestones: [], deliverables: [], activity: [] };
      }

      const projectIds = projects.map((p) => p.id);
      const [tasks, milestones, deliverables, activity] = await Promise.all([
        readAll<StudioTask>((from, to) =>
          supabase.from("tasks")
            .select("id,project_id,title,due_date,completed_at,archived_at")
            .eq("workspace_id", workspaceId)
            .in("project_id", projectIds)
            .order("id", { ascending: true })
            .range(from, to)
        ),
        readAll<StudioMilestone>((from, to) =>
          supabase.from("milestones")
            .select("id,project_id,title,due_date,completed")
            .eq("workspace_id", workspaceId)
            .in("project_id", projectIds)
            .order("id", { ascending: true })
            .range(from, to)
        ),
        readAll<StudioDeliverable>((from, to) =>
          supabase.from("deliverables")
            .select("id,project_id,title,status,requires_approval,created_at")
            .eq("workspace_id", workspaceId)
            .in("project_id", projectIds)
            .eq("status", "submitted")
            .eq("requires_approval", true)
            .order("id", { ascending: true })
            .range(from, to)
        ),
        supabase.from("project_activity")
          .select("id,project_id,action,metadata,created_at")
          .eq("workspace_id", workspaceId)
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(8)
          .then(({ data, error }) => {
            if (error) throw error;
            return (data ?? []) as StudioActivity[];
          }),
      ]);

      return { projects, tasks, milestones, deliverables, activity };
    },
  });
}
