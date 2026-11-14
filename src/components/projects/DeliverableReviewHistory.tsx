import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MessageSquareText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { timeAgo } from "@/lib/format";

type Review = {
  id: string;
  decision: string;
  note: string | null;
  created_at: string;
  reviewer_id: string;
};

export function DeliverableReviewHistory({ deliverableId, projectId }: {
  deliverableId: string; projectId: string;
}) {
  const { currentWorkspace } = useWorkspace();
  const { data, isPending, isError } = useQuery({
    queryKey: ["deliverable-reviews", deliverableId, currentWorkspace?.id],
    enabled: Boolean(currentWorkspace?.id),
    queryFn: async (): Promise<Review[]> => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase.from("deliverable_reviews")
        .select("id,decision,note,created_at,reviewer_id")
        .eq("workspace_id", currentWorkspace.id)
        .eq("project_id", projectId)
        .eq("deliverable_id", deliverableId)
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isPending) return <p className="mt-3 text-xs text-muted-foreground">Loading review history…</p>;
  if (isError) return <p className="mt-3 text-xs text-muted-foreground">Review history is temporarily unavailable.</p>;
  if (!data?.length) return <p className="mt-3 text-xs text-muted-foreground">No reviews yet.</p>;
  return (
    <ol className="mt-3 space-y-3 border-l border-border pl-4">
      {data.map((review) => (
        <li key={review.id} className="text-xs">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            {review.decision === "approved" ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> :
              <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />}
            <span>{review.decision === "approved" ? "Approved" : "Changes requested"}</span>
            <span className="font-normal text-muted-foreground">{timeAgo(review.created_at)}</span>
          </div>
          {review.note && <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">{review.note}</p>}
        </li>
      ))}
    </ol>
  );
}
