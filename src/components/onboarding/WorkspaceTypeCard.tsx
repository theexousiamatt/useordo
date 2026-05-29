import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { type WorkspaceTypeOption } from "./onboardingSteps";

interface WorkspaceTypeCardProps {
  option: WorkspaceTypeOption;
  selected: boolean;
  onSelect: () => void;
}

/**
 * WorkspaceTypeCard — premium selectable card for the workspace type step.
 */
export function WorkspaceTypeCard({ option, selected, onSelect }: WorkspaceTypeCardProps) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col gap-3 rounded-card border p-4 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-foreground bg-secondary shadow-subtle"
          : "border-border hover:-translate-y-0.5 hover:bg-secondary/60 hover:shadow-subtle",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-small transition-colors",
          selected ? "bg-foreground text-background" : "bg-secondary text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{option.label}</div>
        <div className="text-xs text-muted-foreground">{option.description}</div>
      </div>
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
