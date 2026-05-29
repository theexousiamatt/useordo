import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

/** Projects the client can see (RLS scopes to membership). */
export function useClientProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-projects", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ClientProject[]> => {
      const { data: projects, error } = await supabase
        .from("projects")
        .select("id, name, description, status, progress, due_date")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const list = projects ?? [];
      if (list.length === 0) return [];

      // Derive "current phase" from the first incomplete milestone per project.
      const ids = list.map((p) => p.id);
      const { data: milestones } = await supabase
        .from("milestones")
        .select("project_id, title, completed, due_date")
        .in("project_id", ids)
        .eq("completed", false)
        .order("due_date", { ascending: true });

      const phaseByProject = new Map<string, string>();
      (milestones ?? []).forEach((m) => {
        if (!phaseByProject.has(m.project_id)) phaseByProject.set(m.project_id, m.title);
      });

      return list.map((p) => ({
        ...p,
        phase: phaseByProject.get(p.id) ?? null,
      })) as ClientProject[];
    },
  });
}

/** Tasks needing client attention (approvals / change requests). */
export function useActionItems() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-actions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ActionItem[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, project_id, projects(name)")
        .in("status", ["awaiting_approval", "changes_requested"])
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status as TaskStatus,
        due_date: t.due_date,
        project_id: t.project_id,
        project_name: (t.projects as { name?: string } | null)?.name ?? "Project",
      }));
    },
  });
}

export function useClientActivity(limit = 8) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-activity", user?.id, limit],
    enabled: !!user,
    queryFn: async (): Promise<ActivityEntry[]> => {
      const { data, error } = await supabase
        .from("activity")
        .select("id, type, payload, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ActivityEntry[];
    },
  });
}

export function useClientMilestones(limit = 6) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-milestones", user?.id, limit],
    enabled: !!user,
    queryFn: async (): Promise<Milestone[]> => {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, title, due_date, completed, completed_at, project_id, projects(name)")
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        due_date: m.due_date,
        completed: m.completed,
        completed_at: m.completed_at,
        project_id: m.project_id,
        project_name: (m.projects as { name?: string } | null)?.name ?? "",
      }));
    },
  });
}
