import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_THEME_OPTIONS, STAGE_THEME_STYLES, type StageTheme } from "@/lib/stageThemes";

interface StageThemePickerProps {
  value: StageTheme;
  onChange: (value: StageTheme) => void;
  disabled?: boolean;
}

/** Compact, named color avatars, inspired by palette pickers rather than label chips. */
export function StageThemePicker({ value, onChange, disabled = false }: StageThemePickerProps) {
  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-muted-foreground">Theme</span>
      <div role="radiogroup" aria-label="Stage theme"
        className="flex gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/20 p-2">
        {STAGE_THEME_OPTIONS.map(({ value: id, label }) => {
          const selected = id === value;
          const token = STAGE_THEME_STYLES[id];
          return (
            <button key={id} type="button" role="radio" aria-checked={selected}
              aria-label={label} title={label} disabled={disabled}
              onClick={() => onChange(id)}
              className={cn(
                "flex min-w-[57px] shrink-0 flex-col items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "hover:bg-muted/70 disabled:pointer-events-none disabled:opacity-50",
                selected && "bg-background shadow-sm",
              )}>
              <span className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-sm transition-transform",
                selected ? "scale-105 border-foreground/70" : "border-white/80 dark:border-zinc-600",
              )} style={{ backgroundColor: token.previewAccent }}>
                {selected && <Check className="h-4 w-4 text-white drop-shadow-sm" strokeWidth={2.8} aria-hidden />}
              </span>
              <span className={cn("text-[10px] leading-4", selected ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
