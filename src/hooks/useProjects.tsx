import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { BoardTheme } from "@/lib/boardThemes";
import type {
  ProjectHealth,
  ProjectMemberRole,
  ProjectStatus,
} from "@/lib/projectConstants";

export interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  owner_id: string | null;
  created_by: string | null;
  archived_at: string | null;
  visibility: "workspace" | "restricted";
  theme?: BoardTheme | null;
  created_at: string;
  updated_at: string;
}


export interface ProjectMemberProfile {
  user_id: string;
  role: ProjectMemberRole;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
}

export interface ProjectWithMembers extends ProjectRow {
  members: ProjectMemberProfile[];
}

export interface WorkspaceMemberProfile {
  user_id: string;
  role: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

/** Members of the current workspace (for team & client assignment). */
export function useWorkspaceMembers() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<WorkspaceMemberProfile[]> => {
      const { data: members, error } = await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", workspaceId!)
        .eq("status", "active");
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id);
      // Ensure the owner is included even if no explicit membership row exists.
      if (currentWorkspace?.owner_id && !ids.includes(currentWorkspace.owner_id)) {
        ids.push(currentWorkspace.owner_id);
      }
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .in("id", ids);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return ids.map((id) => {
        const m = (members ?? []).find((x) => x.user_id === id);
        const p = profileMap.get(id);
        return {
          user_id: id,
          role: id === currentWorkspace?.owner_id ? "owner" : m?.role ?? "member",
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          email: p?.email ?? null,
        };
      });
    },
  });
}

/** All projects in the current workspace, with member profiles attached. */
export function useProjects(options?: { includeArchived?: boolean }) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const includeArchived = options?.includeArchived ?? false;
  return useQuery({
    queryKey: ["projects", workspaceId, includeArchived],
    enabled: !!workspaceId,
    queryFn: async (): Promise<ProjectWithMembers[]> => {
      let query = supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", workspaceId!);
      if (!includeArchived) query = query.is("archived_at", null);
      const { data: projects, error } = await query.order("updated_at", { ascending: false });
      if (error) throw error;
      const list = (projects ?? []) as ProjectRow[];
      if (list.length === 0) return [];


      const ids = list.map((p) => p.id);
      const { data: members } = await supabase
        .from("project_members")
        .select("project_id, user_id, role")
        .in("project_id", ids);
      const memberIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
      const { data: profiles } = memberIds.length
        ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", memberIds)
        : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      return list.map((p) => ({
        ...p,
        members: (members ?? [])
          .filter((m) => m.project_id === p.id)
          .map((m) => ({
            user_id: m.user_id,
            role: m.role as ProjectMemberRole,
            full_name: profileMap.get(m.user_id)?.full_name ?? null,
            avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
          })),
      }));
    },
  });
}

export interface AiPlanItem {
  type: "milestone" | "task";
  title: string;
  description?: string;
  priority?: string;
  due_offset_days?: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  client_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  member_ids: string[];
  client_user_ids: string[];
  owner_id?: string | null;
  plan_items?: AiPlanItem[];
}

