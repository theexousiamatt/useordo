import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import {
  useCreateProject,
  useWorkspaceMembers,
  type WorkspaceMemberProfile,
} from "@/hooks/useProjects";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (projectId: string) => void;
}

export function CreateProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { data: members = [] } = useWorkspaceMembers();
  const createProject = useCreateProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [clientIds, setClientIds] = useState<Set<string>>(new Set());

  const teamMembers = members.filter((m) => m.role !== "client" && m.user_id !== user?.id);
  const clientMembers = members.filter((m) => m.role === "client");

  const reset = () => {
    setName("");
    setDescription("");
    setDueDate("");
    setMemberIds(new Set());
    setClientIds(new Set());
  };

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Project name is required.");
      return;
    }
    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || null,
        member_ids: Array.from(memberIds),
        client_user_ids: Array.from(clientIds),
      });
      toast.success("Project created.");
      reset();
      onOpenChange(false);
      onCreated?.(project.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Set up a project to plan work, track deliverables, and collaborate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Website redesign"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-desc">Description</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-due">Due date</Label>
            <Input
              id="project-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {teamMembers.length > 0 && (
            <MemberPicker
              label="Team members"
              members={teamMembers}
              selected={memberIds}
              onToggle={(id) => toggle(memberIds, id, setMemberIds)}
            />
          )}

          {clientMembers.length > 0 && (
            <MemberPicker
              label="Client access"
              members={clientMembers}
              selected={clientIds}
              onToggle={(id) => toggle(clientIds, id, setClientIds)}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createProject.isPending}>
            {createProject.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberPicker({
  label,
  members,
  selected,
  onToggle,
}: {
  label: string;
  members: WorkspaceMemberProfile[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <ScrollArea className="max-h-40 rounded-md border border-border">
        <div className="divide-y divide-border">
          {members.map((m) => (
            <button
              key={m.user_id}
              type="button"
              onClick={() => onToggle(m.user_id)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
            >
              <Checkbox checked={selected.has(m.user_id)} className="pointer-events-none" />
              <Avatar className="h-7 w-7">
                {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name ?? ""} />}
                <AvatarFallback className="text-xs">{initials(m.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm">{m.full_name ?? m.email ?? "Unknown"}</p>
                {m.email && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
