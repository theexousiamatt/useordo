import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const { currentWorkspace, role, refresh } = useWorkspace();
  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [busy, setBusy] = useState(false);

  if (role !== "owner") {
    return (
      <div>
        <PageHeader title="Settings" description="Manage your workspace configuration." />
        <EmptyState
          icon={Lock}
          title="Owner access required"
          description="Only the workspace owner can change these settings."
        />
      </div>
    );
  }

  const save = async () => {
    if (!currentWorkspace || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ name: name.trim() })
      .eq("id", currentWorkspace.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Workspace updated.");
  };

  return (
    <div>
      <PageHeader title="Settings" description="Manage your workspace configuration." />

      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-sm font-medium">General</h2>
          <p className="mb-4 text-xs text-muted-foreground">Basic information about your workspace.</p>
          <div className="grid gap-4 sm:max-w-md">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <div><Badge variant="secondary" className="capitalize">{currentWorkspace?.type}</Badge></div>
            </div>
            <div className="space-y-2">
              <Label>Workspace URL</Label>
              <p className="font-mono text-sm text-muted-foreground">ordo.app/{currentWorkspace?.slug}</p>
            </div>
            <div>
              <Button onClick={save} disabled={busy || name.trim() === currentWorkspace?.name}>
                Save changes
              </Button>
            </div>
          </div>
        </Card>

        <Card className="border-destructive/30 p-6">
          <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Deleting a workspace is permanent and removes all of its data.
          </p>
          <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => toast("Workspace deletion is coming soon.")}>
            Delete workspace
          </Button>
        </Card>
      </div>
    </div>
  );
}
