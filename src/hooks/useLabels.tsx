import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { LabelColor } from "@/lib/labelColors";

export interface ProjectLabel {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
}

/** All labels defined for a project, ordered. Scoped strictly to this project. */
export function useProjectLabels(projectId?: string) {
  return useQuery({
    queryKey: ["project-labels", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectLabel[]> => {
      const { data, error } = await supabase
        .from("project_labels")
        .select("id, workspace_id, project_id, name, color, position")
        .eq("project_id", projectId!)
        .order("position", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectLabel[];
    },
  });
}

/** Map of task_id -> assigned label ids, for every task in a project. */
export function useTaskLabelMap(projectId?: string) {
  return useQuery({
    queryKey: ["task-label-map", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<Map<string, string[]>> => {
      const { data, error } = await supabase
        .from("task_labels")
        .select("task_id, label_id")
        .eq("project_id", projectId!);
      if (error) throw error;
      const map = new Map<string, string[]>();
      for (const row of data ?? []) {
        const list = map.get(row.task_id) ?? [];
        list.push(row.label_id);
        map.set(row.task_id, list);
      }
      return map;
    },
  });
}

export function useCreateLabel(projectId: string, workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: LabelColor }) => {
      const existing = qc.getQueryData<ProjectLabel[]>(["project-labels", projectId]) ?? [];
      const { error } = await supabase.from("project_labels").insert({
        workspace_id: workspaceId,
        project_id: projectId,
        name: name.trim(),
        color,
        position: existing.length,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-labels", projectId] }),
    onError: () => toast.error("Couldn't create label. Please try again."),
  });
}

/** Rename and/or recolor a label — updates everywhere it's used in the project. */
export function useUpdateLabel(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: LabelColor }) => {
      const patch: { name?: string; color?: string } = {};
      if (name !== undefined) patch.name = name.trim();
      if (color !== undefined) patch.color = color;
      const { error } = await supabase.from("project_labels").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, name, color }) => {
      const key = ["project-labels", projectId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ProjectLabel[]>(key);
      qc.setQueryData<ProjectLabel[]>(key, (old) =>
        (old ?? []).map((l) =>
          l.id === id ? { ...l, ...(name !== undefined ? { name } : {}), ...(color !== undefined ? { color } : {}) } : l,
        ),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(["project-labels", projectId], ctx.previous);
      toast.error("Couldn't update label. Please try again.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["project-labels", projectId] }),
  });
}

export function useDeleteLabel(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_labels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-labels", projectId] });
      qc.invalidateQueries({ queryKey: ["task-label-map", projectId] });
    },
    onError: () => toast.error("Couldn't delete label. Please try again."),
  });
}

/**
 * Replace the full set of labels on a task. Diffs against the server (source of
 * truth) so optimistic cache updates don't corrupt the diff. Optimistic +
 * realtime safe, mirroring the task-assignees pattern.
 */
export function useSetTaskLabels(projectId: string, workspaceId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, labelIds }: { taskId: string; labelIds: string[] }) => {
      const { data: existing, error: readErr } = await supabase
        .from("task_labels")
        .select("label_id")
        .eq("task_id", taskId);
      if (readErr) throw readErr;
      const current = (existing ?? []).map((r) => r.label_id);
      const toAdd = labelIds.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !labelIds.includes(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("task_labels")
          .delete()
          .eq("task_id", taskId)
          .in("label_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await supabase.from("task_labels").insert(
          toAdd.map((lid) => ({
            task_id: taskId,
            label_id: lid,
            project_id: projectId,
            workspace_id: workspaceId,
          })),
        );
        if (error) throw error;
      }
    },
    onMutate: async ({ taskId, labelIds }) => {
      const key = ["task-label-map", projectId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Map<string, string[]>>(key);
      const next = new Map(previous ?? []);
      next.set(taskId, labelIds);
      qc.setQueryData(key, next);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(["task-label-map", projectId], ctx.previous);
      toast.error("Couldn't update labels. Please try again.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["task-label-map", projectId] }),
  });
}
