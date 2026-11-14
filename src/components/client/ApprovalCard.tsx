import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendAppEmail } from "@/lib/email";
import type { ActionItem } from "@/hooks/useClientDashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ApprovalCardProps {
  item: ActionItem;
}

export function ApprovalCard({ item }: ApprovalCardProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: async ({ status, feedback }: { status: "approved" | "changes_requested"; feedback?: string }) => {
      const { data: reviewId, error } = await supabase.rpc("review_deliverable", {
        _id: item.id,
        _decision: status === "approved" ? "approved" : "rejected",
        _note: feedback?.trim() || null,
      });
      if (error) throw error;
      if (reviewId) void sendAppEmail({
        template: status === "approved" ? "deliverable-approved" : "deliverable-rejected",
        entityId: reviewId,
        idempotencyKey: `review-${reviewId}`,
      });
      return status;
    },
    onSuccess: (status) => {
      setReviewOpen(false); setNote("");
      toast.success(status === "approved" ? "Approved" : "Changes requested");
      queryClient.invalidateQueries({ queryKey: ["client-actions"] });
      queryClient.invalidateQueries({ queryKey: ["client-activity"] });
      queryClient.invalidateQueries({ queryKey: ["deliverable-reviews", item.id] });
      queryClient.invalidateQueries({ queryKey: ["studio-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const urgent = item.status === "changes_requested" || isDueSoon(item.due_date);

  return (
    <div className="flex flex-col items-stretch justify-between gap-4 rounded-small sm:flex-row sm:items-center border border-transparent bg-card px-5 py-4 transition-colors hover:border-border">
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            urgent ? "bg-[hsl(var(--badge-red-text))]" : "bg-[hsl(var(--badge-orange-text))]",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.project_name} • {dueLabel(item.due_date)}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.status === "awaiting_approval" ? (
          <>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => setReviewOpen(true)}
              className="rounded-pill border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              Request changes
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ status: "approved" })}
              className="inline-flex items-center gap-1 rounded-pill bg-foreground px-3 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
          </>
        ) : (
          <button type="button" onClick={() => navigate(`/client/projects/${item.project_id}`)}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary">
            View project
          </button>
        )}
      </div>
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>Tell the team exactly what needs to change in {item.title}. This feedback will be saved to the approval history.</DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Revision feedback" value={note} maxLength={5000}
            placeholder="What would you like the team to revise?" rows={5}
            onChange={(event) => setNote(event.target.value)} />
          <p className="text-xs text-muted-foreground">{note.length}/5000 characters</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={mutation.isPending}>Cancel</Button>
            <Button disabled={!note.trim() || mutation.isPending}
              onClick={() => mutation.mutate({ status: "changes_requested", feedback: note.trim() })}>
              <MessageSquareText className="mr-2 h-4 w-4" /> Send feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isDueSoon(due: string | null) {
  if (!due) return false;
  const d = new Date(due).getTime();
  return d - Date.now() < 1000 * 60 * 60 * 24;
}

function dueLabel(due: string | null) {
  if (!due) return "No due date";
  const days = Math.round((new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}
