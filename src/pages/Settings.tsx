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
  const navigate = useNavigate();
  const { currentWorkspace, role, refresh, selectWorkspace, workspaces } = useWorkspace();
  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

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

  const deleteWorkspace = async () => {
    if (!currentWorkspace) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("delete-workspace", {
      body: { workspaceId: currentWorkspace.id },
    });
    setDeleting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Could not delete workspace");
      return;
    }
    toast.success("Workspace deleted.");
    const next = workspaces.find((w) => w.id !== currentWorkspace.id);
    if (next) {
      selectWorkspace(next.id);
      await refresh();
      navigate("/");
    } else {
      navigate("/onboarding");
    }
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
          <AlertDialog onOpenChange={() => setConfirmText("")}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Delete workspace
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {currentWorkspace?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the workspace and all of its projects, tasks,
                  deliverables, files, and members. This cannot be undone. Type the
                  workspace name to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={currentWorkspace?.name}
                autoFocus
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting || confirmText !== currentWorkspace?.name}
                  onClick={(e) => {
                    e.preventDefault();
                    deleteWorkspace();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Delete workspace
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </div>
    </div>
  );
}
