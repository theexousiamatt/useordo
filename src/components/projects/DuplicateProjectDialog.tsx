import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Copy, Layers, FileStack, CheckCircle2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { OrdoDrawer } from "@/components/ordo/OrdoDrawer";
import { OrdoField } from "@/components/ordo/OrdoField";
import { OrdoInput } from "@/components/ordo/OrdoInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  useDuplicateProject,
  type DuplicateProjectInput,
  type ProjectRow,
} from "@/hooks/useProjects";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectRow;
  onDuplicated?: (newId: string) => void;
}

type Mode = "complete" | "structure" | "blank";

interface ModeDef {
  id: Mode;
  icon: typeof Copy;
  title: string;
  badge?: string;
  subtitle: string;
  includes: string[];
  excludes?: string[];
}

const MODES: ModeDef[] = [
  {
    id: "complete",
    icon: FileStack,
    title: "Complete project copy",
    badge: "Recommended",
    subtitle: "Copy everything into the new project.",
    includes: [
      "Kanban columns",
      "All tasks & descriptions",
      "Priorities & due dates",
      "Comments & files",
      "Deliverables & milestones",
      "Team assignments & settings",
    ],
  },
  {
    id: "structure",
    icon: Layers,
    title: "Keep structure only",
    subtitle: "Copy the project's structure without the work.",
    includes: ["Kanban columns & workflow", "Labels & milestones", "Project settings"],
    excludes: ["Tasks", "Comments", "Files", "Deliverables", "Activity history"],
  },
  {
    id: "blank",
    icon: Copy,
    title: "Blank project",
    subtitle: "Create a new project with a default Kanban only.",
    includes: ["New project", "Default Kanban board"],
  },
];

/** Advanced per-entity overrides surfaced in the expandable section. */
interface Advanced {
  copyTeam: boolean;
  copyDueDates: boolean;
  copyMilestones: boolean;
  copyDeliverables: boolean;
  copyFiles: boolean;
  copyClient: boolean;
}

function advancedForMode(mode: Mode): Advanced {
  switch (mode) {
    case "complete":
      return {
        copyTeam: true,
        copyDueDates: true,
        copyMilestones: true,
        copyDeliverables: true,
        copyFiles: true,
        copyClient: true,
      };
    case "structure":
      return {
        copyTeam: false,
        copyDueDates: false,
        copyMilestones: true,
        copyDeliverables: false,
        copyFiles: false,
        copyClient: false,
      };
    case "blank":
      return {
        copyTeam: false,
        copyDueDates: false,
        copyMilestones: false,
        copyDeliverables: false,
        copyFiles: false,
        copyClient: false,
      };
  }
}

const ADVANCED_TOGGLES: { key: keyof Advanced; label: string }[] = [
  { key: "copyTeam", label: "Copy team members" },
  { key: "copyDueDates", label: "Copy due dates" },
  { key: "copyMilestones", label: "Copy milestones" },
  { key: "copyDeliverables", label: "Copy deliverables" },
  { key: "copyFiles", label: "Copy files" },
  { key: "copyClient", label: "Copy client" },
];

const FUTURE_TOGGLES = ["Copy labels", "Copy automations", "Copy custom fields"];

const LOADING_STEPS = ["Copying project…", "Copying workflow…", "Creating tasks…", "Finishing…"];

