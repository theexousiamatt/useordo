import { useMemo, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { OrdoDrawer } from "@/components/ordo/OrdoDrawer";
import { OrdoField } from "@/components/ordo/OrdoField";
import { OrdoInput } from "@/components/ordo/OrdoInput";
import { OrdoTextarea } from "@/components/ordo/OrdoTextarea";
import { OrdoSelect } from "@/components/ordo/OrdoSelect";
import { OrdoMultiSelect } from "@/components/ordo/OrdoMultiSelect";
import { OrdoDatePicker } from "@/components/ordo/OrdoDatePicker";
import { OrdoFormSection, OrdoFormRow } from "@/components/ordo/OrdoForm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useCreateProject,
  useWorkspaceMembers,
  type AiPlanItem,
} from "@/hooks/useProjects";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (projectId: string) => void;
}

const STEPS = ["Basics", "Timeline", "Team", "AI planning"] as const;

export function CreateProjectDrawer({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { data: members = [] } = useWorkspaceMembers();
  const createProject = useCreateProject();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [dueDate, setDueDate] = useState<Date>();
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string>(user?.id ?? "");

  // AI planning state
  const [aiTasks, setAiTasks] = useState(true);
  const [aiMilestones, setAiMilestones] = useState(true);
  const [aiTimeline, setAiTimeline] = useState(true);
  const [planItems, setPlanItems] = useState<AiPlanItem[]>([]);
  const [generating, setGenerating] = useState(false);

  const teamMembers = members.filter((m) => m.role !== "client");
  const clientMembers = members.filter((m) => m.role === "client");

  const memberOptions = useMemo(
    () =>
      teamMembers
        .filter((m) => m.user_id !== ownerId)
        .map((m) => ({
          value: m.user_id,
          label: m.full_name ?? m.email ?? "Unknown",
          sublabel: m.email ?? undefined,
          avatarUrl: m.avatar_url,
        })),
    [teamMembers, ownerId],
  );

  const ownerOptions = useMemo(
    () =>
      teamMembers.map((m) => ({
        value: m.user_id,
        label: m.full_name ?? m.email ?? "Unknown",
        description: m.user_id === user?.id ? "You" : undefined,
      })),
    [teamMembers, user?.id],
  );

  const clientOptions = useMemo(
    () =>
      clientMembers.map((m) => ({
        value: m.user_id,
        label: m.full_name ?? m.email ?? "Unknown",
        description: m.email ?? undefined,
      })),
    [clientMembers],
  );

  const reset = () => {
    setStep(0);
    setName("");
    setDescription("");
    setClientId("");
    setStartDate(undefined);
    setDueDate(undefined);
    setMemberIds([]);
    setOwnerId(user?.id ?? "");
    setAiTasks(true);
    setAiMilestones(true);
    setAiTimeline(true);
    setPlanItems([]);
  };

  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const canContinue = step === 0 ? name.trim().length > 0 : true;

  const generatePlan = async () => {
    if (!name.trim()) {
      toast.error("Add a project name first.");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-project-plan", {
        body: {
          name: name.trim(),
          description: description.trim() || undefined,
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
          due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          generate: { tasks: aiTasks, milestones: aiMilestones, timeline: aiTimeline },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPlanItems(data?.items ?? []);
      if (!data?.items?.length) toast.info("No plan items were generated.");
      else toast.success("Plan generated. Review and create when ready.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate plan.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Project name is required.");
      setStep(0);
      return;
    }
    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        client_id: clientId || null,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        member_ids: memberIds,
        client_user_ids: clientId ? [clientId] : [],
        owner_id: ownerId || user?.id || null,
        plan_items: planItems.length ? planItems : undefined,
      });
      toast.success("Project created.");
      reset();
      onOpenChange(false);
      onCreated?.(project.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project.");
    }
  };

  const isLast = step === STEPS.length - 1;

  return (
    <OrdoDrawer
      open={open}
      onOpenChange={close}
      title="Create project"
      description="Plan work, set a timeline, and bring your team together."
      className="sm:max-w-xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? close(false) : setStep((s) => s - 1))}
            disabled={createProject.isPending}
          >
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {isLast ? (
            <Button onClick={handleSubmit} disabled={createProject.isPending}>
              {createProject.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Create project
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
              Continue
            </Button>
          )}
        </div>
      }
    >
      <Stepper step={step} onStep={setStep} canNavigate={name.trim().length > 0} />

      <div className="mt-6">
        {step === 0 && (
          <OrdoFormSection>
            <OrdoField label="Project name" htmlFor="p-name" required>
              <OrdoInput
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Website redesign"
                autoFocus
              />
            </OrdoField>
            <OrdoField label="Description" htmlFor="p-desc" hint="A short summary of the project's goals.">
              <OrdoTextarea
                id="p-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
              />
            </OrdoField>
            <OrdoField label="Client" hint={clientOptions.length ? undefined : "No clients in this workspace yet."}>
              <OrdoSelect
                value={clientId}
                onValueChange={setClientId}
                options={clientOptions}
                placeholder="Select a client (optional)"
                disabled={clientOptions.length === 0}
              />
            </OrdoField>
          </OrdoFormSection>
        )}

        {step === 1 && (
          <OrdoFormSection title="Timeline" description="Set when the project starts and when it's due.">
            <OrdoFormRow>
              <OrdoField label="Start date">
                <OrdoDatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
              </OrdoField>
              <OrdoField label="Due date">
                <OrdoDatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder="Due date"
                  disabled={(d) => (startDate ? d < startDate : false)}
                />
              </OrdoField>
            </OrdoFormRow>
          </OrdoFormSection>
        )}

        {step === 2 && (
          <OrdoFormSection title="Team" description="Assign an owner and the members who'll collaborate.">
            <OrdoField label="Project owner">
              <OrdoSelect
                value={ownerId}
                onValueChange={setOwnerId}
                options={ownerOptions}
                placeholder="Select an owner"
              />
            </OrdoField>
            <OrdoField label="Team members" hint="Add the people working on this project.">
              <OrdoMultiSelect
                options={memberOptions}
                selected={memberIds}
                onChange={setMemberIds}
                placeholder="Assign members"
                emptyText="No team members available."
              />
            </OrdoField>
          </OrdoFormSection>
        )}

        {step === 3 && (
          <OrdoFormSection
            title="AI planning"
            description="Optionally let Ordo draft a starting plan you can refine later."
          >
            <div className="space-y-2.5">
              <PlanToggle label="Tasks" checked={aiTasks} onChange={setAiTasks} />
              <PlanToggle label="Milestones" checked={aiMilestones} onChange={setAiMilestones} />
              <PlanToggle label="Timeline" checked={aiTimeline} onChange={setAiTimeline} />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={generatePlan}
              disabled={generating || (!aiTasks && !aiMilestones && !aiTimeline)}
              className="w-full border-[hsl(var(--ai-border))] bg-[hsl(var(--ai-surface))] text-[hsl(var(--ai-text))] hover:bg-[hsl(var(--ai-surface))]/70"
            >
              {generating ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              {planItems.length ? "Regenerate plan" : "Generate plan"}
            </Button>

            {planItems.length > 0 && (
              <div className="space-y-2 rounded-card border border-border bg-secondary/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {planItems.length} item{planItems.length === 1 ? "" : "s"} drafted
                </p>
                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  {planItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-small bg-card px-3 py-2 shadow-subtle"
                    >
                      <span
                        className={cn(
                          "mt-0.5 rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          item.type === "milestone"
                            ? "bg-primary-surface text-primary-text"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {item.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        {item.description && (
                          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPlanItems((p) => p.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Remove item"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </OrdoFormSection>
        )}
      </div>
    </OrdoDrawer>
  );
}

function Stepper({
  step,
  onStep,
  canNavigate,
}: {
  step: number;
  onStep: (s: number) => void;
  canNavigate: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <button
            key={label}
            type="button"
            onClick={() => (i === 0 || canNavigate ? onStep(i) : undefined)}
            className="group flex flex-1 flex-col gap-1.5 text-left"
          >
            <span
              className={cn(
                "h-1 w-full rounded-pill transition-colors",
                active || done ? "bg-primary" : "bg-border",
              )}
            />
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {done && <Check className="h-3 w-3 text-primary" />}
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PlanToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between rounded-small border px-3.5 py-3 text-sm transition-colors",
        checked ? "border-primary/40 bg-primary-surface" : "border-border bg-card",
      )}
    >
      <span className="font-medium">{label}</span>
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
