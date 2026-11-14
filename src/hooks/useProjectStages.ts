import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TaskStatus } from "@/lib/projectConstants";
import type { StageTheme } from "@/lib/stageThemes";

export interface ProjectStage {
  id: string;
  project_id: string;
  workspace_id: string;
  name: string;
  category: TaskStatus;
  theme?: StageTheme | null;
  position: number;
  revision: number;
  created_at: string;
}

export type StageCommand = {
  action: "create" | "rename" | "reorder" | "remove" | "delete";
  stageId?: string | null;
  name?: string | null;
  category?: TaskStatus | null;
  beforeId?: string | null;
  destinationId?: string | null;
  expectedRevision?: number | null;
  requestId: string;
};

/** Stage titles/ordering are project-local; existing tasks.status stays the reporting category. */
export function useProjectStages(projectId: string) {
  return useQuery({
    queryKey: ["project-stages", projectId],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProjectStage[]> => {
      const { data, error } = await supabase.from("project_stages").select("*")
        .eq("project_id", projectId).order("position").order("id");
      if (error) throw error;
      return (data ?? []) as ProjectStage[];
    },
  });
}

export function useProjectStageCommand(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (command: StageCommand): Promise<string> => {
      const { data, error } = await supabase.rpc("manage_project_stage", {
        _project_id: projectId,
        _action: command.action,
        _stage_id: command.stageId ?? null,
        _name: command.name ?? null,
        _category: command.category ?? null,
        _before_id: command.beforeId ?? null,
        _destination_id: command.destinationId ?? null,
        _expected_revision: command.expectedRevision ?? null,
        _request_id: command.requestId,
      });
      if (error) throw error;
      if (!data) throw new Error("Stage save could not be confirmed. Retry the unchanged action.");
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["project-stages", projectId] }),
        qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
        qc.invalidateQueries({ queryKey: ["project-activity", projectId] }),
      ]);
    },
  });
}

/** Creates a freely named stage, applying the chosen theme in the same DB transaction. */
export function useCreateCustomStage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; theme: StageTheme; category: TaskStatus; requestId: string }) => {
      const { data, error } = await supabase.rpc("create_custom_stage", {
        _project_id: projectId,
        _name: input.name,
        _theme: input.theme,
        _category: input.category,
        _request_id: input.requestId,
      });
      if (error) throw error;
      if (!data) throw new Error("Stage creation could not be confirmed. Retry the same request.");
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["project-stages", projectId] });
    },
  });
}

/** Set only the selected stage's theme; preserve task metadata and other stages. */
export function useSetProjectStageTheme(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stageId: string; theme: StageTheme; expectedRevision: number }) => {
      const { data, error } = await supabase.rpc("set_project_stage_theme", {
        _project_id: projectId,
        _stage_id: input.stageId,
        _theme: input.theme,
        _expected_revision: input.expectedRevision,
      });
      if (error) throw error;
      if (!data) throw new Error("Stage theme could not be saved.");
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["project-stages", projectId] });
    },
  });
}
