import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { scopedSelect } from "@/lib/workspaceScope";

export type ProjectStatus = "on_track" | "at_risk" | "blocked" | "done" | "planning";
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "awaiting_approval"
  | "approved"
  | "changes_requested"
  | "done";

export interface ClientProject {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  progress: number;
  due_date: string | null;
  phase: string | null;
}

export interface ActionItem {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  project_id: string;
  project_name: string;
}

export interface ActivityEntry {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Milestone {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  project_id: string;
  project_name: string;
}

/** Projects in the active workspace (scoped + RLS). */
export function useClientProjects() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery({
    queryKey: ["client-projects", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<ClientProject[]> => {
      const { data: projects, error } = await scopedSelect(
        "projects",
        workspaceId,
        "id, name, description, status, health, progress, due_date",
      ).order("created_at", { ascending: false });
      if (error) throw error;

      const list = projects ?? [];
      if (list.length === 0) return [];

      // Derive "current phase" from the first incomplete milestone per project.
      const ids = list.map((p) => p.id);
      const { data: milestones } = await scopedSelect(
        "milestones",
        workspaceId,
        "project_id, title, completed, due_date",
      )
        .in("project_id", ids)
        .eq("completed", false)
        .order("due_date", { ascending: true });

      const phaseByProject = new Map<string, string>();
      (milestones ?? []).forEach((m) => {
        if (!phaseByProject.has(m.project_id)) phaseByProject.set(m.project_id, m.title);
      });

      return list.map((p) => ({
        ...p,
        status: p.status === "completed" ? "done" : p.status === "draft" ? "planning" : p.health,
        phase: phaseByProject.get(p.id) ?? null,
      })) as ClientProject[];
    },
  });
}

/** Helper: build a project id -> name lookup, scoped to the active workspace. */
async function projectNameMap(
  ids: string[],
  workspaceId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const unique = Array.from(new Set(ids));
  const { data } = await scopedSelect("projects", workspaceId, "id, name").in("id", unique);
  (data ?? []).forEach((p) => map.set(p.id, p.name));
  return map;
}

/** Tasks needing client attention (approvals / change requests). */
export function useActionItems(projectId?: string) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery({
    queryKey: ["client-actions", workspaceId, projectId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<ActionItem[]> => {
      let query = scopedSelect(
        "deliverables",
        workspaceId,
        "id, title, status, project_id",
      )
        .eq("status", "submitted")
        .eq("requires_approval", true)
        .order("created_at", { ascending: true });
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      const names = await projectNameMap(
        rows.map((t) => t.project_id),
        workspaceId!,
      );
      return rows.map((t) => ({
        id: t.id,
        title: t.title,
        status: "awaiting_approval" as TaskStatus,
        due_date: null,
        project_id: t.project_id,
        project_name: names.get(t.project_id) ?? "Project",
      }));
    },
  });
}

export function useClientActivity(limit = 8) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery({
    queryKey: ["client-activity", workspaceId, limit],
    enabled: !!workspaceId,
    queryFn: async (): Promise<ActivityEntry[]> => {
      const { data, error } = await scopedSelect(
        "activity",
        workspaceId,
        "id, type, payload, created_at",
      )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ActivityEntry[];
    },
  });
}

export function useClientMilestones(limit = 6) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery({
    queryKey: ["client-milestones", workspaceId, limit],
    enabled: !!workspaceId,
    queryFn: async (): Promise<Milestone[]> => {
      const { data, error } = await scopedSelect(
        "milestones",
        workspaceId,
        "id, title, due_date, completed, completed_at, project_id",
      )
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      const rows = data ?? [];
      const names = await projectNameMap(
        rows.map((m) => m.project_id),
        workspaceId!,
      );
      return rows.map((m) => ({
        id: m.id,
        title: m.title,
        due_date: m.due_date,
        completed: m.completed,
        completed_at: m.completed_at,
        project_id: m.project_id,
        project_name: names.get(m.project_id) ?? "",
      }));
    },
  });
}
