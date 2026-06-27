import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import type {
  DeliverableStatus,
  MilestoneStatus,
  ProjectMemberRole,
  TaskPriority,
  TaskStatus,
} from "@/lib/projectConstants";
import type { ProjectMemberProfile, ProjectRow } from "@/hooks/useProjects";

export interface TaskRow {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assignee_id: string | null;
  created_by: string | null;
  due_date: string | null;
  labels: string[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
}

export interface DeliverableRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: DeliverableStatus;
  requires_approval: boolean;
  approved_at: string | null;
  created_at: string;
}

export interface ActivityRow {
  id: string;
  action: string;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useProject(projectId?: string) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectRow> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Project not found");
      return data as ProjectRow;
    },
  });
}

export function useProjectMembers(projectId?: string) {
  return useQuery({
    queryKey: ["project-members", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectMemberProfile[]> => {
      const { data: members, error } = await supabase
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", projectId!);
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (members ?? []).map((m) => ({
        user_id: m.user_id,
        role: m.role as ProjectMemberRole,
        full_name: map.get(m.user_id)?.full_name ?? null,
        avatar_url: map.get(m.user_id)?.avatar_url ?? null,
      }));
    },
  });
}

export function useProjectTasks(projectId?: string) {
  return useQuery({
    queryKey: ["project-tasks", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId!)
        .is("archived_at", null)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });
}

export function useProjectMilestones(projectId?: string) {
  return useQuery({
    queryKey: ["project-milestones", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<MilestoneRow[]> => {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, project_id, title, description, due_date, status")
        .eq("project_id", projectId!)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as MilestoneRow[];
    },
  });
}

export function useProjectDeliverables(projectId?: string) {
  return useQuery({
    queryKey: ["project-deliverables", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<DeliverableRow[]> => {
      const { data, error } = await supabase
        .from("deliverables")
        .select("id, project_id, title, description, status, requires_approval, approved_at, created_at")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeliverableRow[];
    },
  });
}

export function useCreateDeliverable(projectId: string) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; requiresApproval: boolean }) => {
      if (!currentWorkspace) throw new Error("No active workspace.");
      const { error } = await supabase.from("deliverables").insert({
        project_id: projectId,
        workspace_id: currentWorkspace.id,
        title: input.title,
        description: input.description ?? null,
        status: "draft",
        requires_approval: input.requiresApproval,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-deliverables", projectId] }),
  });
}

export function useUpdateDeliverableStatus(projectId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: DeliverableStatus }) => {
      const patch: {
        status: DeliverableStatus;
        approved_at?: string;
        approved_by?: string | null;
      } = { status: input.status };
      if (input.status === "approved") {
        patch.approved_at = new Date().toISOString();
        patch.approved_by = user?.id ?? null;
      }
      const { error } = await supabase
        .from("deliverables")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-deliverables", projectId] }),
  });
}



export function useProjectActivity(projectId?: string, limit = 20) {
  return useQuery({
    queryKey: ["project-activity", projectId, limit],
    enabled: !!projectId,
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await supabase
        .from("project_activity")
        .select("id, action, actor_id, metadata, created_at")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });
}

// ---------------- Mutations ----------------

export function useCreateTask(projectId: string, workspaceId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; status: TaskStatus; priority?: TaskPriority }) => {
      const existing = qc.getQueryData<TaskRow[]>(["project-tasks", projectId]) ?? [];
      const position = existing.filter((t) => t.status === input.status).length;
      const { error } = await supabase.from("tasks").insert({
        workspace_id: workspaceId,
        project_id: projectId,
        title: input.title,
        status: input.status,
        priority: input.priority ?? "medium",
        position,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
  });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TaskRow> & { id: string }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
  });
}

/** Persist a reordered/moved set of tasks. Caller applies optimistic state first. */
export function useReorderTasks(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; status: TaskStatus; position: number }[]) => {
      const results = await Promise.all(
        updates.map((u) =>
          supabase.from("tasks").update({ status: u.status, position: u.position }).eq("id", u.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onError: () => {
      // Roll back to the server's truth.
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
  });
}

/** Duplicate a task into the same column, just after the original. */
export function useDuplicateTask(projectId: string, workspaceId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: TaskRow) => {
      const existing = qc.getQueryData<TaskRow[]>(["project-tasks", projectId]) ?? [];
      const position = existing.filter((t) => t.status === task.status).length;
      const { error } = await supabase.from("tasks").insert({
        workspace_id: workspaceId,
        project_id: projectId,
        title: `${task.title} (copy)`,
        description: task.description,
        status: task.status,
        priority: task.priority,
        position,
        assignee_id: task.assignee_id,
        due_date: task.due_date,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
  });
}

/** Apply the same field patch to many tasks at once. */
export function useBulkUpdateTasks(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<TaskRow> }) => {
      const { error } = await supabase.from("tasks").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
  });
}

/** Delete many tasks at once. */
export function useBulkDeleteTasks(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("tasks").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
  });
}
