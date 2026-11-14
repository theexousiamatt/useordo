import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface TaskSubtask {
  id: string;
  project_id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export function useProjectSubtasks(projectId: string) {
  return useQuery({
    queryKey: ["project-subtasks", projectId],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<TaskSubtask[]> => {
      // Supabase defaults to a capped row count; retrieve all checklist items.
      const all: TaskSubtask[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from("task_subtasks")
          .select("id,project_id,task_id,title,completed,position,created_at")
          .eq("project_id", projectId)
          .order("position", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        all.push(...((data ?? []) as TaskSubtask[]));
        if (!data || data.length < pageSize) break;
      }
      return all;
    },
  });
}

export type SubtaskAction =
  | { type: "create"; taskId: string; title: string; position: number }
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "delete"; id: string };

export function useSubtaskActions(projectId: string) {
  const qc = useQueryClient();
  const key = ["project-subtasks", projectId];
  return useMutation({
    mutationFn: async (action: SubtaskAction) => {
      if (action.type === "create") {
        const { error } = await supabase.from("task_subtasks").insert({
          project_id: projectId,
          task_id: action.taskId,
          title: action.title.trim(),
          position: action.position,
        });
        if (error) throw error;
      } else if (action.type === "toggle") {
        const { error } = await supabase.from("task_subtasks")
          .update({ completed: action.completed })
          .eq("id", action.id)
          .eq("project_id", projectId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task_subtasks")
          .delete().eq("id", action.id).eq("project_id", projectId);
        if (error) throw error;
      }
    },
    onMutate: async (action) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TaskSubtask[]>(key);
      if (action.type === "toggle") {
        qc.setQueryData<TaskSubtask[]>(key, old =>
          (old ?? []).map(row => row.id === action.id ? { ...row, completed: action.completed } : row));
      } else if (action.type === "delete") {
        qc.setQueryData<TaskSubtask[]>(key, old => (old ?? []).filter(row => row.id !== action.id));
      }
      return { previous };
    },
    onError: (_error, _action, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      toast.error("Couldn't update the checklist. Please try again.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}
