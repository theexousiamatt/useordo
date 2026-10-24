import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

export function useInvitationProjects(enabled: boolean) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["invitation-projects", currentWorkspace?.id],
    enabled: enabled && !!currentWorkspace?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,name")
        .eq("workspace_id", currentWorkspace!.id).is("archived_at", null).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
