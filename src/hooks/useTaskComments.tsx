import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface TaskComment {
  id: string;
  task_id: string | null;
  project_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

/** Comments scoped to a single task (Level 2 — deep work / collaboration). */
export function useTaskComments(taskId?: string) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskComment[]> => {
      const { data, error } = await supabase
        .from("project_comments")
        .select("id, task_id, project_id, author_id, content, created_at")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.author_id)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids)).data ?? []
        : [];
      const map = new Map(profiles.map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        author_name: map.get(r.author_id)?.full_name ?? null,
        author_avatar: map.get(r.author_id)?.avatar_url ?? null,
      }));
    },
  });
}

export function useAddTaskComment(taskId: string, projectId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  return useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("You must be signed in to comment.");
      if (!currentWorkspace) throw new Error("No active workspace.");
      const { error } = await supabase.from("project_comments").insert({
        task_id: taskId,
        project_id: projectId,
        workspace_id: currentWorkspace.id,
        author_id: user.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
  });
}

export function useDeleteTaskComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  });
}
