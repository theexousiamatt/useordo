import { useState } from "react";
import { Package, Plus, Check, X, Send, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogФooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/states/EmptyState";
import { DeliverableBadge } from "@/components/projects/ProjectBadges";
import {
  useProjectDeliverables,
  useCreateDeliverable,
  useUpdateDeliverableStatus,
} from "@/hooks/useProjectData";
import { dateShort } from "@/lib/format";
import { toast } from "sonner";
import type { DeliverableStatus } from "@/lib/projectConstants";

function CreateDeliverableDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const create = useCreateDeliverable(projectId);

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await create.mutateAsync({ title: title.trim(), description: description.trim(), requiresApproval });
      toast.success("Deliverable created");
      setTitle("");
      setDescription("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create deliverable");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" /> New deliverable
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New deliverable</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="d-title">Title</Label>
            <Input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-desc">Description</Label>
            <Textarea id="d-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={requiresApproval}
              onCheckedChange={(v) => setRequiresApproval(Boolean(v))}
            />
            Requires client approval
          </label>
        </div>
        <DialogФooter>
          <Button onClick={submit} disabled={create.isPending || !title.trim()}>
            {create.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogФooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeliverablesTab({ projectId }: { projectId: string }) {
  const { data: deliverables = [], isLoading } = useProjectDeliverables(projectId);
  const updateStatus = useUpdateDeliverableStatus(projectId);

  const setStatus = async (id: string, status: DeliverableStatus, label: string) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(label);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update deliverable");
    }
  };

  if (!isLoading && deliverables.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <CreateDeliverableDialog projectId={projectId} />
        </div>
        <EmptyState
          icon={Package}
          title="No deliverables"
          description="Deliverables are the formal outputs you share with clients for review and approval."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateDeliverableDialog projectId={projectId} />
      </div>
      <div className="space-y-3">
        {deliverables.map((d) => (
          <Card key={d.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-medium">{d.title}</p>
              {d.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{d.description}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Created {dateShort(d.created_at)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <DeliverableBadge status={d.status as DeliverableStatus} />
              <div className="flex items-center gap-1.5">
                {d.status === "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateStatus.isPending}
                    onClick={() => setStatus(d.id, "submitted", "Submitted for review")}
                  >
                    <Send className="mr-1 h-3.5 w-3.5" /> Submit
                  </Button>
                )}
                {d.status === "submitted" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => setStatus(d.id, "rejected", "Changes requested")}
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Request changes
                    </Button>
                    <Button
                      size="sm"
                      disabled={updateStatus.isPending}
                      onClick={() => setStatus(d.id, "approved", "Deliverable approved")}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
