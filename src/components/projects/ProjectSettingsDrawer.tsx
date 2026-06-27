import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { OrdoDrawer } from "@/components/ordo/OrdoDrawer";
import { OrdoField } from "@/components/ordo/OrdoField";
import { OrdoInput } from "@/components/ordo/OrdoInput";
import { OrdoTextarea } from "@/components/ordo/OrdoTextarea";
import { OrdoSelect } from "@/components/ordo/OrdoSelect";
import { OrdoDatePicker } from "@/components/ordo/OrdoDatePicker";
import { OrdoFormSection } from "@/components/ordo/OrdoForm";
import { Button } from "@/components/ui/button";
import {
  useUpdateProject,
  useWorkspaceMembers,
  type ProjectRow,
} from "@/hooks/useProjects";
import { PROJECT_STATUSES } from "@/lib/projectConstants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectRow;
  /** Whether the current user may edit settings. */
  canManage: boolean;
}

/** Ordo OS project settings — rename, description, due date, client, status, owner. */
export function ProjectSettingsDrawer({ open, onOpenChange, project, canManage }: Props) {
  const { data: members = [] } = useWorkspaceMembers();
  const updateProject = useUpdateProject();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [dueDate, setDueDate] = useState<Date | undefined>(
    project.due_date ? new Date(project.due_date) : undefined,
  );
  const [clientId, setClientId] = useState(project.client_id ?? "none");
  const [status, setStatus] = useState(project.status);
  const [ownerId, setOwnerId] = useState(project.owner_id ?? "");

  // Re-sync when a different project is opened.
  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
      setDueDate(project.due_date ? new Date(project.due_date) : undefined);
      setClientId(project.client_id ?? "none");
      setStatus(project.status);
      setOwnerId(project.owner_id ?? "");
    }
  }, [open, project]);

  const teamMembers = members.filter((m) => m.role !== "client");
  const clientMembers = members.filter((m) => m.role === "client");

  const ownerOptions = useMemo(
    () =>
      teamMembers.map((m) => ({
        value: m.user_id,
        label: m.full_name ?? m.email ?? "Unknown",
        description: m.email ?? undefined,
      })),
    [teamMembers],
  );

  const clientOptions = useMemo(
    () => [
      { value: "none", label: "No client" },
      ...clientMembers.map((m) => ({
        value: m.user_id,
        label: m.full_name ?? m.email ?? "Unknown",
        description: m.email ?? undefined,
      })),
    ],
    [clientMembers],
  );

  const statusOptions = PROJECT_STATUSES.filter((s) => s.value !== "archived").map((s) => ({
    value: s.value,
    label: s.label,
  }));

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Project name is required.");
      return;
    }
    try {
      await updateProject.mutateAsync({
        id: project.id,
        name: name.trim(),
        description: description.trim() || null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        client_id: clientId && clientId !== "none" ? clientId : null,
        status,
        owner_id: ownerId || null,
      });
      toast.success("Project updated.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update project.");
    }
  };

  return (
    <OrdoDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Project settings"
      description={
        canManage
          ? "Update the project's details, timeline, and ownership."
          : "You have view-only access to this project's settings."
      }
      className="sm:max-w-lg"
      footer={
        canManage ? (
          <div className="flex w-full items-center justify-between">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={updateProject.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateProject.isPending}>
              {updateProject.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        )
      }
    >
      <OrdoFormSection>
        <OrdoField label="Project name" htmlFor="ps-name" required>
          <OrdoInput
            id="ps-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canManage}
          />
        </OrdoField>
        <OrdoField label="Description" htmlFor="ps-desc">
          <OrdoTextarea
            id="ps-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            disabled={!canManage}
          />
        </OrdoField>
        <OrdoField label="Status">
          <OrdoSelect
            value={status}
            onValueChange={(v) => setStatus(v as typeof status)}
            options={statusOptions}
            disabled={!canManage}
          />
        </OrdoField>
        <OrdoField label="Due date">
          <OrdoDatePicker value={dueDate} onChange={canManage ? setDueDate : () => {}} placeholder="No due date" />
        </OrdoField>
        <OrdoField label="Client" hint={clientMembers.length ? undefined : "No clients in this workspace yet."}>
          <OrdoSelect
            value={clientId}
            onValueChange={setClientId}
            options={clientOptions}
            placeholder="No client"
            disabled={!canManage}
          />
        </OrdoField>
        <OrdoField label="Project owner">
          <OrdoSelect
            value={ownerId}
            onValueChange={setOwnerId}
            options={ownerOptions}
            placeholder="Select an owner"
            disabled={!canManage}
          />
        </OrdoField>
      </OrdoFormSection>
    </OrdoDrawer>
  );
}