export function DuplicateProjectDialog({ open, onOpenChange, project, onDuplicated }: Props) {
  const duplicate = useDuplicateProject();
  const [name, setName] = useState(`${project.name} (Copy)`);
  const [mode, setMode] = useState<Mode>("structure");
  const [advanced, setAdvanced] = useState<Advanced>(advancedForMode("structure"));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const stepTimer = useRef<ReturnType<typeof setInterval>>();

  // Reset when (re)opened.
  useEffect(() => {
    if (open) {
      setName(`${project.name} (Copy)`);
      setMode("structure");
      setAdvanced(advancedForMode("structure"));
      setShowAdvanced(false);
      setLoadingStep(0);
    }
  }, [open, project]);

  // Mode change resets the advanced overrides to that mode's defaults.
  const selectMode = (m: Mode) => {
    setMode(m);
    setAdvanced(advancedForMode(m));
  };

  // Animate loading steps while pending.
  useEffect(() => {
    if (duplicate.isPending) {
      setLoadingStep(0);
      stepTimer.current = setInterval(() => {
        setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
      }, 900);
    } else if (stepTimer.current) {
      clearInterval(stepTimer.current);
    }
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, [duplicate.isPending]);

  const input = useMemo<DuplicateProjectInput>(() => {
    const copySettings = mode !== "blank";
    const copyWork = mode === "complete";
    return {
      projectId: project.id,
      name: name.trim(),
      copySettings,
      copyTasks: copyWork,
      copyComments: copyWork,
      copyClient: advanced.copyClient,
      copyTeam: advanced.copyTeam,
      copyDueDates: advanced.copyDueDates,
      copyMilestones: advanced.copyMilestones,
      copyDeliverables: advanced.copyDeliverables,
      copyFiles: advanced.copyFiles,
    };
  }, [project.id, name, mode, advanced]);

  const handleDuplicate = async () => {
    if (!name.trim()) {
      toast.error("Enter a name for the new project.");
      return;
    }
    try {
      const result = await duplicate.mutateAsync(input);
      toast.success("Project duplicated successfully.");
      onOpenChange(false);
      onDuplicated?.(result.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate project.");
    }
  };

  return (
    <OrdoDrawer
      open={open}
      onOpenChange={duplicate.isPending ? () => {} : onOpenChange}
      title="Duplicate project"
      description="Create a copy of this project. Choose what you want to carry over into the new project."
      className="sm:max-w-lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={duplicate.isPending}>
            Cancel
          </Button>
          <Button onClick={handleDuplicate} disabled={duplicate.isPending}>
            {duplicate.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                {LOADING_STEPS[loadingStep]}
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-4 w-4" /> Duplicate project
              </>
            )}
          </Button>
        </div>
      }
    >
      {duplicate.isPending ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <div>
            <p className="font-medium">Duplicating project…</p>
            <p className="mt-1 text-sm text-muted-foreground">{LOADING_STEPS[loadingStep]}</p>
          </div>
          <div className="mt-2 w-full max-w-xs space-y-1.5 text-left">
            {LOADING_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2 text-sm">
                {i < loadingStep ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : i === loadingStep ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-border" />
                )}
                <span className={cn(i <= loadingStep ? "text-foreground" : "text-muted-foreground")}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <OrdoField label="New project name" htmlFor="dup-name" required>
            <OrdoInput
              id="dup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
          </OrdoField>

          <div className="space-y-2.5">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMode(m.id)}
                  aria-pressed={active}
                  className={cn(
                    "w-full rounded-card border p-4 text-left transition-all",
                    active
                      ? "border-primary bg-primary/5 shadow-subtle"
                      : "border-border hover:border-primary/40 hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-pill",
                        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.title}</span>
                        {m.badge && (
                          <span className="rounded-pill bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {m.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{m.subtitle}</p>
                      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {m.includes.map((inc) => (
                          <li key={inc} className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-primary" /> {inc}
                          </li>
                        ))}
                      </ul>
                      {m.excludes && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Does not copy: {m.excludes.join(", ")}.
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-card border border-border">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
            >
              Advanced options
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
            </button>
            {showAdvanced && (
              <div className="space-y-3 border-t border-border px-4 py-3">
                {ADVANCED_TOGGLES.map((t) => (
                  <label
                    key={t.key}
                    className="flex cursor-pointer items-center gap-2.5 text-sm"
                  >
                    <Checkbox
                      checked={advanced[t.key]}
                      onCheckedChange={(c) =>
                        setAdvanced((prev) => ({ ...prev, [t.key]: !!c }))
                      }
                    />
                    {t.label}
                  </label>
                ))}
                {FUTURE_TOGGLES.map((label) => (
                  <label
                    key={label}
                    className="flex cursor-not-allowed items-center gap-2.5 text-sm text-muted-foreground/60"
                  >
                    <Checkbox disabled />
                    {label}
                    <span className="rounded-pill bg-secondary px-1.5 py-0.5 text-[10px]">Soon</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </OrdoDrawer>
  );
}
