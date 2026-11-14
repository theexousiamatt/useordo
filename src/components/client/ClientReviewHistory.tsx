import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MessageSquareText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { DeliverableReviewHistory } from "@/components/projects/DeliverableReviewHistory";

type Reviewed = { id: string; project_id: string; title: string; description: string | null; status: string; created_at: string };

export function ClientReviewHistory({ projectId }: { projectId?: string }) {
  const { currentWorkspace } = useWorkspace();
  const { data, isPending, isError } = useQuery({
    queryKey: ["client-reviewed-deliverables", currentWorkspace?.id, projectId],
    enabled: !!currentWorkspace?.id,
    queryFn: async (): Promise<Reviewed[]> => {
      let query = supabase.from("deliverables")
        .select("id,project_id,title,description,status,created_at")
        .eq("workspace_id", currentWorkspace!.id)
        .in("status", ["approved", "rejected"])
        .order("created_at", { ascending: false })
        .limit(30);
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isPending) return <p className="text-xs text-muted-foreground">Loading completed reviews…</p>;
  if (isError) return <p className="text-xs text-muted-foreground">Review history could not be loaded.</p>;
  if (!data?.length) return null;
  return (
    <section aria-labelledby="client-review-history" className="rounded-panel bg-card p-5 sm:p-6">
      <div className="mb-5">
        <h2 id="client-review-history" className="text-base font-semibold">Previous reviews</h2>
        <p className="mt-1 text-xs text-muted-foreground">Decisions and feedback remain attached to the work.</p>
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.id} className="rounded-xl border border-border p-4">
            <div className="flex items-start gap-3">
              {item.status === "approved" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> :
                <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.status === "approved" ? "Approved" : "Changes requested"}</p>
                {item.description && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{item.description}</p>}
                <DeliverableReviewHistory deliverableId={item.id} projectId={item.project_id} />
                <Link to={`/client/projects/${item.project_id}`} className="mt-3 inline-flex text-xs font-medium text-primary hover:underline">
                  Open project files and milestones
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
