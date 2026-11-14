import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, History, MessageSquareText, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { dateShort } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

interface ReviewEntry {
  id: string;
  project_id: string;
  deliverable_id: string;
  decision: string;
  note: string | null;
  created_at: string;
  title: string;
  project_name: string;
}

export function useClientReviewHistory(projectId?: string) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery({
    queryKey: ["client-review-history", workspaceId, projectId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<ReviewEntry[]> => {
      if (!workspaceId) return [];
      let q = supabase.from("deliverable_reviews")
        .select("id,project_id,deliverable_id,decision,note,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }).limit(20);
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) return [];
      const projectIds = [...new Set(data.map(item => item.project_id))];
      const deliverableIds = [...new Set(data.map(item => item.deliverable_id))];
      const [projects, deliverables] = await Promise.all([
        supabase.from("projects").select("id,name").eq("workspace_id",workspaceId).in("id",projectIds),
        supabase.from("deliverables").select("id,title").eq("workspace_id",workspaceId).in("id",deliverableIds),
      ]);
      if (projects.error) throw projects.error;
      if (deliverables.error) throw deliverables.error;
      const names = new Map((projects.data ?? []).map(p=>[p.id,p.name]));
      const titles = new Map((deliverables.data ?? []).map(p=>[p.id,p.title]));
      return data.filter(item=>names.has(item.project_id)).map(item=>({
        ...item, title: titles.get(item.deliverable_id) ?? "Deliverable",
        project_name: names.get(item.project_id) ?? "Project",
      }));
    },
  });
}

export function ClientReviewHistory({ projectId }: { projectId?: string }) {
  const { data, isPending, isError, refetch } = useClientReviewHistory(projectId);
  return (
    <section aria-labelledby="review-history-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden="true"/>
        <h2 id="review-history-heading" className="text-base font-semibold">Review history</h2>
      </div>
      {isPending ? <Skeleton className="h-24 w-full rounded-panel" /> :
       isError ? <button type="button" onClick={()=>void refetch()} className="text-sm text-destructive underline">Couldn't load past reviews. Retry</button> :
       !data?.length ? <p className="rounded-panel border border-border bg-card p-5 text-sm text-muted-foreground">Your approvals and revision feedback will appear here after you review a deliverable.</p> :
       <div className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-card">
        {data.map(review=>(
          <div key={review.id} className="flex items-start gap-3 p-4">
            <span className="mt-0.5 text-primary">
              {review.decision==="approved"?<CheckCircle2 className="h-4 w-4"/>:<MessageSquareText className="h-4 w-4"/>}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{review.title}</p>
                <span className="text-xs text-muted-foreground">{dateShort(review.created_at)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {review.project_name} · {review.decision==="approved"?"Approved":"Changes requested"}
              </p>
              {review.note && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80">{review.note}</p>}
              <Link className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                to={`/client/projects/${review.project_id}?tab=files`}>
                View project files <ArrowUpRight className="h-3 w-3"/>
              </Link>
            </div>
          </div>
        ))}
       </div>}
    </section>
  );
}