export function useCreateProject() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  return useMutation({
    mutationFn: async (input: CreateProjectInput): Promise<ProjectRow> => {
      if (!workspaceId || !user) throw new Error("No active workspace.");

      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          workspace_id: workspaceId,
          name: input.name,
          description: input.description ?? null,
          client_id: input.client_id ?? null,
          start_date: input.start_date ?? null,
          due_date: input.due_date ?? null,
          owner_id: input.owner_id ?? user.id,
          created_by: user.id,
          status: "active",
          health: "on_track",
        })
        .select()
        .single();
      if (error) throw error;
      const created = project as ProjectRow;

      // Build membership rows (de-duped), owner always included.
      const ownerId = input.owner_id ?? user.id;
      const rows = new Map<string, ProjectMemberRole>();
      rows.set(ownerId, "owner");
      input.member_ids.forEach((id) => {
        if (!rows.has(id)) rows.set(id, "member");
      });
      input.client_user_ids.forEach((id) => rows.set(id, "client"));
      const memberRows = Array.from(rows.entries()).map(([uid, role]) => ({
        workspace_id: workspaceId,
        project_id: created.id,
        user_id: uid,
        role,
      }));
      const { error: memberError } = await supabase.from("project_members").insert(memberRows);
      if (memberError) throw memberError;

      // Materialize AI plan items (milestones + tasks) if provided.
      const items = input.plan_items ?? [];
      const milestones = items.filter((i) => i.type === "milestone");
      const tasks = items.filter((i) => i.type === "task");
      const dayMs = 86_400_000;
      const offset = (d?: number) =>
        d != null ? new Date(Date.now() + d * dayMs).toISOString() : null;

      if (milestones.length) {
        await supabase.from("milestones").insert(
          milestones.map((m) => ({
            workspace_id: workspaceId,
            project_id: created.id,
            title: m.title,
            description: m.description ?? null,
            due_date: offset(m.due_offset_days),
            status: "pending",
          })),
        );
      }
      if (tasks.length) {
        await supabase.from("tasks").insert(
          tasks.map((t, idx) => ({
            workspace_id: workspaceId,
            project_id: created.id,
            title: t.title,
            description: t.description ?? null,
            status: "backlog",
            position: idx,
            created_by: user.id,
          })),
        );
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
  });
}

export interface UpdateProjectInput {
  id: string;
  name?: string;
  description?: string | null;
  due_date?: string | null;
  client_id?: string | null;
  status?: ProjectStatus;
  owner_id?: string | null;
  theme?: BoardTheme;
}

/** Edit core project settings (rename, description, due date, client, status, owner). */
export function useUpdateProject() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const workspaceId = currentWorkspace?.id;
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateProjectInput) => {
      const { error } = await supabase.from("projects").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
    },
  });
}

/** Soft-delete: archive (hide from active views) or restore a project. */
export function useArchiveProject() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const workspaceId = currentWorkspace?.id;
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from("projects")
        .update(
          archived
            ? { archived_at: new Date().toISOString(), status: "archived" }
            : { archived_at: null, status: "active" },
        )
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
    },
  });
}

export interface DeletionReport {
  project_id: string;
  deleted: boolean;
  records: Record<string, number>;
}

/** Owner-only hard delete. Cascades child records and returns a report. */
export function useDeleteProject() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const workspaceId = currentWorkspace?.id;
  return useMutation({
    mutationFn: async (id: string): Promise<DeletionReport> => {
      const { data, error } = await supabase.rpc("delete_project", { _project_id: id });
      if (error) throw error;
      return data as unknown as DeletionReport;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
  });
}

export interface DuplicateProjectInput {
  projectId: string;
  name: string;
  copySettings: boolean;
  copyClient: boolean;
  copyTeam: boolean;
  copyMilestones: boolean;
  copyTasks: boolean;
  copyDueDates: boolean;
  copyComments: boolean;
  copyDeliverables: boolean;
  copyFiles: boolean;
}

export interface DuplicateProjectResult {
  projectId: string;
  name: string;
  records: Record<string, number>;
}

/** Duplicate a project via the dedicated duplication service (owner/manager only). */
export function useDuplicateProject() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const workspaceId = currentWorkspace?.id;
  return useMutation({
    mutationFn: async (input: DuplicateProjectInput): Promise<DuplicateProjectResult> => {
      const { data, error } = await supabase.functions.invoke("duplicate-project", {
        body: input,
      });
      if (error) {
        // Surface the function's structured error message when present.
        const msg = (data as { error?: string })?.error ?? error.message;
        throw new Error(typeof msg === "string" ? msg : "Failed to duplicate project.");
      }
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      return data as DuplicateProjectResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
  });
}


