import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

type Task = { id: string; project_id: string; title: string };

export function ApprovalActions({ task }: { task: Task }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const decide = async (decision: "approved" | "changes_requested", noteText?: string) => {
    if (!user) return;
    setBusy(true);
    const { error: aErr } = await supabase.from("approvals").insert({
      task_id: task.id, client_id: user.id, decision, note: noteText ?? null,
    });
    if (aErr) { setBusy(false); return toast.error(aErr.message); }
    const newStatus = decision === "approved" ? "approved" : "changes_requested";
    const { error: tErr } = await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    setBusy(false);
    if (tErr) return toast.error(tErr.message);
    toast.success(decision === "approved" ? "Approved" : "Changes requested");
    setOpen(false); setNote("");
    qc.invalidateQueries();
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="default" disabled={busy} onClick={() => decide("approved")}>
        <Check className="h-3.5 w-3.5 mr-1" /> Approve
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={busy}>
            <X className="h-3.5 w-3.5 mr-1" /> Request changes
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">For: {task.title}</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs to change?"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => decide("changes_requested", note)} disabled={busy || !note.trim()}>
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
