import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TaskStatus } from "@/lib/projectConstants";

export interface ProjectStage {
  id: string;
  project_id: string;
  workspace_id: string;
  name: string;
  category: TaskStatus;
  position: number;
  revision: number;
  created_at: string;
}

export type StageCommand = {
  action: "create" | "rename" | "reorder" | "remove";
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
