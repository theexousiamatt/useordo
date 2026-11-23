import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ClientHeader } from "@/components/client/ClientHeader";
import { DeliverableAttachment } from "@/components/projects/DeliverableAttachment";
import { DeliverableBadge } from "@/components/projects/ProjectBadges";
import { DeliverableReviewHistory } from "@/components/projects/DeliverableReviewHistory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/useWorkspace";
import { DELIVERABLE_FIELDS } from "@/hooks/useProjectData";
import { supabase } from "@/integrations/supabase/client";
import { sendAppEmail } from "@/lib/email";

type Decision = "approved" | "rejected";

export default function ClientDeliverableDetail() {
  const { id } = useParams();
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<{ id: string; decision: Decision; note: string } | null>(null);
  const query = useQuery({
    queryKey: ["client-deliverable", currentWorkspace?.id, id],
    enabled: !!currentWorkspace?.id && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("deliverables")
        .select(`${DELIVERABLE_FIELDS},projects(name)`)
        .eq("id", id!).eq("workspace_id", currentWorkspace!.id).neq("status", "draft").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const review = useMutation({
    mutationFn: async ({ id, decision, note }: NonNullable<typeof draft>) => {
      const { data: reviewId, error } = await supabase.rpc("review_deliverable", {
        _id: id, _decision: decision, _note: note.trim() || null,
      });
      if (error) throw error;
      if (reviewId) void sendAppEmail({
        template: decision === "approved" ? "deliverable-approved" : "deliverable-rejected",
        entityId: reviewId,
        idempotencyKey: `review-${reviewId}`,
      });
    },
    onSuccess: async (_, value) => {
      setDraft(null);
      toast.success(value.decision === "approved" ? "Approval saved." : "Changes requested.");
      await Promise.all([
        "client-deliverable", "client-shared-deliverables", "client-actions", "client-activity",
        "client-reviewed-deliverables", "studio-dashboard", "notifications",
      ].map(key => qc.invalidateQueries({ queryKey: [key] })));
      void qc.invalidateQueries({ queryKey: ["deliverable-reviews", value.id] });
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
      void query.refetch();
    },
  });
  const item = query.data;
  const pendingDecision = draft?.id === id ? draft : null;
  const canDecide = item?.status === "submitted" && item.requires_approval;
  const hasAttachment = item && (item.attachment_path || item.attachment_url || item.project_file_id);

  return <>
    <ClientHeader title={item?.title ?? "Deliverable"} subtitle={item?.projects?.name ?? "Shared work"} />
    <Link to="/client/deliverables" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary hover:underline">
      <ArrowLeft aria-hidden="true" className="size-4" /> All deliverables
    </Link>
    {query.isPending ? <p role="status" className="text-sm">Loading deliverable…</p>
      : query.isError ? <p role="alert" className="text-sm">Couldn’t load the deliverable. <Button variant="link" onClick={() => void query.refetch()}>Try again</Button></p>
      : !item ? <p className="text-sm">This deliverable is unavailable in the current workspace.</p> : (
        <article className="grid gap-7 rounded-panel bg-card p-5 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Review status</p>
              <div className="mt-2"><DeliverableBadge status={item.status} requiresApproval={item.requires_approval} /></div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Version</p>
              <p className="mt-1 text-base font-semibold">{item.version_label || "Unspecified"}</p>
            </div>
          </header>
          <section>
            <h2 className="text-lg font-semibold">Brief</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed">{item.description || "No brief was provided."}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Attachment</h2>
            {hasAttachment ? <DeliverableAttachment source={item} projectId={item.project_id} /> :
              <p className="mt-2 text-sm text-muted-foreground">No attachment was shared with this deliverable.</p>}
          </section>
          {canDecide && <section className="rounded-panel bg-secondary p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Your decision</h2>
            <p className="mt-1 text-sm">Your decision is saved with this deliverable and shared with the studio.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setDraft({ id: item.id, decision: "approved", note: "" })}>Approve</Button>
              <Button variant="outline" onClick={() => setDraft({ id: item.id, decision: "rejected", note: "" })}>Request changes</Button>
            </div>
          </section>}
          {item.requires_approval && <section>
            <h2 className="text-lg font-semibold">Client decisions</h2>
            <DeliverableReviewHistory deliverableId={item.id} projectId={item.project_id} />
          </section>}
        </article>
      )}
    <Dialog open={!!pendingDecision && canDecide} onOpenChange={open => { if (!open && !review.isPending) setDraft(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pendingDecision?.decision === "approved" ? "Approve deliverable" : "Request changes"}</DialogTitle>
          <DialogDescription>{item?.title}{item?.version_label ? ` · ${item.version_label}` : ""}</DialogDescription>
        </DialogHeader>
        {pendingDecision?.decision === "rejected" && <label className="grid gap-2 text-sm font-semibold">
          What should the studio revise?
          <Textarea value={pendingDecision.note} maxLength={5000} rows={5}
            onChange={event => setDraft({ ...pendingDecision, note: event.target.value })} />
        </label>}
        <DialogFooter>
          <Button variant="outline" disabled={review.isPending} onClick={() => setDraft(null)}>Cancel</Button>
          <Button disabled={!pendingDecision || review.isPending || (pendingDecision.decision === "rejected" && !pendingDecision.note.trim())}
            onClick={() => pendingDecision && review.mutate(pendingDecision)}>
            {review.isPending ? "Saving…" : pendingDecision?.decision === "approved" ? "Confirm approval" : "Send feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
