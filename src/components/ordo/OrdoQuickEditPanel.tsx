import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { OrdoDrawer } from "./OrdoDrawer";
import { OrdoField } from "./OrdoField";
import { OrdoInput } from "./OrdoInput";
import { OrdoTextarea } from "./OrdoTextarea";
import { OrdoSelect } from "./OrdoSelect";
import { OrdoDatePicker } from "./OrdoDatePicker";
import { TASK_COLUMNS, type TaskStatus } from "@/lib/projectConstants";
import type { TaskRow } from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";

export interface QuickEditPatch {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assignee_id?: string | null;
  due_date?: string | null;
}

/**
 * OrdoQuickEditPanel — lightweight side-sheet edit for common fields without a
 * full modal. Reusable for any record edited inline (tasks, deliverables…).
 */
export function OrdoQuickEditPanel({
  task,
  members,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  task: TaskRow | null;
  members: ProjectMemberProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: QuickEditPatch) => void;
  saving?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [assignee, setAssignee] = useState<string>("none");
  const [due, setDue] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority);
    setStatus(task.status);
    setAssignee(task.assignee_id ?? "none");
    setDue(task.due_date ? new Date(task.due_date) : undefined);
  }, [task]);

  const submit = () => {
    if (!task) return;
    onSave(task.id, {
      title: title.trim() || task.title,
      description: description.trim() || null,
      priority,
      status,
      assignee_id: assignee === "none" ? null : assignee,
      due_date: due ? due.toISOString().slice(0, 10) : null,
    });
    onOpenChange(false);
  };

  return (
    <OrdoDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Quick edit"
      description="Update common fields without leaving the board."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <OrdoField label="Task name" htmlFor="qe-title">
          <OrdoInput id="qe-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </OrdoField>

        <OrdoField label="Description" htmlFor="qe-desc">
          <OrdoTextarea
            id="qe-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add detail…"
            rows={4}
          />
        </OrdoField>

        <div className="grid grid-cols-2 gap-3">
          <OrdoField label="Status">
            <OrdoSelect
              value={status}
              onValueChange={(v) => setStatus(v as TaskStatus)}
              options={TASK_COLUMNS.map((c) => ({ value: c.id, label: c.title }))}
            />
          </OrdoField>
          <OrdoField label="Priority">
            <OrdoSelect
              value={priority}
              onValueChange={(v) => setPriority(v as TaskPriority)}
              options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
            />
          </OrdoField>
        </div>

        <OrdoField label="Assignee">
          <OrdoSelect
            value={assignee}
            onValueChange={setAssignee}
            options={[
              { value: "none", label: "Unassigned" },
              ...members.map((m) => ({ value: m.user_id, label: m.full_name ?? "Member" })),
            ]}
          />
        </OrdoField>

        <OrdoField label="Due date">
          <OrdoDatePicker value={due} onChange={setDue} />
        </OrdoField>
      </div>
    </OrdoDrawer>
  );
}
