import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ErrorState } from "@/components/states/ErrorState";
import { assertFoundationEnvironment } from "@/lib/foundationEnvironment";

type EnvironmentDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      foundation_environment_info: {
        Args: Record<string, never>;
        Returns: { environment: string; target_ref: string; schema_version: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
const environmentClient = supabase as unknown as SupabaseClient<EnvironmentDatabase>;

/** No business data is requested until the server identifies this isolated schema. */
export default function FoundationEntry({ children }: { children: ReactNode }) {
  const environment = useQuery({
    queryKey: ["foundation-environment"],
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await environmentClient.rpc("foundation_environment_info");
      if (error) throw error;
      assertFoundationEnvironment(import.meta.env, window.location.hostname);
      // Preview uses the new production-target database without claiming a staging schema.
      const expectedEnvironment = import.meta.env.VITE_ORDO_ENVIRONMENT === "preview"
        ? "production" : import.meta.env.VITE_ORDO_ENVIRONMENT;
      const expectedRef = expectedEnvironment === "development" ? "local" : import.meta.env.VITE_ORDO_TARGET_REF;
      if (!expectedRef || data?.length !== 1 || data[0].environment !== expectedEnvironment
          || data[0].target_ref !== expectedRef || data[0].schema_version !== "ordo-foundation-v1") {
        throw new Error("The isolated workspace identity could not be verified.");
      }
      return true;
    },
  });
  if (environment.isPending) return <div className="client-os flex min-h-screen items-center justify-center bg-background p-6">
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />Opening Ordo…</p>
  </div>;
  if (environment.isError) return <div className="client-os min-h-screen bg-background p-6 sm:p-12"><div className="mx-auto max-w-xl">
    <ErrorState title="This workspace is unavailable" description="Ordo could not verify this workspace or its database identity. Access to business data is blocked." onRetry={() => void environment.refetch()} />
  </div></div>;
  return children;
}
