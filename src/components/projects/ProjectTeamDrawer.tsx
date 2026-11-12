import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OrdoDrawer } from "@/components/ordo/OrdoDrawer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProjectMembers } from "@/hooks/useProjectData";
import { useWorkspaceMembers, type ProjectRow } from "@/hooks/useProjects";

/**
 * Assign several *existing, active* studio collaborators to an existing project.
 * The database's project_members RLS policy remains the authorization authority.
 * Client invitations and workspace onboarding remain in their established flows.
 */
export function ProjectTeamDrawer({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: members = [], isLoading: loadingWorkspace, isError: workspaceError } = useWorkspaceMembers();
  const { data: assigned = [], isLoading: loadingProject, isError: projectError } = useProjectMembers(project.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSelected([]);
      setError("");
    }
  }, [open, project.id]);

  const assignedIds = useMemo(() => new Set(assigned.map((m) => m.user_id)), [assigned]);
  const available = useMemo(
    () => members.filter((m) =>
      ["owner", "manager", "member"].includes(m.role) && !assignedIds.has(m.user_id)
      && m.user_id !== project.owner_id),
    [members, assignedIds, project.owner_id],
  );

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) =>
      checked ? (current.includes(id) ? current : [...current, id]) : current.filter((existing) => existing !== id),
    );
  };

  const addMembers = async () => {
    if (saving) return;
    // Never trust previously selected IDs after the roster changes.
    const allowed = new Set(available.map((person) => person.user_id));
    const ids = [...new Set(selected)].filter((id) => allowed.has(id));
    if (!ids.length) return;

    setSaving(true);
    setError("");
    try {
      const { error: saveError } = await supabase.from("project_members").insert(
        ids.map((userId) => ({
          workspace_id: project.workspace_id,
          project_id: project.id,
          user_id: userId,
          role: "member" as const,
        })),
      );
      if (saveError) throw saveError;

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["project-members", project.id] }),
        qc.invalidateQueries({ queryKey: ["assignable-members", project.id] }),
        qc.invalidateQueries({ queryKey: ["projects", project.workspace_id] }),
      ]);
      toast.success(ids.length === 1 ? "Teammate added to project." : `${ids.length} teammates added to project.`);
      setSelected([]);
      onOpenChange(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not add members. Check access and try again.");
    } finally {
      setSaving(false);
    }
  };

  const loading = loadingWorkspace || loadingProject;
  return (
    <OrdoDrawer
      open={open}
      onOpenChange={(next) => { if (!saving) onOpenChange(next); }}
      title="Project team"
      description="Add multiple people from your existing studio team to this project."
      className="sm:max-w-lg"
      footer={(
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={saving || loading || workspaceError || projectError || selected.length === 0} onClick={() => void addMembers()}>
            {saving ? "Adding members…" : `Add ${selected.length || ""} member${selected.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="text-sm">
          <p className="font-medium">Current project members ({assigned.length})</p>
          <p className="mt-1 text-muted-foreground">
            {assigned.length ? assigned.map((m) => m.full_name || "Studio member").join(", ") : "No project members yet."}
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-medium">Add studio teammates</h3>
          {loading ? <p role="status" className="text-sm text-muted-foreground">Loading teammates…</p> :
           workspaceError || projectError ?
             <p role="alert" className="text-sm text-destructive">The team list couldn't be loaded. Close and reopen to retry.</p> :
           !available.length ? <p className="text-sm text-muted-foreground">All available teammates are already assigned. Invite new people from Team.</p> :
           <div className="max-h-72 space-y-1 overflow-y-auto">
             {available.map((person) => (
               <label key={person.user_id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-3 hover:bg-muted">
                 <input type="checkbox" disabled={saving}
                   checked={selected.includes(person.user_id)}
                   onChange={(event) => toggle(person.user_id, event.target.checked)}
                   className="h-4 w-4 accent-primary"/>
                 <span className="min-w-0 flex-1">
                   <span className="block truncate text-sm font-medium">{person.full_name ?? person.email ?? "Studio teammate"}</span>
                   <span className="block text-xs capitalize text-muted-foreground">{person.role} in studio</span>
                 </span>
               </label>
             ))}
           </div>}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">People can work on more than one project. Client access is managed separately.</p>
      </div>
    </OrdoDrawer>
  );
}
