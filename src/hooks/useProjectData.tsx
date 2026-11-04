import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import type {
  DeliverableStatus,
  MilestoneStatus,
  ProjectMemberRole,
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
  position: number;
  assignee_id: string | null;
  created_by: string | null;
  due_date: string | null;
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

/**
 * Members that can be assigned to a task in this project.
 *
 * Precedence:
 *  1. Explicit project members (future project-scoped permissions), if any exist.
 *  2. Otherwise, all active workspace collaborators (owner/manager/member).
 *
 * Clients are intentionally excluded — they cannot be assigned to tasks.
 * Every row is enriched with profile data (name, avatar, email) and workspace
 * role so the picker can render a full, non-mock member list.
 */
export function useAssignableMembers(projectId?: string) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery({
    queryKey: ["assignable-members", projectId, workspaceId],
    enabled: !!projectId && !!workspaceId,
    queryFn: async (): Promise<ProjectMemberProfile[]> => {
      // 1. Explicit project members take precedence when present.
      const { data: pm, error: pmErr } = await supabase
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", projectId!);
      if (pmErr) throw pmErr;

      let rows: { user_id: string; role: ProjectMemberRole }[] = (pm ?? []).map((m) => ({
        user_id: m.user_id,
        role: m.role as ProjectMemberRole,
      }));

      // 2. Fall back to active workspace collaborators (excluding clients).
      if (rows.length === 0) {
        const { data: wm, error: wmErr } = await supabase
          .from("workspace_members")
          .select("user_id, role, status")
          .eq("workspace_id", workspaceId!)
          .eq("status", "active");
        if (wmErr) throw wmErr;
        rows = (wm ?? [])
          .filter((m) => ["owner", "manager", "member"].includes(m.role))
          .map((m) => ({ user_id: m.user_id, role: m.role as ProjectMemberRole }));

        // Ensure the workspace owner is always assignable, even without a row.
        const ownerId = currentWorkspace?.owner_id;
        if (ownerId && !rows.some((r) => r.user_id === ownerId)) {
          rows.unshift({ user_id: ownerId, role: "owner" as ProjectMemberRole });
        }
      }

      const ids = rows.map((r) => r.user_id);
      if (ids.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .in("id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));

      return rows.map((r) => ({
        user_id: r.user_id,
        role: r.role,
        full_name: map.get(r.user_id)?.full_name ?? null,
        avatar_url: map.get(r.user_id)?.avatar_url ?? null,
        email: (map.get(r.user_id) as { email?: string | null } | undefined)?.email ?? null,
      }));
    },
  });
}

/**
 * Fetch the multi-assignee map for every task in a project.
 * Returns a Map of task_id -> array of assigned user ids.
 */
export function useTaskAssignees(projectId?: string) {
  return useQuery({
    queryKey: ["task-assignees", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<Map<string, string[]>> => {
      const { data, error } = await supabase
        .from("task_assignees")
        .select("task_id, user_id")
        .eq("project_id", projectId!);
      if (error) throw error;
      const map = new Map<string, string[]>();
      for (const row of data ?? []) {
        const list = map.get(row.task_id) ?? [];
        list.push(row.user_id);
        map.set(row.task_id, list);
      }
      return map;
    },
  });
}

/**
 * Replace the full set of assignees for a task. Diffs against the current set,
 * inserting added members and removing dropped ones. Optimistic + realtime-safe.
 * Also keeps the legacy `tasks.assignee_id` in sync (first assignee) so the
 * personal Tasks view and existing notifications keep working.
 */
export function useSetTaskAssignees(projectId: string) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      userIds,
    }: {
      taskId: string;
      userIds: string[];
    }) => {
      // Diff against the server (source of truth) — NOT the query cache, which
      // onMutate has already optimistically overwritten by the time this runs.
      const { data: existing, error: readErr } = await supabase
        .from("task_assignees")
        .select("user_id")
        .eq("task_id", taskId);
      if (readErr) throw readErr;
      const current = (existing ?? []).map((r) => r.user_id);
      const toAdd = userIds.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !userIds.includes(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("task_assignees")
          .delete()
          .eq("task_id", taskId)
          .in("user_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        if (!currentWorkspace) throw new Error("No active workspace.");
        const { error } = await supabase.from("task_assignees").insert(
          toAdd.map((uid) => ({
            task_id: taskId,
            user_id: uid,
            project_id: projectId,
            workspace_id: currentWorkspace.id,
            created_by: user?.id ?? null,
          })),
        );
        if (error) throw error;
      }
      // Keep the legacy single-assignee column pointed at the first assignee.
      const { error: taskErr } = await supabase
        .from("tasks")
        .update({ assignee_id: userIds[0] ?? null })
        .eq("id", taskId);
      if (taskErr) throw taskErr;
    },
    onMutate: async ({ taskId, userIds }) => {
      const key = ["task-assignees", projectId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Map<string, string[]>>(key);
      const next = new Map(previous ?? []);
      next.set(taskId, userIds);
      qc.setQueryData(key, next);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(["task-assignees", projectId], context.previous);
      toast.error("Couldn't update assignees. Please try again.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["task-assignees", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
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
    mutationFn: async (input: { title: string; status: TaskStatus }) => {
      const existing = qc.getQueryData<TaskRow[]>(["project-tasks", projectId]) ?? [];
      const position = Math.max(-1, ...existing.filter((t) => t.status === input.status).map((t) => t.position)) + 1;
      const { error } = await supabase.from("tasks").insert({
        workspace_id: workspaceId,
        project_id: projectId,
        title: input.title,
        status: input.status,
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
      const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).eq("project_id", projectId).is("archived_at", null).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("This task is no longer available or your access has changed.");
    },
    // Optimistic UI: apply the patch to the cached board immediately.
    onMutate: async ({ id, ...patch }) => {
      const key = ["project-tasks", projectId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TaskRow[]>(key);
      qc.setQueryData<TaskRow[]>(key, (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(["project-tasks", projectId], context.previous);
      toast.error("Couldn't save your change. Please try again.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
  });
}


/** Persist a reordered/moved set of tasks. Caller applies optimistic state first. */
export function useReorderTasks(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; status: TaskStatus; position: number; expected_updated_at: string }[]) => {
      const { error } = await supabase.rpc("reorder_project_tasks", { _project_id: projectId, _updates: updates });
      if (!error) return;
      // Never fall back to individual writes: a mid-move failure would leave
      // only part of the board reordered. Deploy the matching migration first.
      if (error.code === "PGRST202" || error.code === "42883") {
        throw new Error("Task moves are temporarily unavailable. The workspace needs a database update; no changes were saved.");
      }
      throw error;
    },
    onError: async () => {
      await qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      await qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
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
    mutationFn: async (task: TaskRow & { copyAssignee?: boolean }) => {
      const existing = qc.getQueryData<TaskRow[]>(["project-tasks", projectId]) ?? [];
      const position = Math.max(-1, ...existing.filter((t) => t.status === task.status).map((t) => t.position)) + 1;
      const { error } = await supabase.from("tasks").insert({
        workspace_id: workspaceId,
        project_id: projectId,
        title: `${task.title} (Copy)`,
        description: task.description,
        status: task.status,
        position,
        assignee_id: task.copyAssignee === false ? null : task.assignee_id,
        due_date: task.due_date,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
  });
}

/** Soft-archive a task — hidden from the active board, data preserved. */
export function useArchiveTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const archivedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("tasks")
        .update({ archived_at: archivedAt })
        .eq("id", id)
        .select("id, archived_at, updated_at")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
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
