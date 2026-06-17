import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { OrdoInput } from "@/components/ordo/OrdoInput";
import { OrdoField } from "@/components/ordo/OrdoField";
import { useDeleteProject, type ProjectRow } from "@/hooks/useProjects";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectRow;
  /** Called after a successful deletion (e.g. to navigate away). */
  onDeleted?: () => void;
}

const RECORD_LABELS: Record<string, string> = {
  tasks: "tasks",
  milestones: "milestones",
  deliverables: "deliverables",
  members: "members",
  comments: "comments",
  files: "files",
  activity: "activity entries",
};

/** Owner-only destructive confirmation requiring the project name to be typed. */
export function DeleteProjectDialog({ open, onOpenChange, project, onDeleted }: Props) {
  const deleteProject = useDeleteProject();
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (open) setConfirm("");
  }, [open]);

  const matches = confirm.trim() === project.name.trim();

  const handleDelete = async () => {
    if (!matches) return;
    try {
      const report = await deleteProject.mutateAsync(project.id);
      const summary = Object.entries(report.records ?? {})
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${RECORD_LABELS[k] ?? k}`)
        .join(", ");
      toast.success(
        summary ? `Project deleted — removed ${summary}.` : "Project deleted.",
      );
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete project.");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="client-os rounded-panel">
        <AlertDialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the project and all of its tasks, milestones, deliverables,
            files, comments, and activity. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <OrdoField label={`Type the project name to confirm`} htmlFor="del-confirm">
          <OrdoInput
            id="del-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={project.name}
            autoComplete="off"
          />
        </OrdoField>

        <AlertDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={deleteProject.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!matches || deleteProject.isPending}
          >
            {deleteProject.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Delete project
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
