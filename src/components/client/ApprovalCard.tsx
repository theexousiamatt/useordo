import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, FileText, MessageSquareText } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendAppEmail } from "@/lib/email";
import { dateShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ActionItem } from "@/hooks/useClientDashboard";

export function ApprovalCard({ item }: { item: ActionItem }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      if (decision === "rejected" && !note.trim()) {
        throw new Error("Add a short explanation so the team knows what to revise.");
      }
      const { data: reviewId, error } = await supabase.rpc("review_deliverable", {
        _id: item.id,
        _decision: decision,
        _note: note.trim() || undefined,
      });
      if (error) throw error;
      if (!reviewId) throw new Error("The review could not be confirmed.");
      void sendAppEmail({
        template: decision === "approved" ? "deliverable-approved" : "deliverable-rejected",
        entityId: reviewId,
        idempotencyKey: `review-${reviewId}`,
      });
      return decision;
    },
    onSuccess: async (result) => {
      toast.success(result === "approved" ? "Deliverable approved" : "Feedback sent to the team");
      setOpen(false);
      setNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client-actions"] }),
        queryClient.invalidateQueries({ queryKey: ["client-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["client-review-history"] }),
        queryClient.invalidateQueries({ queryKey: ["project-deliverables", item.project_id] }),
        queryClient.invalidateQueries({ queryKey: ["studio-dashboard"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startReview = (next: "approved" | "rejected") => {
    setDecision(next);
    setNote("");
    setOpen(true);
  };

  return (
    <>
      <article className="rounded-card border border-border bg-card px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Waiting for your review</span>
            <h3 className="break-words text-sm font-semibold sm:text-base">{item.title}</h3>
            <p className="text-xs text-muted-foreground">{item.project_name}{item.created_at ? ` · Shared ${dateShort(item.created_at)}` : ""}</p>
            {item.description && (
              <p className="max-w-xl whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            )}
            <Link to={`/client/projects/${item.project_id}?tab=files`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              View shared project files
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => startReview("rejected")}>
              <MessageSquareText className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Request changes
            </Button>
            <Button size="sm" onClick={() => startReview("approved")}>
              <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Approve
            </Button>
          </div>
        </div>
      </article>

      <Dialog open={open} onOpenChange={(next) => { if (!mutation.isPending) setOpen(next); }}>
        <DialogContent className="client-os max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{decision === "approved" ? "Approve deliverable?" : "Request a revision"}</DialogTitle>
            <DialogDescription>
              {decision === "approved"
                ? "This will record your approval and notify the project team."
                : "Explain what needs changing. Your feedback will be saved with this deliverable."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-small bg-secondary p-3">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.project_name}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`review-note-${item.id}`} className="text-xs font-medium">
              {decision === "rejected" ? "Revision feedback (required)" : "Approval note (optional)"}
            </label>
            <Textarea id={`review-note-${item.id}`} value={note} maxLength={5000}
              onChange={event => setNote(event.target.value)}
              placeholder={decision === "rejected" ? "What needs to be changed?" : "Any final comments for the team?"}
              className="min-h-[92px] resize-y bg-card" />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={mutation.isPending || (decision === "rejected" && !note.trim())}
              onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Saving review…" : decision === "approved" ? "Confirm approval" : "Send feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
